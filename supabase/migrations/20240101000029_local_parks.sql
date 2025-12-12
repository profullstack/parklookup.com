-- Local Parks Schema (County & City Parks)
-- This migration adds tables for county and city parks from PAD-US

-- ============================================
-- Local Parks Table
-- Stores county and city parks from USGS PAD-US
-- ============================================
CREATE TABLE IF NOT EXISTS local_parks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  park_type VARCHAR(50) NOT NULL CHECK (park_type IN ('county', 'city', 'regional', 'municipal')),
  managing_agency VARCHAR(255),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  geometry GEOGRAPHY(GEOMETRY, 4326),
  access VARCHAR(50) DEFAULT 'Unknown' CHECK (access IN ('Open', 'Restricted', 'Unknown')),
  website VARCHAR(500),
  phone VARCHAR(50),
  address TEXT,
  description TEXT,
  amenities JSONB DEFAULT '[]',
  activities JSONB DEFAULT '[]',
  wikidata_id VARCHAR(20),
  padus_id VARCHAR(50),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(state_id, slug)
);

-- Create indexes for local_parks
CREATE INDEX IF NOT EXISTS idx_local_parks_slug ON local_parks(slug);
CREATE INDEX IF NOT EXISTS idx_local_parks_state_id ON local_parks(state_id);
CREATE INDEX IF NOT EXISTS idx_local_parks_county_id ON local_parks(county_id);
CREATE INDEX IF NOT EXISTS idx_local_parks_city_id ON local_parks(city_id);
CREATE INDEX IF NOT EXISTS idx_local_parks_park_type ON local_parks(park_type);
CREATE INDEX IF NOT EXISTS idx_local_parks_location ON local_parks USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_local_parks_geometry ON local_parks USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_local_parks_wikidata_id ON local_parks(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_local_parks_padus_id ON local_parks(padus_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_local_parks_search ON local_parks USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(managing_agency, ''))
);

-- ============================================
-- Park Photos Table
-- Stores photos from Wikimedia Commons and other sources
-- ============================================
CREATE TABLE IF NOT EXISTS park_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  park_id UUID NOT NULL REFERENCES local_parks(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL CHECK (source IN ('wikimedia', 'nps', 'user', 'other')),
  image_url TEXT NOT NULL,
  thumb_url TEXT,
  title VARCHAR(500),
  license VARCHAR(100),
  attribution TEXT,
  width INTEGER,
  height INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for park_photos
CREATE INDEX IF NOT EXISTS idx_park_photos_park_id ON park_photos(park_id);
CREATE INDEX IF NOT EXISTS idx_park_photos_source ON park_photos(source);
CREATE INDEX IF NOT EXISTS idx_park_photos_is_primary ON park_photos(is_primary);

-- ============================================
-- Triggers
-- ============================================

-- Update location from coordinates
CREATE TRIGGER update_local_parks_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON local_parks
  FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

-- Update timestamps
CREATE TRIGGER update_local_parks_updated_at
  BEFORE UPDATE ON local_parks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE local_parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE park_photos ENABLE ROW LEVEL SECURITY;

-- Public read access for local parks
CREATE POLICY "Local parks are viewable by everyone"
  ON local_parks FOR SELECT USING (true);

CREATE POLICY "Park photos are viewable by everyone"
  ON park_photos FOR SELECT USING (true);

-- Service role can manage all data
CREATE POLICY "Service role can manage local parks"
  ON local_parks FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage park photos"
  ON park_photos FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Views
-- ============================================

-- Local parks with state and county info
CREATE OR REPLACE VIEW local_parks_with_location AS
SELECT 
  lp.id,
  lp.name,
  lp.slug,
  lp.park_type,
  lp.managing_agency,
  lp.latitude,
  lp.longitude,
  lp.access,
  lp.website,
  lp.description,
  lp.amenities,
  lp.activities,
  lp.wikidata_id,
  lp.created_at,
  lp.updated_at,
  s.id AS state_id,
  s.code AS state_code,
  s.name AS state_name,
  s.slug AS state_slug,
  c.id AS county_id,
  c.name AS county_name,
  c.slug AS county_slug,
  ci.id AS city_id,
  ci.name AS city_name,
  ci.slug AS city_slug,
  (SELECT pp.thumb_url FROM park_photos pp WHERE pp.park_id = lp.id AND pp.is_primary = true LIMIT 1) AS primary_photo_url
FROM local_parks lp
JOIN states s ON lp.state_id = s.id
LEFT JOIN counties c ON lp.county_id = c.id
LEFT JOIN cities ci ON lp.city_id = ci.id;

-- Grant access to views
GRANT SELECT ON local_parks_with_location TO anon, authenticated;

-- ============================================
-- Updated all_parks view to include local parks
-- ============================================
CREATE OR REPLACE VIEW all_parks_unified AS
-- National Parks (NPS)
SELECT 
  np.id,
  np.park_code AS code,
  np.full_name AS name,
  np.park_code AS slug,
  'national' AS category,
  np.designation AS park_type,
  np.description,
  np.latitude,
  np.longitude,
  np.states AS state_codes,
  NULL::uuid AS state_id,
  NULL::uuid AS county_id,
  NULL::uuid AS city_id,
  np.url AS website,
  np.images,
  np.created_at,
  np.updated_at
FROM nps_parks np
UNION ALL
-- State Parks
SELECT 
  sp.id,
  sp.slug AS code,
  sp.name,
  sp.slug,
  'state' AS category,
  sp.park_type,
  sp.description,
  sp.latitude,
  sp.longitude,
  s.code AS state_codes,
  sp.state_id,
  sp.county_id,
  sp.city_id,
  sp.website,
  sp.images,
  sp.created_at,
  sp.updated_at
FROM state_parks sp
JOIN states s ON sp.state_id = s.id
UNION ALL
-- Local Parks (County & City)
SELECT 
  lp.id,
  lp.slug AS code,
  lp.name,
  lp.slug,
  'local' AS category,
  lp.park_type,
  lp.description,
  lp.latitude,
  lp.longitude,
  s.code AS state_codes,
  lp.state_id,
  lp.county_id,
  lp.city_id,
  lp.website,
  NULL::jsonb AS images,
  lp.created_at,
  lp.updated_at
FROM local_parks lp
JOIN states s ON lp.state_id = s.id;

-- Grant access to unified view
GRANT SELECT ON all_parks_unified TO anon, authenticated;

-- ============================================
-- Function to find nearby local parks
-- ============================================
CREATE OR REPLACE FUNCTION find_nearby_local_parks(
  lat DECIMAL,
  lng DECIMAL,
  radius_miles INTEGER DEFAULT 50,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  slug VARCHAR,
  park_type VARCHAR,
  managing_agency VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL,
  access VARCHAR,
  state_code VARCHAR,
  county_name VARCHAR,
  city_name VARCHAR,
  distance_miles DECIMAL,
  primary_photo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lp.id,
    lp.name,
    lp.slug,
    lp.park_type,
    lp.managing_agency,
    lp.latitude,
    lp.longitude,
    lp.access,
    s.code AS state_code,
    c.name AS county_name,
    ci.name AS city_name,
    ROUND((ST_Distance(
      lp.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1609.34)::numeric, 2) AS distance_miles,
    (SELECT pp.thumb_url FROM park_photos pp WHERE pp.park_id = lp.id AND pp.is_primary = true LIMIT 1) AS primary_photo_url
  FROM local_parks lp
  JOIN states s ON lp.state_id = s.id
  LEFT JOIN counties c ON lp.county_id = c.id
  LEFT JOIN cities ci ON lp.city_id = ci.id
  WHERE ST_DWithin(
    lp.location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_miles * 1609.34
  )
  ORDER BY ST_Distance(
    lp.location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  )
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_local_parks TO anon, authenticated;