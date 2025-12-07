-- Migration: Add place interactions (comments and likes)
-- Allows users to interact with nearby places

-- Create place_comments table
CREATE TABLE IF NOT EXISTS place_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES nearby_places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Comment content
  content TEXT NOT NULL,
  
  -- Optional rating with comment
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create place_likes table
CREATE TABLE IF NOT EXISTS place_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES nearby_places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can only like a place once
  UNIQUE(place_id, user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_place_comments_place_id ON place_comments(place_id);
CREATE INDEX IF NOT EXISTS idx_place_comments_user_id ON place_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_place_comments_created_at ON place_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_likes_place_id ON place_likes(place_id);
CREATE INDEX IF NOT EXISTS idx_place_likes_user_id ON place_likes(user_id);

-- Grant access
GRANT SELECT ON place_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON place_comments TO authenticated;
GRANT SELECT ON place_likes TO anon, authenticated;
GRANT INSERT, DELETE ON place_likes TO authenticated;

-- Add updated_at trigger for comments
CREATE OR REPLACE FUNCTION update_place_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER place_comments_updated_at
  BEFORE UPDATE ON place_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_place_comments_updated_at();

-- Create view for place stats (likes count, comments count)
CREATE OR REPLACE VIEW place_stats AS
SELECT 
  np.id as place_id,
  np.data_cid,
  np.title,
  COALESCE(likes.count, 0) as likes_count,
  COALESCE(comments.count, 0) as comments_count,
  COALESCE(comments.avg_rating, 0) as avg_user_rating
FROM nearby_places np
LEFT JOIN (
  SELECT place_id, COUNT(*) as count
  FROM place_likes
  GROUP BY place_id
) likes ON np.id = likes.place_id
LEFT JOIN (
  SELECT place_id, COUNT(*) as count, AVG(rating) as avg_rating
  FROM place_comments
  WHERE rating IS NOT NULL
  GROUP BY place_id
) comments ON np.id = comments.place_id;

GRANT SELECT ON place_stats TO anon, authenticated;

-- Add RLS policies
ALTER TABLE place_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_likes ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "Anyone can view comments" ON place_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON place_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON place_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON place_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Anyone can view likes" ON place_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create likes" ON place_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON place_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE place_comments IS 'User comments on nearby places';
COMMENT ON TABLE place_likes IS 'User likes on nearby places';
COMMENT ON VIEW place_stats IS 'Aggregated stats for places (likes, comments, ratings)';