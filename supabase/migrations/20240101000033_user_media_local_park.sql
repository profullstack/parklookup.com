-- Migration: Add local_park_id to user_media table
-- This allows media uploads for local parks (county, city, regional parks)

-- Step 1: Add local_park_id column
ALTER TABLE user_media ADD COLUMN IF NOT EXISTS local_park_id UUID;

-- Step 2: Add foreign key constraint to local_parks table
ALTER TABLE user_media 
ADD CONSTRAINT user_media_local_park_id_fkey 
FOREIGN KEY (local_park_id) REFERENCES local_parks(id) ON DELETE SET NULL;

-- Step 3: Create index on local_park_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_media_local_park_id ON user_media(local_park_id);

-- Step 4: Add check constraint to ensure either park_code or local_park_id is set (but not both required)
-- Note: We allow both to be null for flexibility, but typically one should be set
ALTER TABLE user_media DROP CONSTRAINT IF EXISTS user_media_park_reference_check;

-- Step 5: Make park_code nullable if it isn't already (since we now support local parks)
ALTER TABLE user_media ALTER COLUMN park_code DROP NOT NULL;

-- Step 6: Update the feed function to include local park media
CREATE OR REPLACE FUNCTION get_user_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  park_code VARCHAR(20),
  local_park_id UUID,
  media_type VARCHAR(10),
  storage_path TEXT,
  thumbnail_path TEXT,
  title VARCHAR(255),
  description TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  status VARCHAR(20),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_display_name VARCHAR(255),
  user_username VARCHAR(50),
  user_avatar_url TEXT,
  park_name VARCHAR(255),
  local_park_name VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.id,
    um.user_id,
    um.park_code,
    um.local_park_id,
    um.media_type,
    um.storage_path,
    um.thumbnail_path,
    um.title,
    um.description,
    um.width,
    um.height,
    um.duration,
    um.status,
    um.created_at,
    um.updated_at,
    p.display_name as user_display_name,
    p.username as user_username,
    p.avatar_url as user_avatar_url,
    ap.full_name as park_name,
    lp.name as local_park_name
  FROM user_media um
  INNER JOIN user_follows uf ON um.user_id = uf.following_id
  LEFT JOIN profiles p ON um.user_id = p.id
  LEFT JOIN all_parks ap ON um.park_code = ap.park_code
  LEFT JOIN local_parks lp ON um.local_park_id = lp.id
  WHERE uf.follower_id = p_user_id
    AND um.status = 'ready'
  ORDER BY um.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Add comment
COMMENT ON COLUMN user_media.local_park_id IS 'Local park ID (for county, city, regional parks)';