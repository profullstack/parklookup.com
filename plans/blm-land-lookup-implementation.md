# BLM Land Lookup & Mapping Implementation Plan

## Overview

This plan implements BLM (Bureau of Land Management) land data import and visualization for ParkLookup, following the established patterns from the trails implementation.

## Architecture

```mermaid
flowchart TD
    subgraph Data Sources
        USGS[USGS National Map - SMA Dataset]
        GDAL[GDAL ogr2ogr Conversion]
    end
    
    subgraph Import Pipeline
        CLI[scripts/import-blm.js]
        TRANSFORM[lib/api/blm.js]
    end
    
    subgraph Database
        BLM[(blm_lands table)]
        PARKS[(nps_parks / local_parks)]
        TRAILS[(trails)]
        SPATIAL[PostGIS ST_DWithin / ST_Intersects]
    end
    
    subgraph API Layer
        API_LIST[/api/blm]
        API_DETAIL[/api/blm/id]
        API_PARK[/api/parks/parkCode/blm]
    end
    
    subgraph Frontend
        PARK_PAGE[Park Detail Page]
        BLM_SECTION[Nearby BLM Land Section]
        BLM_MAP[BLM Map Overlay]
    end
    
    USGS --> GDAL
    GDAL --> CLI
    CLI --> TRANSFORM
    TRANSFORM --> BLM
    BLM --> SPATIAL
    PARKS --> SPATIAL
    TRAILS --> SPATIAL
    SPATIAL --> API_PARK
    BLM --> API_LIST
    BLM --> API_DETAIL
    API_PARK --> BLM_SECTION
    BLM_SECTION --> PARK_PAGE
    BLM --> BLM_MAP
```

## Phase 1: Database Schema

### Migration File: `supabase/migrations/20240101000042_blm_lands.sql`

```sql
-- BLM Lands table for Bureau of Land Management land boundaries
-- Data source: USGS National Map - Surface Management Agency dataset

CREATE TABLE IF NOT EXISTS blm_lands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source TEXT NOT NULL DEFAULT 'blm',
  source_id TEXT,                      -- Original ID from SMA dataset
  
  -- Land information
  unit_name TEXT,                      -- Name of the BLM unit/area
  managing_agency TEXT DEFAULT 'Bureau of Land Management',
  state TEXT,                          -- State abbreviation
  
  -- Geometry (MultiPolygon for land boundaries - handles complex BLM units)
    geometry GEOMETRY(MultiPolygon, 4326),
  
  -- Computed fields
  area_acres NUMERIC,                  -- Calculated from geometry
  centroid_lat NUMERIC,
  centroid_lng NUMERIC,
  
  -- Metadata
  raw_data JSONB,                      -- Original SMA attributes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS blm_lands_geom_idx ON blm_lands USING GIST (geometry);
CREATE INDEX IF NOT EXISTS blm_lands_state_idx ON blm_lands(state);
CREATE INDEX IF NOT EXISTS blm_lands_source_idx ON blm_lands(source, source_id);
CREATE INDEX IF NOT EXISTS blm_lands_centroid_idx ON blm_lands(centroid_lat, centroid_lng);

-- Full-text search on unit name
CREATE INDEX IF NOT EXISTS blm_lands_search_idx ON blm_lands USING GIN(
  to_tsvector('english', coalesce(unit_name, ''))
);

-- Trigger for updated_at
CREATE TRIGGER update_blm_lands_updated_at
  BEFORE UPDATE ON blm_lands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE blm_lands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "BLM lands are viewable by everyone"
  ON blm_lands FOR SELECT USING (true);

CREATE POLICY "Service role can manage BLM lands"
  ON blm_lands FOR ALL USING (auth.role() = 'service_role');

-- Function to find BLM lands near a park
CREATE OR REPLACE FUNCTION find_blm_near_park(
  p_park_id UUID,
  p_park_source TEXT,
  p_radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE (
  id UUID,
  unit_name TEXT,
  state TEXT,
  area_acres NUMERIC,
  distance_meters DECIMAL,
  geometry_geojson TEXT
) AS $$
DECLARE
  park_location GEOGRAPHY;
BEGIN
  -- Get park location based on source
  IF p_park_source = 'nps' THEN
    SELECT location INTO park_location FROM nps_parks WHERE id = p_park_id;
  ELSIF p_park_source = 'wikidata' THEN
    SELECT location INTO park_location FROM wikidata_parks WHERE id = p_park_id;
  ELSIF p_park_source = 'local' THEN
    SELECT location INTO park_location FROM local_parks WHERE id = p_park_id;
  END IF;
  
  IF park_location IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    b.id,
    b.unit_name,
    b.state,
    b.area_acres,
    ST_Distance(b.geometry::geography, park_location)::DECIMAL AS distance_meters,
    ST_AsGeoJSON(ST_Simplify(b.geometry, 0.001))::TEXT AS geometry_geojson
  FROM blm_lands b
  WHERE ST_DWithin(b.geometry::geography, park_location, p_radius_meters)
  ORDER BY distance_meters
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION find_blm_near_park TO anon, authenticated;

-- Function to find BLM lands near a point
CREATE OR REPLACE FUNCTION find_nearby_blm(
  lat DECIMAL,
  lng DECIMAL,
  radius_meters INTEGER DEFAULT 50000,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  unit_name TEXT,
  state TEXT,
  area_acres NUMERIC,
  distance_meters DECIMAL,
  geometry_geojson TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.unit_name,
    b.state,
    b.area_acres,
    ST_Distance(
      b.geometry::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    )::DECIMAL AS distance_meters,
    ST_AsGeoJSON(ST_Simplify(b.geometry, 0.001))::TEXT AS geometry_geojson
  FROM blm_lands b
  WHERE ST_DWithin(
    b.geometry::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  ORDER BY distance_meters
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION find_nearby_blm TO anon, authenticated;

-- Function to find trails that intersect with BLM land
CREATE OR REPLACE FUNCTION find_trails_on_blm(blm_id UUID)
RETURNS SETOF trails AS $$
BEGIN
  RETURN QUERY
  SELECT t.*
  FROM trails t
  JOIN blm_lands b ON ST_Intersects(t.geometry, b.geometry)
  WHERE b.id = blm_id
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION find_trails_on_blm TO anon, authenticated;

-- Comments
COMMENT ON TABLE blm_lands IS 'Bureau of Land Management land boundaries from USGS National Map Surface Management Agency dataset';
COMMENT ON COLUMN blm_lands.geometry IS 'Polygon boundary in WGS84 (EPSG:4326)';
COMMENT ON COLUMN blm_lands.area_acres IS 'Calculated area in acres from geometry';
```

## Phase 2: Import Pipeline

### File Structure

```
lib/
  api/
    blm.js           # BLM data transformation utilities
scripts/
  import-blm.js      # CLI import script
data/
  blm/               # Directory for downloaded BLM data files
    README.md        # Instructions for downloading data
```

### Data Download Instructions

The BLM data must be downloaded manually from USGS National Map:

1. Visit: https://apps.nationalmap.gov/downloader/
2. Select "Surface Management Agency" dataset
3. Download GeoPackage or Shapefile format
4. Convert to GeoJSON using GDAL:
   ```bash
   ogr2ogr -f GeoJSON -where "ADMIN_AGENCY = 'Bureau of Land Management'" \
     data/blm/blm.geojson SMA_National.gpkg
   ```

### lib/api/blm.js Key Functions

```javascript
// Transform GeoJSON feature to database record
export const transformFeature = (feature) => {
  const props = feature.properties || {};
  return {
    source: 'blm',
    source_id: props.OBJECTID || props.FID,
    unit_name: props.UNIT_NM || props.ADMIN_UNIT_NAME,
    managing_agency: 'Bureau of Land Management',
    state: props.STATE_ABBR || extractStateFromGeometry(feature),
    geometry: feature.geometry,
    area_acres: calculateAreaAcres(feature.geometry),
    raw_data: props,
  };
};

// Convert geometry to WKT for PostGIS
export const geometryToWKT = (geometry) => {
  // Handle Polygon and MultiPolygon
  if (geometry.type === 'MultiPolygon') {
    // Convert to single polygon (largest) or handle as needed
  }
  return `SRID=4326;POLYGON(...)`;
};

// Calculate centroid for indexing
export const calculateCentroid = (geometry) => {
  // Use turf.js or manual calculation
};
```

### scripts/import-blm.js CLI Options

```bash
pnpm run import:blm [options]

Options:
  --file <path>      Path to GeoJSON file (default: data/blm/blm.geojson)
  --state <abbr>     Filter by state abbreviation
  --limit <n>        Limit number of records to import
  --skip <n>         Skip first n records
  --dry-run          Don't insert, just log what would be done
  --truncate         Truncate table before import (full refresh)
```

## Phase 3: API Routes

### GET /api/blm
- Query params: `state`, `near` (lat,lng), `radius`, `limit`
- Returns paginated BLM land list with simplified geometries

### GET /api/blm/[id]
- Returns full BLM land details with geometry

### GET /api/parks/[parkCode]/blm
- Returns BLM lands near a specific park
- Uses `find_blm_near_park` function

## Phase 4: Frontend Components

### BLMCard.jsx
- Displays: unit name, state, area (acres), distance
- Tan/orange color scheme to match BLM branding
- Warning icon with "No developed facilities" note

### BLMList.jsx
- State filter dropdown
- Distance sort
- Responsive grid layout

### BLMMap.jsx (or extend TrailMap)
- Semi-transparent tan/orange polygon overlay
- Lower z-index than trails
- Tooltip on hover with unit name and area
- Toggle control for visibility

## Phase 5: Park Page Integration

### New Tab: "BLM Land"

Add to TABS array in ParkDetailClient.jsx:
```javascript
{ id: 'blm', label: 'BLM Land' }
```

Tab content includes:
- Distance to nearest BLM polygon
- List of nearby BLM lands (within 50km)
- Map showing BLM land boundaries
- Warning text about dispersed camping rules
- Link to BLM.gov for regulations

### Map Layer Toggle

Add BLM land as a toggleable layer in TrailMap component:
- Semi-transparent tan/orange polygon overlay
- Lower z-index than trails
- Toggle control in map legend
- Tooltip on hover with unit name and area

## Implementation Order

1. **Database** - Create migration with table and functions
2. **Import Pipeline** - Create lib/api/blm.js and scripts/import-blm.js
3. **Package.json** - Add import:blm script
4. **API Routes** - Create /api/blm endpoints
5. **Components** - Create BLM components
6. **Integration** - Add to park pages
7. **Documentation** - Create docs/BLM.md

## Data Considerations

### Geometry Simplification

BLM polygons can be very large and complex. Use ST_Simplify for:
- API responses (tolerance: 0.001 for list views, 0.0001 for detail)
- Map rendering (client-side simplification if needed)

### Performance

- Use spatial indexes (GIST) for all geometry queries
- Limit results to reasonable counts (20-50 per query)
- Consider vector tiles for large-scale map views (future)

### Update Strategy

- Truncate and re-import (data changes infrequently)
- Run quarterly or when USGS updates dataset
- No user edits to boundaries

## Phase 6: SEO Pages (Phase 2)

### /blm Landing Page

```
/blm
```

Content:
- Overview of BLM land in the US
- State-by-state breakdown with counts
- Search/filter functionality
- Map showing all BLM land

### /blm/[state] State Pages

```
/blm/[state]
```

Content:
- List of BLM units in the state
- Map of state BLM land
- Nearby parks with BLM access
- SEO-optimized content for "BLM land in [state]"

## Phase 7: AI Integration (Phase 2)

AI prompts may reference:
- Proximity to BLM land
- Lack of amenities
- Off-grid suitability
- Dispersed camping opportunities

Example prompt enhancement:
> "Suggest a 2-day trip using nearby BLM land for dispersed camping."

## Success Criteria

- [ ] BLM land visible as map overlay on park pages
- [ ] BLM Land tab shows nearby BLM context with distances
- [ ] Map layer toggle works in TrailMap component
- [ ] Import CLI completes successfully with progress logging
- [ ] No proprietary datasets used (USGS data is public domain)
- [ ] Map overlay loads < 500ms
- [ ] API responses include simplified geometries for performance
- [ ] MultiPolygon geometries handled correctly