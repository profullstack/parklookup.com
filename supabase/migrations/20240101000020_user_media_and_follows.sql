-- Migration: User Media Uploads, Comments, and Follows
-- Allows users to upload photos/videos for parks, comment on them, and follow other users

-- ============================================
-- User Media Table
-- Stores user-uploaded photos and videos for parks
-- ============================================
CREATE TABLE IF NOT EXISTS user_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  park_id UUID NOT NULL REFERENCES nps_parks(id) ON DELETE CASCADE,
  
  -- Media information
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('photo', 'video')),
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  thumbnail_path TEXT, -- Thumbnail for videos
  original_filename VARCHAR(255),
  file_size INTEGER, -- Size in bytes
  mime_type VARCHAR(100),
  
  -- Media metadata
  title VARCHAR(255),
  description TEXT,
  
  -- Video-specific metadata
  duration INTEGER, -- Duration in seconds for videos
  width INTEGER,
  height INTEGER,
  
  -- Location metadata (optional, from EXIF or user input)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  taken_at TIMESTAMPTZ, -- When the photo/video was taken
  
  -- Status
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
  processing_error TEXT,
  
  -- Moderation
  is_flagged BOOLEAN DEFAULT FALSE,
  flagged_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_media_user_id ON user_media(user_id);
CREATE INDEX IF NOT EXISTS idx_user_media_park_id ON user_media(park_id);
CREATE INDEX IF NOT EXISTS idx_user_media_status ON user_media(status);
CREATE INDEX IF NOT EXISTS idx_user_media_created_at ON user_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_media_media_type ON user_media(media_type);

-- Composite index for park media feed
CREATE INDEX IF NOT EXISTS idx_user_media_park_feed ON user_media(park_id, status, created_at DESC);

-- Composite index for user media feed
CREATE INDEX IF NOT EXISTS idx_user_media_user_feed ON user_media(user_id, status, created_at DESC);

-- ============================================
-- Media Comments Table
-- Comments on user-uploaded media
-- ============================================
CREATE TABLE IF NOT EXISTS media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES user_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Comment content
  content TEXT NOT NULL,
  
  -- Parent comment for replies (optional)
  parent_id UUID REFERENCES media_comments(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_media_comments_media_id ON media_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_user_id ON media_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_parent_id ON media_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_created_at ON media_comments(created_at DESC);

-- ============================================
-- Media Likes Table
-- Likes on user-uploaded media
-- ============================================
CREATE TABLE IF NOT EXISTS media_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES user_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can only like a media once
  UNIQUE(media_id, user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_media_likes_media_id ON media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_media_likes_user_id ON media_likes(user_id);

-- ============================================
-- User Follows Table
-- User follow relationships
-- ============================================
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent self-follows and duplicate follows
  CONSTRAINT no_self_follow CHECK (follower_id != following_id),
  UNIQUE(follower_id, following_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);

-- ============================================
-- Update profiles table with additional fields
-- ============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS website VARCHAR(500);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE TRIGGER update_user_media_updated_at
  BEFORE UPDATE ON user_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_comments_updated_at
  BEFORE UPDATE ON media_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

-- Media stats view (likes count, comments count)
CREATE OR REPLACE VIEW media_stats AS
SELECT 
  um.id as media_id,
  um.user_id,
  um.park_id,
  um.media_type,
  um.title,
  um.status,
  um.created_at,
  COALESCE(likes.count, 0) as likes_count,
  COALESCE(comments.count, 0) as comments_count
FROM user_media um
LEFT JOIN (
  SELECT media_id, COUNT(*) as count
  FROM media_likes
  GROUP BY media_id
) likes ON um.id = likes.media_id
LEFT JOIN (
  SELECT media_id, COUNT(*) as count
  FROM media_comments
  GROUP BY media_id
) comments ON um.id = comments.media_id
WHERE um.status = 'ready';

-- User profile stats view (followers, following, media count)
CREATE OR REPLACE VIEW user_profile_stats AS
SELECT 
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  p.bio,
  COALESCE(followers.count, 0) as followers_count,
  COALESCE(following.count, 0) as following_count,
  COALESCE(media.count, 0) as media_count
FROM profiles p
LEFT JOIN (
  SELECT following_id, COUNT(*) as count
  FROM user_follows
  GROUP BY following_id
) followers ON p.id = followers.following_id
LEFT JOIN (
  SELECT follower_id, COUNT(*) as count
  FROM user_follows
  GROUP BY follower_id
) following ON p.id = following.follower_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count
  FROM user_media
  WHERE status = 'ready'
  GROUP BY user_id
) media ON p.id = media.user_id;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- User Media policies
CREATE POLICY "Anyone can view ready media" ON user_media
  FOR SELECT USING (status = 'ready');

CREATE POLICY "Users can view their own media regardless of status" ON user_media
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create media" ON user_media
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media" ON user_media
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media" ON user_media
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all media" ON user_media
  FOR ALL USING (auth.role() = 'service_role');

-- Media Comments policies
CREATE POLICY "Anyone can view comments" ON media_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON media_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON media_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON media_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Media Likes policies
CREATE POLICY "Anyone can view likes" ON media_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create likes" ON media_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON media_likes
  FOR DELETE USING (auth.uid() = user_id);

-- User Follows policies
CREATE POLICY "Anyone can view follows" ON user_follows
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can follow others" ON user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON user_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ============================================
-- Grant access
-- ============================================
GRANT SELECT ON user_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON user_media TO authenticated;

GRANT SELECT ON media_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON media_comments TO authenticated;

GRANT SELECT ON media_likes TO anon, authenticated;
GRANT INSERT, DELETE ON media_likes TO authenticated;

GRANT SELECT ON user_follows TO anon, authenticated;
GRANT INSERT, DELETE ON user_follows TO authenticated;

GRANT SELECT ON media_stats TO anon, authenticated;
GRANT SELECT ON user_profile_stats TO anon, authenticated;

-- ============================================
-- Functions
-- ============================================

-- Function to get user feed (media from followed users)
CREATE OR REPLACE FUNCTION get_user_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  media_id UUID,
  user_id UUID,
  park_id UUID,
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
  park_name VARCHAR(255),
  park_code VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.id as media_id,
    um.user_id,
    um.park_id,
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
    np.full_name as park_name,
    np.park_code
  FROM user_media um
  INNER JOIN user_follows uf ON um.user_id = uf.following_id
  LEFT JOIN profiles p ON um.user_id = p.id
  LEFT JOIN nps_parks np ON um.park_id = np.id
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

-- Function to get park media feed
CREATE OR REPLACE FUNCTION get_park_media(p_park_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
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
  WHERE um.park_id = p_park_id
    AND um.status = 'ready'
  ORDER BY um.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_feed TO authenticated;
GRANT EXECUTE ON FUNCTION get_park_media TO anon, authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE user_media IS 'User-uploaded photos and videos for parks';
COMMENT ON TABLE media_comments IS 'Comments on user-uploaded media';
COMMENT ON TABLE media_likes IS 'Likes on user-uploaded media';
COMMENT ON TABLE user_follows IS 'User follow relationships';
COMMENT ON VIEW media_stats IS 'Aggregated stats for media (likes, comments)';
COMMENT ON VIEW user_profile_stats IS 'Aggregated stats for user profiles (followers, following, media count)';
COMMENT ON FUNCTION get_user_feed IS 'Get media feed from followed users';
COMMENT ON FUNCTION get_park_media IS 'Get media feed for a specific park';