# Open Trails & Hiking Maps Implementation Plan

## Overview

This plan implements trail data import from OpenStreetMap (OSM) and visualization on park pages for ParkLookup.

## Architecture

```mermaid
flowchart TD
    subgraph Data Sources
        OSM[OpenStreetMap Overpass API]
        USGS[USGS/USFS Trails - Future]
    end
    
    subgraph Import Pipeline
        CLI[scripts/import-trails.js]
        OVERPASS[lib/api/overpass.js]
        TRANSFORM[lib/api/trails.js]
    end
    
    subgraph Database
        TRAILS[(trails table)]
        PARKS[(nps_parks / local_parks)]
        SPATIAL[PostGIS ST_Intersects]
    end
    
    subgraph API Layer
        API_LIST[/api/trails]
        API_DETAIL[/api/trails/id]
        API_PARK[/api/parks/parkCode/trails]
    end
    
    subgraph Frontend
        PARK_PAGE[Park Detail Page]
        TRAIL_TAB[Trails Tab]
        TRAIL_MAP[Trail Map Component]
        TRAIL_PAGE[Trail Detail Page]
    end
    
    OSM --> OVERPASS
    OVERPASS --> CLI
    CLI --> TRANSFORM
    TRANSFORM --> TRAILS
    TRAILS --> SPATIAL
    PARKS --> SPATIAL
    SPATIAL --> API_PARK
    TRAILS --> API_LIST
    TRAILS --> API_DETAIL
    API_PARK --> TRAIL_TAB
    TRAIL_TAB --> PARK_PAGE
    TRAIL_TAB --> TRAIL_MAP
    API_DETAIL --> TRAIL_PAGE
```

## Phase 1: Database Schema

### Migration File: `supabase/migrations/20240101000041_trails.sql`

```sql
-- Trails table for hiking trail data from OSM and other sources
CREATE TABLE IF NOT EXISTS trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                 -- osm | usfs | usgs
  source_id TEXT NOT NULL,              -- Original ID from source
  slug TEXT NOT NULL,                   -- URL-friendly identifier
  
  -- Park associations (nullable - trail may span multiple or no parks)
  nps_park_id UUID REFERENCES nps_parks(id) ON DELETE SET NULL,
  local_park_id UUID REFERENCES local_parks(id) ON DELETE SET NULL,
  
  -- Trail info
  name TEXT,
  description TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  length_meters NUMERIC,
  elevation_gain_m NUMERIC,
  surface TEXT,                         -- paved | gravel | dirt | rock
  trail_type TEXT,                      -- loop | out-and-back | point-to-point
  
  -- OSM-specific fields
  sac_scale TEXT,                       -- hiking | mountain_hiking | alpine_hiking etc
  trail_visibility TEXT,
  
  -- Geometry (LineString for trail path)
  geometry GEOMETRY(LineString, 4326),
  
  -- Metadata
  is_user_submitted BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(source, source_id)
);

-- Indexes
CREATE INDEX trails_geom_idx ON trails USING GIST (geometry);
CREATE INDEX trails_nps_park_idx ON trails(nps_park_id);
CREATE INDEX trails_local_park_idx ON trails(local_park_id);
CREATE INDEX trails_difficulty_idx ON trails(difficulty);
CREATE INDEX trails_slug_idx ON trails(slug);
CREATE INDEX trails_source_idx ON trails(source);

-- Full-text search
CREATE INDEX trails_search_idx ON trails USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- Triggers
CREATE TRIGGER update_trails_updated_at
  BEFORE UPDATE ON trails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trails are viewable by everyone"
  ON trails FOR SELECT USING (true);

CREATE POLICY "Service role can manage trails"
  ON trails FOR ALL USING (auth.role() = 'service_role');

-- Function to find trails within a park boundary
CREATE OR REPLACE FUNCTION find_trails_in_park(
  p_park_id UUID,
  p_park_type TEXT DEFAULT 'nps'
)
RETURNS SETOF trails AS $$
BEGIN
  IF p_park_type = 'nps' THEN
    RETURN QUERY
    SELECT t.*
    FROM trails t
    JOIN nps_parks p ON ST_Intersects(t.geometry, p.location::geometry)
    WHERE p.id = p_park_id;
  ELSE
    RETURN QUERY
    SELECT t.*
    FROM trails t
    JOIN local_parks p ON ST_Intersects(t.geometry, p.geometry::geometry)
    WHERE p.id = p_park_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION find_trails_in_park TO anon, authenticated;

-- Function to find trails near a point
CREATE OR REPLACE FUNCTION find_nearby_trails(
  lat DECIMAL,
  lng DECIMAL,
  radius_meters INTEGER DEFAULT 50000,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  difficulty TEXT,
  length_meters NUMERIC,
  elevation_gain_m NUMERIC,
  surface TEXT,
  distance_meters DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.slug,
    t.difficulty,
    t.length_meters,
    t.elevation_gain_m,
    t.surface,
    ST_Distance(
      t.geometry::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_meters
  FROM trails t
  WHERE ST_DWithin(
    t.geometry::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  ORDER BY distance_meters
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION find_nearby_trails TO anon, authenticated;
```

## Phase 2: Import Pipeline

### File Structure

```
lib/
  api/
    overpass.js      # OSM Overpass API client
    trails.js        # Trail normalization utilities
scripts/
  import-trails.js   # CLI import script
```

### Key Implementation Details

#### Overpass Query Strategy

For each park with a bounding box:
```
[out:json][timeout:60];
(
  way["highway"~"path|footway|track"]["name"](bbox);
  relation["route"="hiking"](bbox);
);
out geom;
```

#### Difficulty Heuristics

```javascript
function calculateDifficulty(trail) {
  const { sac_scale, length_meters, elevation_gain_m } = trail;
  
  // SAC scale takes priority
  if (sac_scale) {
    if (sac_scale.includes('alpine') || sac_scale.includes('demanding')) return 'hard';
    if (sac_scale.includes('mountain')) return 'moderate';
    return 'easy';
  }
  
  // Fallback to length/elevation
  const lengthKm = (length_meters || 0) / 1000;
  const gain = elevation_gain_m || 0;
  
  if (lengthKm > 15 || gain > 600) return 'hard';
  if (lengthKm > 8 || gain > 300) return 'moderate';
  return 'easy';
}
```

#### Slug Generation

```javascript
function generateTrailSlug(trail) {
  const base = trail.name 
    ? trail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : `trail-${trail.source_id}`;
  return base.replace(/^-|-$/g, '');
}
```

## Phase 3: API Routes

### GET /api/trails
- Query params: `difficulty`, `minLength`, `maxLength`, `near` (lat,lng)
- Returns paginated trail list

### GET /api/trails/[id]
- Returns full trail details with GeoJSON geometry

### GET /api/parks/[parkCode]/trails
- Returns trails associated with a specific park
- Uses spatial intersection if no direct FK relationship

## Phase 4: Frontend Components

### TrailCard.jsx
- Displays: name, difficulty badge, length, elevation gain
- Color-coded by difficulty (green/blue/red)
- Links to trail detail page

### TrailList.jsx
- Filters: difficulty dropdown, length range slider
- Sort: by name, length, difficulty
- Responsive grid layout

### TrailMap.jsx
- Uses MapLibre GL JS (hybrid approach - separate from Leaflet maps)
- Renders trail LineString geometry as GeoJSON source
- Color-coded polylines by difficulty:
  - Easy: `#16a34a` (green)
  - Moderate: `#2563eb` (blue)
  - Hard: `#dc2626` (red)
- Interactive popups with trail info on click
- Supports terrain/satellite base layers

## Phase 5: Park Integration

### Tab Addition
Add to `TABS` array in [`ParkDetailClient.jsx`](app/parks/[parkCode]/[[...tab]]/ParkDetailClient.jsx:28):
```javascript
{ id: 'trails', label: 'Trails' }
```

### Trails Tab Content
- Trail count summary
- TrailMap showing all park trails
- TrailList with filters
- Link to full trails page

## Phase 6: Trail Detail Pages

### URL Structure
```
/parks/[parkCode]/trails/[trailSlug]
```

### SEO Schema
```json
{
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  "name": "Trail Name",
  "description": "...",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "...",
    "longitude": "..."
  },
  "hasMap": "...",
  "isAccessibleForFree": true
}
```

## Dependencies to Add

```json
{
  "dependencies": {
    "@turf/turf": "^7.0.0",
    "osmtogeojson": "^3.0.0-beta.5",
    "maplibre-gl": "^4.0.0",
    "react-map-gl": "^7.1.0"
  }
}
```

**Note:** MapLibre GL JS will be used specifically for trail maps (hybrid approach), while existing Leaflet maps remain unchanged for park markers and general map views.

## Environment Variables

No new environment variables required - uses existing Supabase credentials.

## Success Criteria

1. ✅ Trails visible on park pages
2. ✅ Map renders within 500ms
3. ✅ CLI import completes without errors
4. ✅ Data refresh documented
5. ✅ No proprietary data sources used

## Future Enhancements (Out of Scope)

- GPX downloads
- Elevation profiles
- Trail conditions/closures
- User photos on trails
- AI trip planning integration