# BLM Land Lookup & Mapping

This document describes the BLM (Bureau of Land Management) land lookup and mapping feature for ParkLookup.

## Overview

ParkLookup now includes BLM land boundaries, enabling users to discover millions of acres of publicly accessible land used for:

- Dispersed camping
- Hiking
- Off-grid recreation
- OHV (Off-Highway Vehicle) use
- Hunting & fishing

## Data Source

### Primary Dataset

**BLM / DOI – Surface Management Agency (SMA)**
Provided via **USGS National Map**

- **Coverage**: Nationwide BLM-managed lands
- **License**: Public Domain (commercial use allowed)
- **Update cadence**: Periodic (stable, non-real-time)

### Data Fields

| Field | Description |
|-------|-------------|
| `unit_name` | Name of the BLM unit/area |
| `managing_agency` | Always "Bureau of Land Management" |
| `state` | US state where the land is located |
| `geometry` | MultiPolygon boundary in WGS84 (EPSG:4326) |
| `area_acres` | Calculated area in acres |
| `centroid_lat` | Latitude of polygon centroid |
| `centroid_lng` | Longitude of polygon centroid |

## Database Schema

### Table: `blm_lands`

```sql
create table blm_lands (
  id uuid primary key default gen_random_uuid(),
  source text default 'blm',
  unit_name text,
  managing_agency text default 'Bureau of Land Management',
  state text,
  geometry geometry(MultiPolygon, 4326),
  area_acres numeric,
  centroid_lat numeric,
  centroid_lng numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Indexes

- `blm_lands_geom_idx` - GiST index on geometry for spatial queries
- `blm_lands_state_idx` - B-tree index on state for filtering
- `blm_lands_centroid_idx` - GiST index on centroid point for proximity queries

### Helper Functions

- `find_blm_near_park(p_park_id, p_park_source, p_radius_meters)` - Find BLM lands near a park
- `find_nearby_blm(p_lat, p_lng, p_radius_meters, p_limit)` - Find BLM lands near coordinates
- `get_blm_with_geojson(p_blm_id)` - Get BLM land with GeoJSON geometry

## Import Pipeline

### Prerequisites

1. **GDAL** installed for data conversion
2. **GeoJSON file** from USGS National Map SMA dataset

### Download Dataset

1. Visit [USGS National Map](https://apps.nationalmap.gov/downloader/)
2. Download Surface Management Agency (SMA) dataset
3. Convert to GeoJSON using GDAL:

```bash
ogr2ogr -f GeoJSON blm.geojson SMA_National.gpkg
```

### Import Command

```bash
# Import all BLM lands from GeoJSON
pnpm run import:blm --file ./data/blm.geojson

# Import specific state
pnpm run import:blm --file ./data/blm.geojson --state CA

# Dry run (no database changes)
pnpm run import:blm --file ./data/blm.geojson --dry-run

# Truncate existing data before import
pnpm run import:blm --file ./data/blm.geojson --truncate

# Limit number of records
pnpm run import:blm --file ./data/blm.geojson --limit 1000
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--file` | Path to GeoJSON file (required) |
| `--state` | Filter by state code (e.g., CA, NV) |
| `--limit` | Maximum records to import |
| `--skip` | Number of records to skip |
| `--dry-run` | Preview without database changes |
| `--truncate` | Clear existing data before import |

## API Endpoints

### List BLM Lands

```
GET /api/blm
```

Query parameters:
- `state` - Filter by state
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset

Response:
```json
{
  "blmLands": [
    {
      "id": "uuid",
      "unitName": "Example BLM Area",
      "managingAgency": "Bureau of Land Management",
      "state": "CA",
      "areaAcres": 50000,
      "centroidLat": 36.5,
      "centroidLng": -117.5
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Get BLM Land Details

```
GET /api/blm/[id]
```

Response includes full GeoJSON geometry.

### Get Nearby BLM Lands for Park

```
GET /api/parks/[parkCode]/blm
```

Query parameters:
- `radius` - Search radius in meters (default: 50000)
- `limit` - Number of results (default: 10)

Response:
```json
{
  "blmLands": [...],
  "park": {
    "id": "uuid",
    "name": "Park Name",
    "parkCode": "PARK"
  },
  "searchRadius": 50000
}
```

## Frontend Components

### BLMCard

Displays a single BLM land area with:
- Unit name
- State
- Area in acres
- Distance from reference point (if provided)

### BLMList

Lists BLM lands with:
- State filter dropdown
- Loading states
- Empty state handling

### BLMMap

MapLibre GL map component showing:
- BLM land polygons with tan/amber fill
- Hover popups with land details
- Click handlers for selection

### ParkBLMSection

Park page section showing:
- Nearby BLM lands map
- List of nearby BLM areas
- Disclaimer about dispersed recreation

## Map Styling

BLM lands are displayed with:
- **Fill color**: `rgba(217, 119, 6, 0.2)` (amber with transparency)
- **Stroke color**: `rgba(217, 119, 6, 0.8)` (amber)
- **Stroke width**: 2px

The BLM layer is rendered below trail layers to avoid obscuring trail lines.

## Trail Map Integration

The TrailMap component includes a BLM land toggle:
- Toggle button in top-left corner
- Loads BLM lands on demand when enabled
- Shows BLM legend when active

Enable by passing props:
```jsx
<TrailMap
  trails={trails}
  showBLMToggle={true}
  parkCode="PARK"
/>
```

## Security

- **Public read access** via Row Level Security
- **Admin-only imports** (requires service role key)

## Disclaimers

BLM land pages include important disclaimers:
- "No developed facilities"
- "Rules vary by district"
- "Dispersed recreation common"
- "Check local regulations before visiting"

## Phase 2 Features (Implemented)

### SEO Landing Pages

#### `/blm` - Main BLM Landing Page

The main BLM landing page provides:
- Overview statistics (total areas, acres, states)
- "What is BLM Land?" educational content
- Browse by state links
- Featured largest BLM areas
- SEO-optimized content for dispersed camping keywords

#### `/blm/[state]` - State-Specific Pages

Each state page includes:
- State-specific statistics
- Interactive map with BLM land polygons
- List of BLM areas sorted by size
- State-specific camping guidelines
- Links to official BLM state offices

Supported states: AK, AZ, CA, CO, ID, MT, NV, NM, OR, UT, WA, WY

### AI Trip Planning Integration

The trip generator now supports BLM land recommendations:

**New Interests:**
- `dispersed_camping`
- `off_grid`
- `boondocking`

**Enhanced Trip Output:**
- `nearby_blm_camping` field in daily schedule
- `blm_camping_tips` array with dispersed camping advice
- `blm_camping_savings` in budget estimates

**Usage:**
```javascript
import { generateTrip, prepareBLMLandsForPrompt } from '@/lib/ai/trip-generator';

const tripData = await generateTrip({
  origin: 'Las Vegas, NV',
  startDate: '2024-06-01',
  endDate: '2024-06-05',
  interests: ['hiking', 'dispersed_camping', 'photography'],
  difficulty: 'moderate',
  radiusMiles: 200,
  parks: parksData,
  blmLands: prepareBLMLandsForPrompt(blmLandsData),
});
```

## Future Enhancements (Phase 3)

- Fire restriction integration
- OHV land layers
- Permit/fee references
- User trip reports on BLM land
- Campsite recommendations within BLM areas

## Troubleshooting

### Import Issues

**Large file handling**: For very large GeoJSON files, use `--limit` and `--skip` to import in batches.

**Memory issues**: The import script processes records in batches of 100 to manage memory.

**Geometry errors**: Invalid geometries are logged and skipped during import.

### Map Performance

**Slow rendering**: BLM polygons are simplified using `ST_Simplify(geometry, 0.001)` for API responses.

**Missing polygons**: Ensure PostGIS extension is enabled and spatial indexes exist.

## Related Documentation

- [TRAILS.md](./TRAILS.md) - Trail data documentation
- [DATABASE.md](./DATABASE.md) - Database schema overview
- [API.md](./API.md) - API reference