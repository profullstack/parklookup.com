-- Migration: Add local_park_id to user_media table
-- This allows media uploads for local parks (county, city, regional parks)

-- Step 1: Add local_park_id column
ALTER TABLE user_media ADD COLUMN IF NOT EXISTS local_park_id UUID;

-- Step 2: Add foreign key constraint to local_parks table (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_media_local_park_id_fkey'
    AND table_name = 'user_media'
  ) THEN
    ALTER TABLE user_media
    ADD CONSTRAINT user_media_local_park_id_fkey
    FOREIGN KEY (local_park_id) REFERENCES local_parks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 3: Create index on local_park_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_media_local_park_id ON user_media(local_park_id);

-- Step 4: Make park_code nullable if it isn't already (since we now support local parks)
ALTER TABLE user_media ALTER COLUMN park_code DROP NOT NULL;

-- Step 5: Add comment
COMMENT ON COLUMN user_media.local_park_id IS 'Local park ID (for county, city, regional parks)';