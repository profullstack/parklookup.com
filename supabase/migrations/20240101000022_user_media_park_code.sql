-- Migration: Change user_media to use park_code instead of park_id
-- This allows media uploads for all park types (NPS, state parks, etc.)

-- Step 1: Add park_code column
ALTER TABLE user_media ADD COLUMN IF NOT EXISTS park_code VARCHAR(20);

-- Step 2: Populate park_code from existing park_id (for NPS parks)
UPDATE user_media um
SET park_code = np.park_code
FROM nps_parks np
WHERE um.park_id = np.id AND um.park_code IS NULL;

-- Step 3: Make park_code NOT NULL (after populating existing data)
-- Note: This will fail if there are records without park_code, which is expected for new installs
DO $$
BEGIN
  -- Only add NOT NULL constraint if there are no NULL park_codes
  IF NOT EXISTS (SELECT 1 FROM user_media WHERE park_code IS NULL) THEN
    ALTER TABLE user_media ALTER COLUMN park_code SET NOT NULL;
  END IF;
END $$;

-- Step 4: Drop the foreign key constraint on park_id
ALTER TABLE user_media DROP CONSTRAINT IF EXISTS user_media_park_id_fkey;

-- Step 5: Make park_id nullable (we'll keep it for backward compatibility but it's optional now)
ALTER TABLE user_media ALTER COLUMN park_id DROP NOT NULL;

-- Step 6: Create index on park_code for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_media_park_code ON user_media(park_code);

-- Step 7: Update the get_park_media function to use park_code
CREATE OR REPLACE FUNCTION get_park_media(p_park_code VARCHAR(20), p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  media_id UUID,
  user_id UUID,
  media_type VARCHAR(10),
  storage_path TEXT,
  thumbnail_path TEXT,
  title VARCHAR(255),
  description TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  created_at TIMESTAMPTZ,
  likes_count BIGINT,
  comments_count BIGINT,
  user_display_name VARCHAR(100),
  user_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.id as media_id,
    um.user_id,
    um.media_type,
    um.storage_path,
    um.thumbnail_path,
    um.title,
    um.description,
    um.width,
    um.height,
    um.duration,
    um.created_at,
    COALESCE(ml.likes_count, 0) as likes_count,
    COALESCE(mc.comments_count, 0) as comments_count,
    p.display_name as user_display_name,
    p.avatar_url as user_avatar_url
  FROM user_media um
  LEFT JOIN profiles p ON um.user_id = p.id
  LEFT JOIN (
    SELECT media_id, COUNT(*) as likes_count
    FROM media_likes
    GROUP BY media_id
  ) ml ON um.id = ml.media_id
  LEFT JOIN (
    SELECT media_id, COUNT(*) as comments_count
    FROM media_comments
    GROUP BY media_id
  ) mc ON um.id = mc.media_id
  WHERE um.park_code = p_park_code
    AND um.status = 'ready'
  ORDER BY um.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Step 8: Drop and recreate the get_user_feed function with park_code instead of park_id
-- (PostgreSQL doesn't allow changing return type with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS get_user_feed(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_user_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  media_id UUID,
  user_id UUID,
  park_code VARCHAR(20),
  media_type VARCHAR(10),
  storage_path TEXT,
  thumbnail_path TEXT,
  title VARCHAR(255),
  description TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  created_at TIMESTAMPTZ,
  likes_count BIGINT,
  comments_count BIGINT,
  user_display_name VARCHAR(100),
  user_avatar_url TEXT,
  park_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.id as media_id,
    um.user_id,
    um.park_code,
    um.media_type,
    um.storage_path,
    um.thumbnail_path,
    um.title,
    um.description,
    um.width,
    um.height,
    um.duration,
    um.created_at,
    COALESCE(ml.likes_count, 0) as likes_count,
    COALESCE(mc.comments_count, 0) as comments_count,
    p.display_name as user_display_name,
    p.avatar_url as user_avatar_url,
    ap.full_name as park_name
  FROM user_media um
  INNER JOIN user_follows uf ON um.user_id = uf.following_id
  LEFT JOIN profiles p ON um.user_id = p.id
  LEFT JOIN all_parks ap ON um.park_code = ap.park_code
  LEFT JOIN (
    SELECT media_id, COUNT(*) as likes_count
    FROM media_likes
    GROUP BY media_id
  ) ml ON um.id = ml.media_id
  LEFT JOIN (
    SELECT media_id, COUNT(*) as comments_count
    FROM media_comments
    GROUP BY media_id
  ) mc ON um.id = mc.media_id
  WHERE uf.follower_id = p_user_id
    AND um.status = 'ready'
  ORDER BY um.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_park_media(VARCHAR(20), INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_feed(UUID, INTEGER, INTEGER) TO authenticated;

-- Add comment
COMMENT ON COLUMN user_media.park_code IS 'Park code (works with all park types: NPS, state parks, etc.)';