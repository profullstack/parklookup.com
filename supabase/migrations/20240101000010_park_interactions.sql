-- Park Comments table
CREATE TABLE IF NOT EXISTS park_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Park Likes table
CREATE TABLE IF NOT EXISTS park_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(park_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_park_comments_park_id ON park_comments(park_id);
CREATE INDEX IF NOT EXISTS idx_park_comments_user_id ON park_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_park_comments_created_at ON park_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_park_likes_park_id ON park_likes(park_id);
CREATE INDEX IF NOT EXISTS idx_park_likes_user_id ON park_likes(user_id);

-- Enable Row Level Security
ALTER TABLE park_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE park_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for park_comments
-- Anyone can read comments
CREATE POLICY "Anyone can read park comments"
  ON park_comments FOR SELECT
  USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create park comments"
  ON park_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own park comments"
  ON park_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own park comments"
  ON park_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for park_likes
-- Anyone can read likes
CREATE POLICY "Anyone can read park likes"
  ON park_likes FOR SELECT
  USING (true);

-- Authenticated users can create likes
CREATE POLICY "Authenticated users can create park likes"
  ON park_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their own park likes"
  ON park_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to get park stats (comments count, likes count, average rating)
CREATE OR REPLACE FUNCTION get_park_stats(p_park_id UUID)
RETURNS TABLE (
  comments_count BIGINT,
  likes_count BIGINT,
  average_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM park_comments WHERE park_id = p_park_id) AS comments_count,
    (SELECT COUNT(*) FROM park_likes WHERE park_id = p_park_id) AS likes_count,
    (SELECT AVG(rating)::NUMERIC(3,2) FROM park_comments WHERE park_id = p_park_id AND rating IS NOT NULL) AS average_rating;
END;
$$ LANGUAGE plpgsql;