-- Migration: Add support for Wikidata (state park) favorites
-- This allows users to favorite both NPS parks and state parks from Wikidata

-- Step 1: Add wikidata_park_id column
ALTER TABLE favorites 
ADD COLUMN IF NOT EXISTS wikidata_park_id UUID REFERENCES wikidata_parks(id) ON DELETE CASCADE;

-- Step 2: Make nps_park_id nullable (it was NOT NULL before)
ALTER TABLE favorites 
ALTER COLUMN nps_park_id DROP NOT NULL;

-- Step 3: Add a check constraint to ensure at least one park ID is set
-- Drop existing constraint if it exists
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_park_id_check;

-- Add new constraint
ALTER TABLE favorites 
ADD CONSTRAINT favorites_park_id_check 
CHECK (nps_park_id IS NOT NULL OR wikidata_park_id IS NOT NULL);

-- Step 4: Drop the old unique constraint and create a new one
-- The old constraint was: UNIQUE(user_id, nps_park_id)
-- We need: UNIQUE(user_id, nps_park_id) and UNIQUE(user_id, wikidata_park_id)
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_nps_park_id_key;

-- Create partial unique indexes instead of constraints
-- This allows NULL values in the unique columns
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_nps_park 
ON favorites(user_id, nps_park_id) 
WHERE nps_park_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_wikidata_park 
ON favorites(user_id, wikidata_park_id) 
WHERE wikidata_park_id IS NOT NULL;

-- Step 5: Create index for wikidata_park_id lookups
CREATE INDEX IF NOT EXISTS idx_favorites_wikidata_park_id ON favorites(wikidata_park_id);

-- Step 6: Add RLS policy for the new column (already covered by existing user_id policies)
-- No changes needed since policies are based on user_id

-- Add comment
COMMENT ON COLUMN favorites.wikidata_park_id IS 'Reference to wikidata_parks for state park favorites';