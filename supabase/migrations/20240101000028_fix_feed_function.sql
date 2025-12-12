-- Migration: Fix ambiguous column reference in get_user_feed function
-- The media_id column was ambiguous between the return type and subquery columns

-- Drop the existing function first since we're changing it
DROP FUNCTION IF EXISTS get_user_feed(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_user_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  media_id UUID,
  user_id UUID,
  user_username VARCHAR(50),
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
    p.username as user_username,
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
    COALESCE(ml.cnt, 0::bigint) as likes_count,
    COALESCE(mc.cnt, 0::bigint) as comments_count,
    p.display_name as user_display_name,
    p.avatar_url as user_avatar_url,
    ap.full_name as park_name
  FROM user_media um
  INNER JOIN user_follows uf ON um.user_id = uf.following_id
  LEFT JOIN profiles p ON um.user_id = p.id
  LEFT JOIN all_parks ap ON um.park_code = ap.park_code
  LEFT JOIN (
    SELECT ml_inner.media_id as mid, COUNT(*) as cnt
    FROM media_likes ml_inner
    GROUP BY ml_inner.media_id
  ) ml ON um.id = ml.mid
  LEFT JOIN (
    SELECT mc_inner.media_id as mid, COUNT(*) as cnt
    FROM media_comments mc_inner
    GROUP BY mc_inner.media_id
  ) mc ON um.id = mc.mid
  WHERE uf.follower_id = p_user_id
    AND um.status = 'ready'
  ORDER BY um.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_user_feed IS 'Get personalized feed for a user showing media from followed users, includes username for profile links';