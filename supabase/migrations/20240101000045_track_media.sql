-- Migration: Track Media
-- Allows users to attach photos and videos to their tracking sessions
-- Media can be captured during the track or added after completion

-- ============================================
-- Track Media Table
-- Links user_media to user_tracks
-- ============================================
CREATE TABLE IF NOT EXISTS track_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES user_media(id) ON DELETE CASCADE,
  
  -- Position where media was captured (optional - for geotagging)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  altitude_m DECIMAL(8, 2),
  
  -- Sequence in the track (based on when it was captured)
  captured_at TIMESTAMPTZ,
  
  -- Order for display
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each media can only be linked to a track once
  UNIQUE(track_id, media_id)
);

-- Create indexes for track_media
CREATE INDEX IF NOT EXISTS idx_track_media_track_id ON track_media(track_id);
CREATE INDEX IF NOT EXISTS idx_track_media_media_id ON track_media(media_id);
CREATE INDEX IF NOT EXISTS idx_track_media_captured_at ON track_media(track_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_track_media_display_order ON track_media(track_id, display_order);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE track_media ENABLE ROW LEVEL SECURITY;

-- Track Media policies
CREATE POLICY "Users can view media for their own tracks" ON track_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_media.track_id 
      AND user_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view media for public tracks" ON track_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_media.track_id 
      AND user_tracks.is_public = TRUE
      AND user_tracks.status = 'shared'
    )
  );

CREATE POLICY "Users can add media to their own tracks" ON track_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_media.track_id 
      AND user_tracks.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM user_media 
      WHERE user_media.id = track_media.media_id 
      AND user_media.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update media links for their own tracks" ON track_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_media.track_id 
      AND user_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove media from their own tracks" ON track_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_media.track_id 
      AND user_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all track media" ON track_media
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Grant access
-- ============================================
GRANT SELECT ON track_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON track_media TO authenticated;

-- ============================================
-- Functions
-- ============================================

-- Function to get track media with full details
CREATE OR REPLACE FUNCTION get_track_media(p_track_id UUID)
RETURNS TABLE (
  id UUID,
  track_id UUID,
  media_id UUID,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  altitude_m DECIMAL(8, 2),
  captured_at TIMESTAMPTZ,
  display_order INTEGER,
  created_at TIMESTAMPTZ,
  -- Media details
  media_type VARCHAR(10),
  storage_path TEXT,
  thumbnail_path TEXT,
  title VARCHAR(255),
  description TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  -- URLs (to be populated by application)
  url TEXT,
  thumbnail_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.id,
    tm.track_id,
    tm.media_id,
    tm.latitude,
    tm.longitude,
    tm.altitude_m,
    tm.captured_at,
    tm.display_order,
    tm.created_at,
    um.media_type,
    um.storage_path,
    um.thumbnail_path,
    um.title,
    um.description,
    um.width,
    um.height,
    um.duration,
    NULL::TEXT as url,
    NULL::TEXT as thumbnail_url
  FROM track_media tm
  INNER JOIN user_media um ON tm.media_id = um.id
  WHERE tm.track_id = p_track_id
    AND um.status = 'ready'
  ORDER BY COALESCE(tm.captured_at, tm.created_at), tm.display_order;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_track_media TO anon, authenticated;

-- Function to add media to track with optional geolocation
CREATE OR REPLACE FUNCTION add_media_to_track(
  p_track_id UUID,
  p_media_id UUID,
  p_latitude DECIMAL(10, 8) DEFAULT NULL,
  p_longitude DECIMAL(11, 8) DEFAULT NULL,
  p_altitude_m DECIMAL(8, 2) DEFAULT NULL,
  p_captured_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS track_media
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_track_media track_media;
  v_max_order INTEGER;
BEGIN
  -- Verify track ownership
  IF NOT EXISTS (
    SELECT 1 FROM user_tracks 
    WHERE id = p_track_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Track not found or access denied';
  END IF;
  
  -- Verify media ownership
  IF NOT EXISTS (
    SELECT 1 FROM user_media 
    WHERE id = p_media_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Media not found or access denied';
  END IF;
  
  -- Get next display order
  SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_max_order
  FROM track_media WHERE track_id = p_track_id;
  
  -- Insert track media link
  INSERT INTO track_media (
    track_id, media_id, latitude, longitude, altitude_m, 
    captured_at, display_order
  ) VALUES (
    p_track_id, p_media_id, p_latitude, p_longitude, p_altitude_m,
    COALESCE(p_captured_at, NOW()), v_max_order
  )
  RETURNING * INTO v_track_media;
  
  RETURN v_track_media;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_media_to_track TO authenticated;

-- ============================================
-- Update track_stats view to include media count
-- ============================================
DROP VIEW IF EXISTS track_stats;

CREATE OR REPLACE VIEW track_stats AS
SELECT 
  ut.id as track_id,
  ut.user_id,
  ut.title,
  ut.activity_type,
  ut.distance_meters,
  ut.duration_seconds,
  ut.elevation_gain_m,
  ut.status,
  ut.is_public,
  ut.created_at,
  COALESCE(likes.count, 0) as likes_count,
  COALESCE(comments.count, 0) as comments_count,
  COALESCE(media.count, 0) as media_count
FROM user_tracks ut
LEFT JOIN (
  SELECT track_id, COUNT(*) as count
  FROM track_likes
  GROUP BY track_id
) likes ON ut.id = likes.track_id
LEFT JOIN (
  SELECT track_id, COUNT(*) as count
  FROM track_comments
  GROUP BY track_id
) comments ON ut.id = comments.track_id
LEFT JOIN (
  SELECT track_id, COUNT(*) as count
  FROM track_media
  GROUP BY track_id
) media ON ut.id = media.track_id;

-- Grant access to the view
GRANT SELECT ON track_stats TO anon, authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE track_media IS 'Links user media (photos/videos) to tracking sessions';
COMMENT ON FUNCTION get_track_media IS 'Get all media attached to a track with full details';
COMMENT ON FUNCTION add_media_to_track IS 'Add a media item to a track with optional geolocation';
