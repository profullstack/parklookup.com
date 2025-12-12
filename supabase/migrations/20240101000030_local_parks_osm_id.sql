-- Add OSM ID column to local_parks table
-- This migration adds support for OpenStreetMap data source

-- Add osm_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'local_parks' AND column_name = 'osm_id'
  ) THEN
    ALTER TABLE local_parks ADD COLUMN osm_id VARCHAR(50);
  END IF;
END $$;

-- Create index for osm_id
CREATE INDEX IF NOT EXISTS idx_local_parks_osm_id ON local_parks(osm_id);

-- Update park_type constraint to include 'local' type
ALTER TABLE local_parks DROP CONSTRAINT IF EXISTS local_parks_park_type_check;
ALTER TABLE local_parks ADD CONSTRAINT local_parks_park_type_check 
  CHECK (park_type IN ('county', 'city', 'regional', 'municipal', 'local'));

-- Add comment explaining the data source change
COMMENT ON COLUMN local_parks.osm_id IS 'OpenStreetMap element ID (node/way/relation)';
COMMENT ON COLUMN local_parks.padus_id IS 'Legacy PAD-US ID (deprecated, use osm_id)';