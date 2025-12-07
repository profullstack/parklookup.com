-- Migration: Add photos and data_id columns to nearby_places table
-- This migration adds support for storing place photos from ScaleSERP API

-- Add data_id column (ScaleSERP uses data_id for place lookups)
ALTER TABLE nearby_places
ADD COLUMN IF NOT EXISTS data_id TEXT;

-- Add photos column to store array of photo objects
ALTER TABLE nearby_places
ADD COLUMN IF NOT EXISTS photos JSONB;

-- Add description column for place descriptions
ALTER TABLE nearby_places
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index on data_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_nearby_places_data_id ON nearby_places(data_id);

-- Add unique constraint on data_id (if not null)
-- Note: We keep data_cid as the primary unique identifier for backward compatibility
-- data_id is used for ScaleSERP photo lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_nearby_places_data_id_unique 
ON nearby_places(data_id) 
WHERE data_id IS NOT NULL;

-- Comment on new columns
COMMENT ON COLUMN nearby_places.data_id IS 'ScaleSERP data_id for place photo lookups';
COMMENT ON COLUMN nearby_places.photos IS 'Array of photo objects with image and thumbnail URLs';
COMMENT ON COLUMN nearby_places.description IS 'Place description from ScaleSERP';