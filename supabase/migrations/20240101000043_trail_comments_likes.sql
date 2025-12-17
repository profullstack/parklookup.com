-- Trail Comments Table
-- Stores user reviews and comments for trails
CREATE TABLE IF NOT EXISTS trail_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trail Likes Table
-- Stores user likes for trails
CREATE TABLE IF NOT EXISTS trail_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trail_id, user_id)
);

-- Trail Media Table
-- Stores user-uploaded photos and videos for trails
CREATE TABLE IF NOT EXISTS trail_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  media_type VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trail_comments_trail_id ON trail_comments(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_comments_user_id ON trail_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_trail_comments_created_at ON trail_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trail_likes_trail_id ON trail_likes(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_likes_user_id ON trail_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_trail_media_trail_id ON trail_media(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_media_user_id ON trail_media(user_id);
CREATE INDEX IF NOT EXISTS idx_trail_media_created_at ON trail_media(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE trail_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trail_comments
-- Anyone can read comments
CREATE POLICY "Anyone can read trail comments"
  ON trail_comments FOR SELECT
  USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create trail comments"
  ON trail_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own trail comments"
  ON trail_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own trail comments"
  ON trail_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for trail_likes
-- Anyone can read likes
CREATE POLICY "Anyone can read trail likes"
  ON trail_likes FOR SELECT
  USING (true);

-- Authenticated users can create likes
CREATE POLICY "Authenticated users can create trail likes"
  ON trail_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their own trail likes"
  ON trail_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for trail_media
-- Anyone can read media
CREATE POLICY "Anyone can read trail media"
  ON trail_media FOR SELECT
  USING (true);

-- Authenticated users can create media
CREATE POLICY "Authenticated users can create trail media"
  ON trail_media FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own media
CREATE POLICY "Users can delete their own trail media"
  ON trail_media FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trail_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trail_comments_updated_at ON trail_comments;
CREATE TRIGGER trail_comments_updated_at
  BEFORE UPDATE ON trail_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_trail_comment_updated_at();
