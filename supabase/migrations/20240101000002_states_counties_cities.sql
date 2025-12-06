-- States, Counties, and Cities Schema
-- This migration adds tables for geographic organization of parks

-- ============================================
-- States Table
-- ============================================
CREATE TABLE IF NOT EXISTS states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  park_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_states_code ON states(code);
CREATE INDEX IF NOT EXISTS idx_states_slug ON states(slug);
CREATE INDEX IF NOT EXISTS idx_states_location ON states USING GIST(location);

-- ============================================
-- Counties Table
-- ============================================
CREATE TABLE IF NOT EXISTS counties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  fips_code VARCHAR(5),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  park_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(state_id, slug)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_counties_state_id ON counties(state_id);
CREATE INDEX IF NOT EXISTS idx_counties_slug ON counties(slug);
CREATE INDEX IF NOT EXISTS idx_counties_location ON counties USING GIST(location);

-- ============================================
-- Cities Table
-- ============================================
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  county_id UUID NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  population INTEGER,
  park_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(county_id, slug)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cities_county_id ON cities(county_id);
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON cities(state_id);
CREATE INDEX IF NOT EXISTS idx_cities_slug ON cities(slug);
CREATE INDEX IF NOT EXISTS idx_cities_location ON cities USING GIST(location);

-- ============================================
-- State Parks Table (for state-level parks)
-- ============================================
CREATE TABLE IF NOT EXISTS state_parks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  website VARCHAR(500),
  phone VARCHAR(50),
  address TEXT,
  park_type VARCHAR(100), -- 'state_park', 'state_forest', 'state_beach', etc.
  amenities JSONB DEFAULT '[]',
  activities JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  operating_hours JSONB,
  entrance_fees JSONB,
  wikidata_id VARCHAR(20),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(state_id, slug)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_state_parks_state_id ON state_parks(state_id);
CREATE INDEX IF NOT EXISTS idx_state_parks_county_id ON state_parks(county_id);
CREATE INDEX IF NOT EXISTS idx_state_parks_city_id ON state_parks(city_id);
CREATE INDEX IF NOT EXISTS idx_state_parks_slug ON state_parks(slug);
CREATE INDEX IF NOT EXISTS idx_state_parks_location ON state_parks USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_state_parks_park_type ON state_parks(park_type);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_state_parks_search ON state_parks USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- ============================================
-- Park-Location Junction Table
-- Links NPS parks to states/counties/cities
-- ============================================
CREATE TABLE IF NOT EXISTS nps_park_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nps_park_id UUID NOT NULL REFERENCES nps_parks(id) ON DELETE CASCADE,
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nps_park_id, state_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_nps_park_locations_nps_park_id ON nps_park_locations(nps_park_id);
CREATE INDEX IF NOT EXISTS idx_nps_park_locations_state_id ON nps_park_locations(state_id);
CREATE INDEX IF NOT EXISTS idx_nps_park_locations_county_id ON nps_park_locations(county_id);
CREATE INDEX IF NOT EXISTS idx_nps_park_locations_city_id ON nps_park_locations(city_id);

-- ============================================
-- Triggers
-- ============================================

-- Update location from coordinates
CREATE TRIGGER update_states_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON states
  FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

CREATE TRIGGER update_counties_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON counties
  FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

CREATE TRIGGER update_cities_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON cities
  FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

CREATE TRIGGER update_state_parks_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON state_parks
  FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

-- Update timestamps
CREATE TRIGGER update_states_updated_at
  BEFORE UPDATE ON states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counties_updated_at
  BEFORE UPDATE ON counties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cities_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_state_parks_updated_at
  BEFORE UPDATE ON state_parks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_park_locations ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "States are viewable by everyone"
  ON states FOR SELECT USING (true);

CREATE POLICY "Counties are viewable by everyone"
  ON counties FOR SELECT USING (true);

CREATE POLICY "Cities are viewable by everyone"
  ON cities FOR SELECT USING (true);

CREATE POLICY "State parks are viewable by everyone"
  ON state_parks FOR SELECT USING (true);

CREATE POLICY "Park locations are viewable by everyone"
  ON nps_park_locations FOR SELECT USING (true);

-- Service role can manage all data
CREATE POLICY "Service role can manage states"
  ON states FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage counties"
  ON counties FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage cities"
  ON cities FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage state parks"
  ON state_parks FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage park locations"
  ON nps_park_locations FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Seed Data: U.S. States
-- ============================================
INSERT INTO states (code, name, slug, latitude, longitude) VALUES
  ('AL', 'Alabama', 'alabama', 32.3182, -86.9023),
  ('AK', 'Alaska', 'alaska', 64.2008, -152.4937),
  ('AZ', 'Arizona', 'arizona', 34.0489, -111.0937),
  ('AR', 'Arkansas', 'arkansas', 35.2010, -91.8318),
  ('CA', 'California', 'california', 36.7783, -119.4179),
  ('CO', 'Colorado', 'colorado', 39.5501, -105.7821),
  ('CT', 'Connecticut', 'connecticut', 41.6032, -73.0877),
  ('DE', 'Delaware', 'delaware', 38.9108, -75.5277),
  ('FL', 'Florida', 'florida', 27.6648, -81.5158),
  ('GA', 'Georgia', 'georgia', 32.1656, -82.9001),
  ('HI', 'Hawaii', 'hawaii', 19.8968, -155.5828),
  ('ID', 'Idaho', 'idaho', 44.0682, -114.7420),
  ('IL', 'Illinois', 'illinois', 40.6331, -89.3985),
  ('IN', 'Indiana', 'indiana', 40.2672, -86.1349),
  ('IA', 'Iowa', 'iowa', 41.8780, -93.0977),
  ('KS', 'Kansas', 'kansas', 39.0119, -98.4842),
  ('KY', 'Kentucky', 'kentucky', 37.8393, -84.2700),
  ('LA', 'Louisiana', 'louisiana', 30.9843, -91.9623),
  ('ME', 'Maine', 'maine', 45.2538, -69.4455),
  ('MD', 'Maryland', 'maryland', 39.0458, -76.6413),
  ('MA', 'Massachusetts', 'massachusetts', 42.4072, -71.3824),
  ('MI', 'Michigan', 'michigan', 44.3148, -85.6024),
  ('MN', 'Minnesota', 'minnesota', 46.7296, -94.6859),
  ('MS', 'Mississippi', 'mississippi', 32.3547, -89.3985),
  ('MO', 'Missouri', 'missouri', 37.9643, -91.8318),
  ('MT', 'Montana', 'montana', 46.8797, -110.3626),
  ('NE', 'Nebraska', 'nebraska', 41.4925, -99.9018),
  ('NV', 'Nevada', 'nevada', 38.8026, -116.4194),
  ('NH', 'New Hampshire', 'new-hampshire', 43.1939, -71.5724),
  ('NJ', 'New Jersey', 'new-jersey', 40.0583, -74.4057),
  ('NM', 'New Mexico', 'new-mexico', 34.5199, -105.8701),
  ('NY', 'New York', 'new-york', 43.2994, -74.2179),
  ('NC', 'North Carolina', 'north-carolina', 35.7596, -79.0193),
  ('ND', 'North Dakota', 'north-dakota', 47.5515, -101.0020),
  ('OH', 'Ohio', 'ohio', 40.4173, -82.9071),
  ('OK', 'Oklahoma', 'oklahoma', 35.0078, -97.0929),
  ('OR', 'Oregon', 'oregon', 43.8041, -120.5542),
  ('PA', 'Pennsylvania', 'pennsylvania', 41.2033, -77.1945),
  ('RI', 'Rhode Island', 'rhode-island', 41.5801, -71.4774),
  ('SC', 'South Carolina', 'south-carolina', 33.8361, -81.1637),
  ('SD', 'South Dakota', 'south-dakota', 43.9695, -99.9018),
  ('TN', 'Tennessee', 'tennessee', 35.5175, -86.5804),
  ('TX', 'Texas', 'texas', 31.9686, -99.9018),
  ('UT', 'Utah', 'utah', 39.3210, -111.0937),
  ('VT', 'Vermont', 'vermont', 44.5588, -72.5778),
  ('VA', 'Virginia', 'virginia', 37.4316, -78.6569),
  ('WA', 'Washington', 'washington', 47.7511, -120.7401),
  ('WV', 'West Virginia', 'west-virginia', 38.5976, -80.4549),
  ('WI', 'Wisconsin', 'wisconsin', 43.7844, -88.7879),
  ('WY', 'Wyoming', 'wyoming', 43.0759, -107.2903),
  ('DC', 'District of Columbia', 'district-of-columbia', 38.9072, -77.0369),
  ('PR', 'Puerto Rico', 'puerto-rico', 18.2208, -66.5901),
  ('VI', 'U.S. Virgin Islands', 'us-virgin-islands', 18.3358, -64.8963),
  ('GU', 'Guam', 'guam', 13.4443, 144.7937),
  ('AS', 'American Samoa', 'american-samoa', -14.2710, -170.1322),
  ('MP', 'Northern Mariana Islands', 'northern-mariana-islands', 15.0979, 145.6739)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- Views
-- ============================================

-- Parks by state view
CREATE OR REPLACE VIEW parks_by_state AS
SELECT 
  s.id AS state_id,
  s.code AS state_code,
  s.name AS state_name,
  s.slug AS state_slug,
  np.id AS park_id,
  np.park_code,
  np.full_name,
  np.description,
  np.latitude,
  np.longitude,
  np.designation,
  np.images
FROM states s
LEFT JOIN nps_park_locations npl ON s.id = npl.state_id
LEFT JOIN nps_parks np ON npl.nps_park_id = np.id
ORDER BY s.name, np.full_name;

-- State parks combined view
CREATE OR REPLACE VIEW all_parks_by_state AS
SELECT 
  s.id AS state_id,
  s.code AS state_code,
  s.name AS state_name,
  s.slug AS state_slug,
  'national' AS park_category,
  np.id AS park_id,
  np.park_code AS park_code,
  np.full_name AS park_name,
  np.description,
  np.latitude,
  np.longitude,
  np.designation AS park_type,
  np.images
FROM states s
LEFT JOIN nps_park_locations npl ON s.id = npl.state_id
LEFT JOIN nps_parks np ON npl.nps_park_id = np.id
WHERE np.id IS NOT NULL
UNION ALL
SELECT 
  s.id AS state_id,
  s.code AS state_code,
  s.name AS state_name,
  s.slug AS state_slug,
  'state' AS park_category,
  sp.id AS park_id,
  sp.slug AS park_code,
  sp.name AS park_name,
  sp.description,
  sp.latitude,
  sp.longitude,
  sp.park_type,
  sp.images
FROM states s
LEFT JOIN state_parks sp ON s.id = sp.state_id
WHERE sp.id IS NOT NULL
ORDER BY state_name, park_name;

-- Grant access to views
GRANT SELECT ON parks_by_state TO anon, authenticated;
GRANT SELECT ON all_parks_by_state TO anon, authenticated;