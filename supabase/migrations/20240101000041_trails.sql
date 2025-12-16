-- Migration: Trails table for hiking trail data from OSM
-- This migration creates the trails table with PostGIS geometry support

-- ============================================
-- Trails Table
-- Stores hiking trail data from OpenStreetMap and other sources
-- ============================================
CREATE TABLE IF NOT EXISTS trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('osm', 'usfs', 'usgs', 'user')),
  source_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  
  -- Park association (references all_parks view via id + source)
  park_id UUID,
  park_source TEXT CHECK (park_source IN ('nps', 'wikidata', 'local')),
  
  -- Trail information
  name TEXT,
  description TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  length_meters NUMERIC,
  elevation_gain_m NUMERIC,
  surface TEXT,                         -- paved | gravel | dirt | rock | mixed
  trail_type TEXT,                      -- loop | out-and-back | point-to-point
  
  -- OSM-specific fields
  sac_scale TEXT,                       -- hiking | mountain_hiking | demanding_mountain_hiking | alpine_hiking | demanding_alpine_hiking | difficult_alpine_hiking
  trail_visibility TEXT,                -- excellent | good | intermediate | bad | horrible | no
  osm_tags JSONB,                       -- Raw OSM tags for reference
  
  -- Geometry (LineString for trail path)
  geometry GEOMETRY(LineString, 4326),
  
  -- Metadata
  is_user_submitted BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint on source + source_id
  UNIQUE(source, source_id)
);

-- ============================================
-- Indexes
-- ============================================

-- Spatial index for geometry queries (most important for performance)
CREATE INDEX IF NOT EXISTS trails_geom_idx ON trails USING GIST (geometry);

-- Index for park lookups
CREATE INDEX IF NOT EXISTS trails_park_idx ON trails(park_id, park_source);

-- Index for filtering by difficulty
CREATE INDEX IF NOT EXISTS trails_difficulty_idx ON trails(difficulty);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS trails_slug_idx ON trails(slug);

-- Index for source filtering
CREATE INDEX IF NOT EXISTS trails_source_idx ON trails(source);

-- Index for last_seen_at (for cleanup of stale trails)
CREATE INDEX IF NOT EXISTS trails_last_seen_idx ON trails(last_seen_at);

-- Full-text search index
CREATE INDEX IF NOT EXISTS trails_search_idx ON trails USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- ============================================
-- Triggers
-- ============================================

-- Update updated_at timestamp on changes
CREATE TRIGGER update_trails_updated_at
  BEFORE UPDATE ON trails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE trails ENABLE ROW LEVEL SECURITY;

-- Public read access for all trails
CREATE POLICY "Trails are viewable by everyone"
  ON trails FOR SELECT USING (true);

-- Service role can manage all trails (for import scripts)
CREATE POLICY "Service role can manage trails"
  ON trails FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Functions
-- ============================================

-- Function to find trails within a park's bounding box
-- Uses spatial intersection with park location/geometry
CREATE OR REPLACE FUNCTION find_trails_for_park(
  p_park_id UUID,
  p_park_source TEXT,
  p_radius_meters INTEGER DEFAULT 5000
)
RETURNS SETOF trails AS $$
DECLARE
  park_location GEOGRAPHY;
  park_geom GEOMETRY;
BEGIN
  -- Get park location based on source
  IF p_park_source = 'nps' THEN
    SELECT location INTO park_location FROM nps_parks WHERE id = p_park_id;
  ELSIF p_park_source = 'wikidata' THEN
    SELECT location INTO park_location FROM wikidata_parks WHERE id = p_park_id;
  ELSIF p_park_source = 'local' THEN
    -- Local parks may have geometry (polygon) or just location (point)
    SELECT geometry INTO park_geom FROM local_parks WHERE id = p_park_id;
    IF park_geom IS NULL THEN
      SELECT location INTO park_location FROM local_parks WHERE id = p_park_id;
    END IF;
  END IF;
  
  -- Return trails that intersect with park geometry or are within radius of park point
  IF park_geom IS NOT NULL THEN
    -- Use geometry intersection for parks with polygon boundaries
    RETURN QUERY
    SELECT t.*
    FROM trails t
    WHERE ST_Intersects(t.geometry, park_geom::geometry)
       OR t.park_id = p_park_id
    ORDER BY t.name;
  ELSIF park_location IS NOT NULL THEN
    -- Use radius search for parks with only point location
    RETURN QUERY
    SELECT t.*
    FROM trails t
    WHERE ST_DWithin(t.geometry::geography, park_location, p_radius_meters)
       OR t.park_id = p_park_id
    ORDER BY ST_Distance(t.geometry::geography, park_location), t.name;
  ELSE
    -- Fallback: return trails explicitly linked to this park
    RETURN QUERY
    SELECT t.*
    FROM trails t
    WHERE t.park_id = p_park_id
    ORDER BY t.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_trails_for_park TO anon, authenticated;

-- Function to find trails near a point (for map views)
CREATE OR REPLACE FUNCTION find_nearby_trails(
  lat DECIMAL,
  lng DECIMAL,
  radius_meters INTEGER DEFAULT 50000,
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  difficulty TEXT,
  length_meters NUMERIC,
  elevation_gain_m NUMERIC,
  surface TEXT,
  trail_type TEXT,
  park_id UUID,
  park_source TEXT,
  distance_meters DECIMAL,
  geometry_geojson TEXT
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
    t.trail_type,
    t.park_id,
    t.park_source,
    ST_Distance(
      t.geometry::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    )::DECIMAL AS distance_meters,
    ST_AsGeoJSON(t.geometry)::TEXT AS geometry_geojson
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_trails TO anon, authenticated;

-- Function to get trail with GeoJSON geometry
CREATE OR REPLACE FUNCTION get_trail_with_geojson(trail_id UUID)
RETURNS TABLE (
  id UUID,
  source TEXT,
  source_id TEXT,
  slug TEXT,
  park_id UUID,
  park_source TEXT,
  name TEXT,
  description TEXT,
  difficulty TEXT,
  length_meters NUMERIC,
  elevation_gain_m NUMERIC,
  surface TEXT,
  trail_type TEXT,
  sac_scale TEXT,
  geometry_geojson TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.source,
    t.source_id,
    t.slug,
    t.park_id,
    t.park_source,
    t.name,
    t.description,
    t.difficulty,
    t.length_meters,
    t.elevation_gain_m,
    t.surface,
    t.trail_type,
    t.sac_scale,
    ST_AsGeoJSON(t.geometry)::TEXT AS geometry_geojson,
    t.created_at,
    t.updated_at
  FROM trails t
  WHERE t.id = trail_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_trail_with_geojson TO anon, authenticated;

-- ============================================
-- View: trails_with_park
-- Joins trails with park information from all_parks
-- ============================================
CREATE OR REPLACE VIEW trails_with_park AS
SELECT 
  t.id,
  t.source,
  t.source_id,
  t.slug,
  t.name,
  t.description,
  t.difficulty,
  t.length_meters,
  t.elevation_gain_m,
  t.surface,
  t.trail_type,
  t.sac_scale,
  t.park_id,
  t.park_source,
  t.is_user_submitted,
  t.created_at,
  t.updated_at,
  ST_AsGeoJSON(t.geometry)::TEXT AS geometry_geojson,
  -- Park info (will be NULL if no park association)
  ap.park_code AS park_code,
  ap.full_name AS park_name,
  ap.states AS park_states,
  ap.designation AS park_designation
FROM trails t
LEFT JOIN all_parks ap ON t.park_id = ap.id AND t.park_source = ap.source;

-- Grant access to the view
GRANT SELECT ON trails_with_park TO anon, authenticated;

-- Add comment explaining the table
COMMENT ON TABLE trails IS 'Hiking trails imported from OpenStreetMap and other sources, associated with parks via spatial intersection or explicit linking.';
COMMENT ON COLUMN trails.source IS 'Data source: osm (OpenStreetMap), usfs (US Forest Service), usgs (US Geological Survey), user (user submitted)';
COMMENT ON COLUMN trails.difficulty IS 'Trail difficulty: easy, moderate, hard - computed from sac_scale, length, and elevation gain';
COMMENT ON COLUMN trails.sac_scale IS 'SAC hiking scale from OSM: hiking, mountain_hiking, demanding_mountain_hiking, alpine_hiking, demanding_alpine_hiking, difficult_alpine_hiking';