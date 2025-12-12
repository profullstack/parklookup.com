-- Make county_id nullable in cities table
-- This allows cities to be created without knowing their county
-- (useful for importing city parks from OSM where county info may not be available)

ALTER TABLE cities ALTER COLUMN county_id DROP NOT NULL;

-- Update the unique constraint to use state_id instead of county_id
-- since cities should be unique within a state, not just within a county
ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_county_id_slug_key;
ALTER TABLE cities ADD CONSTRAINT cities_state_id_slug_key UNIQUE (state_id, slug);