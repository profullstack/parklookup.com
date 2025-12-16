-- Migration: BLM Lands table for Bureau of Land Management land boundaries
-- Data source: USGS National Map - Surface Management Agency dataset
-- This migration creates the blm_lands table with PostGIS MultiPolygon geometry support

-- ============================================
-- BLM Lands Table
-- Stores BLM land boundaries from USGS National Map SMA dataset
-- ============================================
CREATE TABLE IF NOT EXISTS blm_lands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source TEXT NOT NULL DEFAULT 'blm',
  source_id TEXT,                      -- Original ID from SMA dataset (OBJECTID or FID)
  
  -- Land information
  unit_name TEXT,                      -- Name of the BLM unit/area
  managing_agency TEXT DEFAULT 'Bureau of Land Management',
  state TEXT,                          -- State abbreviation (e.g., 'CA', 'NV', 'UT')
  
  -- Geometry (MultiPolygon for land boundaries - handles complex BLM units)
  geometry GEOMETRY(MultiPolygon, 4326),
  
  -- Computed fields
  area_acres NUMERIC,                  -- Calculated from geometry
  centroid_lat NUMERIC,                -- Centroid latitude for indexing
  centroid_lng NUMERIC,                -- Centroid longitude for indexing
  
  -- Metadata
  raw_data JSONB,                      -- Original SMA attributes for reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Spatial index for geometry queries (most important for performance)
CREATE INDEX IF NOT EXISTS blm_lands_geom_idx ON blm_lands USING GIST (geometry);

-- Index for state filtering
CREATE INDEX IF NOT EXISTS blm_lands_state_idx ON blm_lands(state);

-- Index for source lookups (for upserts)
CREATE INDEX IF NOT EXISTS blm_lands_source_idx ON blm_lands(source, source_id);

-- Unique constraint for upserts based on source_id and state
-- This allows proper ON CONFLICT handling for incremental imports
CREATE UNIQUE INDEX IF NOT EXISTS blm_lands_source_state_idx ON blm_lands(source_id, state) WHERE source_id IS NOT NULL AND state IS NOT NULL;

-- Index for centroid-based queries
CREATE INDEX IF NOT EXISTS blm_lands_centroid_idx ON blm_lands(centroid_lat, centroid_lng);

-- Full-text search on unit name
CREATE INDEX IF NOT EXISTS blm_lands_search_idx ON blm_lands USING GIN(
  to_tsvector('english', coalesce(unit_name, ''))
);

-- ============================================
-- Triggers
-- ============================================

-- Update updated_at timestamp on changes
CREATE TRIGGER update_blm_lands_updated_at
  BEFORE UPDATE ON blm_lands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE blm_lands ENABLE ROW LEVEL SECURITY;

-- Public read access for all BLM lands
CREATE POLICY "BLM lands are viewable by everyone"
  ON blm_lands FOR SELECT USING (true);

-- Service role can manage all BLM lands (for import scripts)
CREATE POLICY "Service role can manage BLM lands"
  ON blm_lands FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Functions
-- ============================================

-- Function to find BLM lands near a park
-- Uses spatial distance calculation with configurable radius
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
    SELECT location INTO park_location FROM nps_parks WHERE nps_parks.id = p_park_id;
  ELSIF p_park_source = 'wikidata' THEN
    SELECT location INTO park_location FROM wikidata_parks WHERE wikidata_parks.id = p_park_id;
  ELSIF p_park_source = 'local' THEN
    SELECT location INTO park_location FROM local_parks WHERE local_parks.id = p_park_id;
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_blm_near_park TO anon, authenticated;

-- Function to find BLM lands near a point (for map views and general queries)
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_blm TO anon, authenticated;

-- Function to get BLM land with full GeoJSON geometry
CREATE OR REPLACE FUNCTION get_blm_with_geojson(blm_id UUID)
RETURNS TABLE (
  id UUID,
  source TEXT,
  source_id TEXT,
  unit_name TEXT,
  managing_agency TEXT,
  state TEXT,
  area_acres NUMERIC,
  centroid_lat NUMERIC,
  centroid_lng NUMERIC,
  geometry_geojson TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.source,
    b.source_id,
    b.unit_name,
    b.managing_agency,
    b.state,
    b.area_acres,
    b.centroid_lat,
    b.centroid_lng,
    ST_AsGeoJSON(b.geometry)::TEXT AS geometry_geojson,
    b.created_at,
    b.updated_at
  FROM blm_lands b
  WHERE b.id = blm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_blm_with_geojson TO anon, authenticated;

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_trails_on_blm TO anon, authenticated;

-- Function to find parks near BLM land
CREATE OR REPLACE FUNCTION find_parks_near_blm(
  blm_id UUID,
  radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE (
  id UUID,
  park_code TEXT,
  full_name TEXT,
  source TEXT,
  distance_meters DECIMAL
) AS $$
DECLARE
  blm_centroid GEOGRAPHY;
BEGIN
  -- Get BLM land centroid
  SELECT ST_Centroid(geometry)::geography INTO blm_centroid
  FROM blm_lands WHERE blm_lands.id = blm_id;
  
  IF blm_centroid IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    ap.id,
    ap.park_code,
    ap.full_name,
    ap.source,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(ap.longitude, ap.latitude), 4326)::geography,
      blm_centroid
    )::DECIMAL AS distance_meters
  FROM all_parks ap
  WHERE ap.latitude IS NOT NULL 
    AND ap.longitude IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(ap.longitude, ap.latitude), 4326)::geography,
      blm_centroid,
      radius_meters
    )
  ORDER BY distance_meters
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_parks_near_blm TO anon, authenticated;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE blm_lands IS 'Bureau of Land Management land boundaries from USGS National Map Surface Management Agency dataset. Used for dispersed camping, off-grid recreation, and public land access information.';
COMMENT ON COLUMN blm_lands.source IS 'Data source identifier, always "blm" for this table';
COMMENT ON COLUMN blm_lands.source_id IS 'Original ID from the SMA dataset (OBJECTID or FID)';
COMMENT ON COLUMN blm_lands.unit_name IS 'Name of the BLM unit or administrative area';
COMMENT ON COLUMN blm_lands.managing_agency IS 'Managing agency, always "Bureau of Land Management" for this table';
COMMENT ON COLUMN blm_lands.state IS 'Two-letter state abbreviation where the BLM land is located';
COMMENT ON COLUMN blm_lands.geometry IS 'MultiPolygon boundary in WGS84 (EPSG:4326)';
COMMENT ON COLUMN blm_lands.area_acres IS 'Calculated area in acres from geometry';
COMMENT ON COLUMN blm_lands.centroid_lat IS 'Latitude of geometry centroid for quick distance calculations';
COMMENT ON COLUMN blm_lands.centroid_lng IS 'Longitude of geometry centroid for quick distance calculations';
COMMENT ON COLUMN blm_lands.raw_data IS 'Original SMA dataset attributes stored as JSONB for reference';