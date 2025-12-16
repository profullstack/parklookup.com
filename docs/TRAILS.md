# Trails Feature Documentation

## Overview

ParkLookup includes trail data imported from OpenStreetMap (OSM) and other open data sources. This document covers the data model, import process, and maintenance procedures.

## Data Sources

### Primary: OpenStreetMap (OSM)

- **License**: ODbL (Open Database License) - share-alike compliant
- **Data Types**:
  - `highway=path|footway|track` - Walking/hiking paths
  - `route=hiking` - Designated hiking routes
  - `sac_scale` - Swiss Alpine Club difficulty scale
  - `surface` - Trail surface type
  - `trail_visibility` - How visible the trail is

### Secondary: USGS/USFS (Future)

- **License**: Public Domain
- **Sources**: National Map, Forest Service Trails

## Database Schema

### `trails` Table

```sql
create table trails (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- osm | usfs | usgs
  source_id text not null,              -- Original ID from source
  park_id uuid references parks(id),    -- Associated park
  park_source text,                     -- Park source type
  name text,                            -- Trail name
  slug text unique,                     -- URL-friendly identifier
  difficulty text check (difficulty in ('easy','moderate','hard')),
  length_meters numeric,                -- Trail length
  elevation_gain_m numeric,             -- Total elevation gain
  surface text,                         -- Surface type
  description text,                     -- Trail description
  geometry geometry(LineString, 4326),  -- PostGIS geometry
  is_user_submitted boolean default false,
  last_seen_at timestamptz,             -- For tracking stale data
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Indexes

- `trails_geom_idx` - Spatial index on geometry (GIST)
- `trails_source_unique` - Unique constraint on (source, source_id)
- `trails_park_idx` - Index on park_id for fast lookups
- `trails_slug_idx` - Index on slug for URL lookups

### Functions

- `find_trails_for_park(park_uuid)` - Find trails within a park's boundary
- `find_nearby_trails(lat, lng, radius_meters)` - Find trails near a point
- `get_trail_with_geojson(trail_id)` - Get trail with GeoJSON geometry

## Import Pipeline

### CLI Command

```bash
# Import trails for all parks
pnpm run import:trails

# Import for specific park types
pnpm run import:trails -- --park-type=nps
pnpm run import:trails -- --park-type=state

# Limit number of parks (for testing)
pnpm run import:trails -- --limit=10

# Dry run (no database writes)
pnpm run import:trails -- --dry-run

# Custom search radius (meters)
pnpm run import:trails -- --radius=10000
```

### Import Process

1. **Fetch Parks**: Query `all_parks` view for parks with coordinates
2. **Query OSM**: Use Overpass API to fetch trails within park bounding box
3. **Transform Data**: Convert OSM elements to normalized trail format
4. **Calculate Metrics**: Compute length, difficulty, generate slugs
5. **Associate Parks**: Link trails to parks via spatial intersection
6. **Upsert**: Insert new trails, update existing ones

### Difficulty Heuristics

Difficulty is calculated based on multiple factors:

```javascript
// Priority 1: SAC Scale (Swiss Alpine Club)
if (sac_scale?.includes('alpine')) → 'hard'
if (sac_scale?.includes('demanding')) → 'hard'
if (sac_scale?.includes('mountain')) → 'moderate'

// Priority 2: Length
if (length > 15km) → 'hard'
if (length > 8km) → 'moderate'

// Priority 3: Elevation Gain
if (elevation > 600m) → 'hard'
if (elevation > 300m) → 'moderate'

// Default
→ 'easy'
```

## API Endpoints

### List Trails

```
GET /api/trails
GET /api/trails?difficulty=easy&limit=20&offset=0
```

### Trail Details

```
GET /api/trails/[id]
GET /api/trails/slug/[slug]
```

### Park Trails

```
GET /api/parks/[parkCode]/trails
GET /api/parks/[parkCode]/trails?difficulty=moderate
```

## Frontend Components

### TrailCard

Displays trail preview with:
- Name and difficulty badge
- Length in miles
- Elevation gain
- Surface type

### TrailList

Filterable list of trails with:
- Difficulty filter (easy/moderate/hard)
- Length filter (short/medium/long)
- Sorting options

### TrailMap

MapLibre GL map showing:
- Trail geometry as colored lines
- Difficulty-based coloring (green/blue/red)
- Interactive popups with trail info

## Data Refresh

### Scheduled Updates

Trails should be refreshed monthly to capture OSM updates:

```bash
# Add to cron or scheduled job
0 0 1 * * cd /path/to/parklookup && pnpm run import:trails
```

### Tracking Stale Data

The `last_seen_at` column tracks when a trail was last seen in source data:

```sql
-- Find trails not seen in last 60 days
SELECT * FROM trails 
WHERE last_seen_at < NOW() - INTERVAL '60 days';
```

### Handling Removed Trails

Trails removed from OSM are soft-flagged rather than deleted:

1. Set `last_seen_at` to NULL or old date
2. Optionally hide from UI
3. Preserve user-submitted trails

## SEO

### Trail Pages

URL structure: `/parks/[parkCode]/trails/[trailSlug]`

Each trail page includes:
- TouristAttraction schema.org structured data
- Meta description with trail details
- Open Graph tags for social sharing

### Structured Data Example

```json
{
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  "name": "Bright Angel Trail",
  "description": "A moderate 9.5 mile trail in Grand Canyon National Park",
  "touristType": "Hiking",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 36.0544,
    "longitude": -112.1401
  },
  "containedInPlace": {
    "@type": "Park",
    "name": "Grand Canyon National Park"
  }
}
```

## Troubleshooting

### Import Failures

**Overpass API Rate Limiting**
- The import script includes automatic retry with exponential backoff
- Multiple Overpass endpoints are tried in sequence
- Add delays between park imports if needed

**PostGIS Errors**
- Ensure PostGIS extension is enabled: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Check geometry validity: `SELECT ST_IsValid(geometry) FROM trails;`

**Missing Trails**
- Verify park has valid coordinates
- Check Overpass query radius (default 5km)
- Some parks may have no OSM trail data

### Performance Issues

**Slow Map Loading**
- Trails are loaded as GeoJSON; large datasets may be slow
- Consider implementing vector tiles for parks with many trails
- Use spatial filtering to limit trails shown

**Slow API Responses**
- Ensure spatial indexes exist
- Use pagination for large result sets
- Consider caching frequently accessed trails

## Future Enhancements

- [ ] GPX download for trails
- [ ] Elevation profile visualization
- [ ] Trail conditions/closures
- [ ] User photos on trails
- [ ] Trail reviews and ratings
- [ ] Offline map support
- [ ] Vector tile generation for large datasets