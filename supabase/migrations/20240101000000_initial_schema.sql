-- ParkLookup.com Initial Database Schema
-- This migration creates the core tables for the application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- NPS Parks Table
-- Stores data from the National Park Service API
-- ============================================
CREATE TABLE IF NOT EXISTS nps_parks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  park_code VARCHAR(10) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  description TEXT,
  states VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  designation VARCHAR(100),
  url VARCHAR(500),
  weather_info TEXT,
  directions_info TEXT,
  directions_url VARCHAR(500),
  operating_hours JSONB,
  entrance_fees JSONB,
  entrance_passes JSONB,
  activities JSONB,
  topics JSONB,
  contacts JSONB,
  images JSONB,
  addresses JSONB,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for park_code lookups
CREATE INDEX IF NOT EXISTS idx_nps_parks_park_code ON nps_parks(park_code);

-- Create index for state filtering
CREATE INDEX IF NOT EXISTS idx_nps_parks_states ON nps_parks(states);

-- Create spatial index for location queries
CREATE INDEX IF NOT EXISTS idx_nps_parks_location ON nps_parks USING GIST(location);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_nps_parks_search ON nps_parks USING GIN(
  to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(description, ''))
);

-- ============================================
-- Wikidata Parks Table
-- Stores data from Wikidata SPARQL queries
-- ============================================
CREATE TABLE IF NOT EXISTS wikidata_parks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wikidata_id VARCHAR(20) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  state VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  image_url TEXT,
  website VARCHAR(500),
  area DECIMAL(20, 4),
  area_unit VARCHAR(50),
  elevation DECIMAL(10, 2),
  elevation_unit VARCHAR(50),
  inception DATE,
  managing_org VARCHAR(255),
  commons_category VARCHAR(255),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for wikidata_id lookups
CREATE INDEX IF NOT EXISTS idx_wikidata_parks_wikidata_id ON wikidata_parks(wikidata_id);

-- Create index for state filtering
CREATE INDEX IF NOT EXISTS idx_wikidata_parks_state ON wikidata_parks(state);

-- Create spatial index for location queries
CREATE INDEX IF NOT EXISTS idx_wikidata_parks_location ON wikidata_parks USING GIST(location);

-- ============================================
-- Park Links Table
-- Links NPS parks to Wikidata parks
-- ============================================
CREATE TABLE IF NOT EXISTS park_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nps_park_id UUID NOT NULL REFERENCES nps_parks(id) ON DELETE CASCADE,
  wikidata_park_id UUID NOT NULL REFERENCES wikidata_parks(id) ON DELETE CASCADE,
  confidence_score DECIMAL(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  match_method VARCHAR(50) NOT NULL DEFAULT 'name_location_similarity',
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nps_park_id, wikidata_park_id)
);

-- Create indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_park_links_nps_park_id ON park_links(nps_park_id);
CREATE INDEX IF NOT EXISTS idx_park_links_wikidata_park_id ON park_links(wikidata_park_id);

-- ============================================
-- User Profiles Table
-- Extends Supabase auth.users
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- User Favorites Table
-- Stores user's favorite parks
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nps_park_id UUID NOT NULL REFERENCES nps_parks(id) ON DELETE CASCADE,
  notes TEXT,
  visited BOOLEAN DEFAULT FALSE,
  visited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, nps_park_id)
);

-- Create indexes for favorites lookups
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_nps_park_id ON favorites(nps_park_id);

-- ============================================
-- Import Logs Table
-- Tracks data import history
-- ============================================
CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50) NOT NULL, -- 'nps' or 'wikidata'
  status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create index for import log queries
CREATE INDEX IF NOT EXISTS idx_import_logs_source ON import_logs(source);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON import_logs(status);
CREATE INDEX IF NOT EXISTS idx_import_logs_started_at ON import_logs(started_at DESC);

-- ============================================
-- Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update location from lat/lng
CREATE OR REPLACE FUNCTION update_location_from_coords()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Triggers for updated_at
CREATE TRIGGER update_nps_parks_updated_at
  BEFORE UPDATE ON nps_parks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wikidata_parks_updated_at
  BEFORE UPDATE ON wikidata_parks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_park_links_updated_at
  BEFORE UPDATE ON park_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorites_updated_at
  BEFORE UPDATE ON favorites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for location updates
CREATE TRIGGER update_nps_parks_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON nps_parks
  FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

CREATE TRIGGER update_wikidata_parks_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON wikidata_parks
  FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE nps_parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wikidata_parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE park_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for parks data
CREATE POLICY "Parks are viewable by everyone"
  ON nps_parks FOR SELECT
  USING (true);

CREATE POLICY "Wikidata parks are viewable by everyone"
  ON wikidata_parks FOR SELECT
  USING (true);

CREATE POLICY "Park links are viewable by everyone"
  ON park_links FOR SELECT
  USING (true);

-- Profile policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Favorites policies
CREATE POLICY "Users can view their own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorites"
  ON favorites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Import logs - only service role can access
CREATE POLICY "Import logs are only accessible by service role"
  ON import_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Service Role Policies for Data Import
-- ============================================

-- Allow service role to manage parks data
CREATE POLICY "Service role can manage NPS parks"
  ON nps_parks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage Wikidata parks"
  ON wikidata_parks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage park links"
  ON park_links FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Views
-- ============================================

-- Combined parks view with linked data
CREATE OR REPLACE VIEW parks_combined AS
SELECT 
  np.id,
  np.park_code,
  np.full_name,
  np.description,
  np.states,
  np.latitude,
  np.longitude,
  np.designation,
  np.url,
  np.weather_info,
  np.images,
  np.activities,
  np.operating_hours,
  np.entrance_fees,
  wp.wikidata_id,
  wp.image_url AS wikidata_image,
  wp.area,
  wp.area_unit,
  wp.elevation,
  wp.elevation_unit,
  wp.inception,
  wp.managing_org,
  wp.commons_category,
  pl.confidence_score AS link_confidence
FROM nps_parks np
LEFT JOIN park_links pl ON np.id = pl.nps_park_id
LEFT JOIN wikidata_parks wp ON pl.wikidata_park_id = wp.id;

-- Grant access to the view
GRANT SELECT ON parks_combined TO anon, authenticated;