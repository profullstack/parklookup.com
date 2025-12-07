-- Migration: Add nearby places tables for dining, entertainment, etc.
-- Uses ValueSERP API to find places near parks

-- Create place categories enum
CREATE TYPE place_category AS ENUM ('dining', 'entertainment', 'bars', 'lodging', 'shopping', 'attractions');

-- Create nearby_places table to store places found near parks
CREATE TABLE IF NOT EXISTS nearby_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ValueSERP identifiers
  data_cid TEXT UNIQUE NOT NULL,  -- Google's place CID from ValueSERP
  
  -- Basic info from search results
  title TEXT NOT NULL,
  category place_category NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  
  -- Location
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Ratings
  rating DECIMAL(2, 1),
  reviews_count INTEGER,
  price_level TEXT,  -- $, $$, $$$, $$$$
  
  -- Hours
  hours JSONB,  -- Store operating hours as JSON
  
  -- Images
  thumbnail TEXT,
  images JSONB,  -- Array of image URLs
  
  -- Full details from place_details API
  description TEXT,
  popular_times JSONB,
  reviews JSONB,  -- Sample reviews
  
  -- Metadata
  raw_search_data JSONB,  -- Store raw search result
  raw_details_data JSONB,  -- Store raw details result
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create junction table to link places to parks
CREATE TABLE IF NOT EXISTS park_nearby_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id UUID NOT NULL,
  place_id UUID NOT NULL REFERENCES nearby_places(id) ON DELETE CASCADE,
  
  -- Distance from park (in miles)
  distance_miles DECIMAL(5, 2),
  
  -- Search context
  search_location TEXT,  -- The location string used for search (e.g., "Santa Cruz, California")
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Composite unique constraint
  UNIQUE(park_id, place_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_nearby_places_category ON nearby_places(category);
CREATE INDEX IF NOT EXISTS idx_nearby_places_rating ON nearby_places(rating DESC);
CREATE INDEX IF NOT EXISTS idx_nearby_places_data_cid ON nearby_places(data_cid);
CREATE INDEX IF NOT EXISTS idx_park_nearby_places_park_id ON park_nearby_places(park_id);
CREATE INDEX IF NOT EXISTS idx_park_nearby_places_place_id ON park_nearby_places(place_id);

-- Grant access
GRANT SELECT ON nearby_places TO anon, authenticated;
GRANT SELECT ON park_nearby_places TO anon, authenticated;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_nearby_places_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nearby_places_updated_at
  BEFORE UPDATE ON nearby_places
  FOR EACH ROW
  EXECUTE FUNCTION update_nearby_places_updated_at();

-- Add comments
COMMENT ON TABLE nearby_places IS 'Stores places (dining, entertainment, etc.) found via ValueSERP API';
COMMENT ON TABLE park_nearby_places IS 'Links parks to nearby places';
COMMENT ON COLUMN nearby_places.data_cid IS 'Google place CID from ValueSERP search results';
COMMENT ON COLUMN nearby_places.raw_search_data IS 'Raw JSON from ValueSERP places search';
COMMENT ON COLUMN nearby_places.raw_details_data IS 'Raw JSON from ValueSERP place_details';