-- Migration: User Tracks (Trip Tracker Feature)
-- Allows paid users to record GPS tracks while hiking, biking, or driving through parks
-- Includes support for live tracking, sharing to feed, and social interactions

-- ============================================
-- User Tracks Table
-- Stores metadata about each recorded track
-- ============================================
CREATE TABLE IF NOT EXISTS user_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Association (at least one should be set)
  park_id UUID REFERENCES nps_parks(id) ON DELETE SET NULL,
  park_code VARCHAR(10),
  trail_id UUID REFERENCES trails(id) ON DELETE SET NULL,
  local_park_id UUID REFERENCES local_parks(id) ON DELETE SET NULL,
  
  -- Track metadata
  title VARCHAR(255),
  description TEXT,
  activity_type VARCHAR(20) NOT NULL DEFAULT 'walking' CHECK (activity_type IN ('walking', 'hiking', 'biking', 'driving')),
  
  -- Computed stats (updated when track is completed)
  distance_meters DECIMAL(12, 2),
  duration_seconds INTEGER,
  elevation_gain_m DECIMAL(8, 2),
  elevation_loss_m DECIMAL(8, 2),
  avg_speed_mps DECIMAL(8, 4),
  max_speed_mps DECIMAL(8, 4),
  min_elevation_m DECIMAL(8, 2),
  max_elevation_m DECIMAL(8, 2),
  
  -- Bounding box for quick spatial queries
  min_lat DECIMAL(10, 8),
  max_lat DECIMAL(10, 8),
  min_lng DECIMAL(11, 8),
  max_lng DECIMAL(11, 8),
  
  -- Geometry (LineString for the full track - stored as GeoJSON for simplicity)
  geometry JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'recording' CHECK (status IN ('recording', 'paused', 'completed', 'shared', 'deleted')),
  
  -- Sharing
  is_public BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMPTZ,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for user_tracks
CREATE INDEX IF NOT EXISTS idx_user_tracks_user_id ON user_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tracks_status ON user_tracks(status);
CREATE INDEX IF NOT EXISTS idx_user_tracks_is_public ON user_tracks(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_tracks_created_at ON user_tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_tracks_park_id ON user_tracks(park_id);
CREATE INDEX IF NOT EXISTS idx_user_tracks_trail_id ON user_tracks(trail_id);
CREATE INDEX IF NOT EXISTS idx_user_tracks_local_park_id ON user_tracks(local_park_id);
CREATE INDEX IF NOT EXISTS idx_user_tracks_activity_type ON user_tracks(activity_type);

-- Composite index for user's track feed
CREATE INDEX IF NOT EXISTS idx_user_tracks_user_feed ON user_tracks(user_id, status, created_at DESC);

-- Composite index for public tracks feed
CREATE INDEX IF NOT EXISTS idx_user_tracks_public_feed ON user_tracks(is_public, shared_at DESC) WHERE is_public = TRUE;

-- ============================================
-- Track Points Table
-- Stores individual GPS points for each track
-- ============================================
CREATE TABLE IF NOT EXISTS track_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
  
  -- Position
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  altitude_m DECIMAL(8, 2),
  
  -- Accuracy
  accuracy_m DECIMAL(8, 2),
  altitude_accuracy_m DECIMAL(8, 2),
  
  -- Motion
  speed_mps DECIMAL(8, 4),
  heading DECIMAL(6, 2),
  
  -- Sequence
  sequence_num INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for track_points
CREATE INDEX IF NOT EXISTS idx_track_points_track_id ON track_points(track_id);
CREATE INDEX IF NOT EXISTS idx_track_points_sequence ON track_points(track_id, sequence_num);
CREATE INDEX IF NOT EXISTS idx_track_points_recorded_at ON track_points(track_id, recorded_at);

-- ============================================
-- Track Likes Table
-- Likes on shared tracks (similar to media_likes)
-- ============================================
CREATE TABLE IF NOT EXISTS track_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can only like a track once
  UNIQUE(track_id, user_id)
);

-- Create indexes for track_likes
CREATE INDEX IF NOT EXISTS idx_track_likes_track_id ON track_likes(track_id);
CREATE INDEX IF NOT EXISTS idx_track_likes_user_id ON track_likes(user_id);

-- ============================================
-- Track Comments Table
-- Comments on shared tracks (similar to media_comments)
-- ============================================
CREATE TABLE IF NOT EXISTS track_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES track_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for track_comments
CREATE INDEX IF NOT EXISTS idx_track_comments_track_id ON track_comments(track_id);
CREATE INDEX IF NOT EXISTS idx_track_comments_user_id ON track_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_track_comments_parent_id ON track_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_track_comments_created_at ON track_comments(created_at DESC);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE TRIGGER update_user_tracks_updated_at
  BEFORE UPDATE ON user_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_track_comments_updated_at
  BEFORE UPDATE ON track_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_comments ENABLE ROW LEVEL SECURITY;

-- User Tracks policies
CREATE POLICY "Users can view their own tracks" ON user_tracks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public tracks" ON user_tracks
  FOR SELECT USING (is_public = TRUE AND status = 'shared');

CREATE POLICY "Pro users can create tracks" ON user_tracks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_pro = TRUE
    )
  );

CREATE POLICY "Users can update their own tracks" ON user_tracks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracks" ON user_tracks
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tracks" ON user_tracks
  FOR ALL USING (auth.role() = 'service_role');

-- Track Points policies
CREATE POLICY "Users can view points for their own tracks" ON track_points
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_points.track_id 
      AND user_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view points for public tracks" ON track_points
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_points.track_id 
      AND user_tracks.is_public = TRUE
      AND user_tracks.status = 'shared'
    )
  );

CREATE POLICY "Users can insert points for their own tracks" ON track_points
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_points.track_id 
      AND user_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete points for their own tracks" ON track_points
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_tracks 
      WHERE user_tracks.id = track_points.track_id 
      AND user_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all track points" ON track_points
  FOR ALL USING (auth.role() = 'service_role');

-- Track Likes policies
CREATE POLICY "Anyone can view track likes" ON track_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like tracks" ON track_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike tracks" ON track_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Track Comments policies
CREATE POLICY "Anyone can view track comments" ON track_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON track_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON track_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON track_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Grant access
-- ============================================
GRANT SELECT ON user_tracks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON user_tracks TO authenticated;

GRANT SELECT ON track_points TO anon, authenticated;
GRANT INSERT, DELETE ON track_points TO authenticated;

GRANT SELECT ON track_likes TO anon, authenticated;
GRANT INSERT, DELETE ON track_likes TO authenticated;

GRANT SELECT ON track_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON track_comments TO authenticated;

-- ============================================
-- Views
-- ============================================

-- Track stats view (likes count, comments count)
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
  COALESCE(comments.count, 0) as comments_count
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
) comments ON ut.id = comments.track_id;

-- Grant access to the view
GRANT SELECT ON track_stats TO anon, authenticated;

-- ============================================
-- Functions
-- ============================================

-- Function to check if user can create tracks (must be pro)
CREATE OR REPLACE FUNCTION can_user_create_track(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(is_pro, FALSE)
    FROM profiles 
    WHERE id = p_user_id
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_user_create_track TO authenticated;

-- Function to calculate track statistics from points
CREATE OR REPLACE FUNCTION calculate_track_stats(p_track_id UUID)
RETURNS TABLE (
  distance_meters DECIMAL(12, 2),
  duration_seconds INTEGER,
  elevation_gain_m DECIMAL(8, 2),
  elevation_loss_m DECIMAL(8, 2),
  avg_speed_mps DECIMAL(8, 4),
  max_speed_mps DECIMAL(8, 4),
  min_elevation_m DECIMAL(8, 2),
  max_elevation_m DECIMAL(8, 2),
  min_lat DECIMAL(10, 8),
  max_lat DECIMAL(10, 8),
  min_lng DECIMAL(11, 8),
  max_lng DECIMAL(11, 8)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_distance DECIMAL(12, 2) := 0;
  v_elevation_gain DECIMAL(8, 2) := 0;
  v_elevation_loss DECIMAL(8, 2) := 0;
  v_prev_lat DECIMAL(10, 8);
  v_prev_lng DECIMAL(11, 8);
  v_prev_alt DECIMAL(8, 2);
  v_point RECORD;
  v_first_time TIMESTAMPTZ;
  v_last_time TIMESTAMPTZ;
BEGIN
  -- Get bounding box and elevation stats
  SELECT 
    MIN(latitude), MAX(latitude),
    MIN(longitude), MAX(longitude),
    MIN(altitude_m), MAX(altitude_m),
    MIN(recorded_at), MAX(recorded_at),
    MAX(speed_mps),
    AVG(speed_mps) FILTER (WHERE speed_mps > 0)
  INTO 
    min_lat, max_lat,
    min_lng, max_lng,
    min_elevation_m, max_elevation_m,
    v_first_time, v_last_time,
    max_speed_mps,
    avg_speed_mps
  FROM track_points
  WHERE track_id = p_track_id;
  
  -- Calculate duration
  IF v_first_time IS NOT NULL AND v_last_time IS NOT NULL THEN
    duration_seconds := EXTRACT(EPOCH FROM (v_last_time - v_first_time))::INTEGER;
  ELSE
    duration_seconds := 0;
  END IF;
  
  -- Calculate distance and elevation changes using Haversine formula
  FOR v_point IN 
    SELECT latitude, longitude, altitude_m 
    FROM track_points 
    WHERE track_id = p_track_id 
    ORDER BY sequence_num
  LOOP
    IF v_prev_lat IS NOT NULL THEN
      -- Haversine distance calculation
      v_total_distance := v_total_distance + (
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(v_point.latitude - v_prev_lat) / 2), 2) +
          COS(RADIANS(v_prev_lat)) * COS(RADIANS(v_point.latitude)) *
          POWER(SIN(RADIANS(v_point.longitude - v_prev_lng) / 2), 2)
        ))
      );
      
      -- Elevation changes
      IF v_prev_alt IS NOT NULL AND v_point.altitude_m IS NOT NULL THEN
        IF v_point.altitude_m > v_prev_alt THEN
          v_elevation_gain := v_elevation_gain + (v_point.altitude_m - v_prev_alt);
        ELSE
          v_elevation_loss := v_elevation_loss + (v_prev_alt - v_point.altitude_m);
        END IF;
      END IF;
    END IF;
    
    v_prev_lat := v_point.latitude;
    v_prev_lng := v_point.longitude;
    v_prev_alt := v_point.altitude_m;
  END LOOP;
  
  distance_meters := ROUND(v_total_distance, 2);
  elevation_gain_m := ROUND(v_elevation_gain, 2);
  elevation_loss_m := ROUND(v_elevation_loss, 2);
  
  RETURN NEXT;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_track_stats TO authenticated;

-- Function to finalize a track (calculate stats and update)
CREATE OR REPLACE FUNCTION finalize_track(p_track_id UUID)
RETURNS user_tracks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_track user_tracks;
  v_stats RECORD;
  v_geometry JSONB;
BEGIN
  -- Verify ownership
  SELECT * INTO v_track FROM user_tracks WHERE id = p_track_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Track not found or access denied';
  END IF;
  
  -- Calculate stats
  SELECT * INTO v_stats FROM calculate_track_stats(p_track_id);
  
  -- Build GeoJSON LineString from points
  SELECT jsonb_build_object(
    'type', 'LineString',
    'coordinates', jsonb_agg(
      jsonb_build_array(longitude, latitude, altitude_m)
      ORDER BY sequence_num
    )
  ) INTO v_geometry
  FROM track_points
  WHERE track_id = p_track_id;
  
  -- Update track with stats
  UPDATE user_tracks SET
    distance_meters = v_stats.distance_meters,
    duration_seconds = v_stats.duration_seconds,
    elevation_gain_m = v_stats.elevation_gain_m,
    elevation_loss_m = v_stats.elevation_loss_m,
    avg_speed_mps = v_stats.avg_speed_mps,
    max_speed_mps = v_stats.max_speed_mps,
    min_elevation_m = v_stats.min_elevation_m,
    max_elevation_m = v_stats.max_elevation_m,
    min_lat = v_stats.min_lat,
    max_lat = v_stats.max_lat,
    min_lng = v_stats.min_lng,
    max_lng = v_stats.max_lng,
    geometry = v_geometry,
    status = 'completed',
    ended_at = NOW(),
    updated_at = NOW()
  WHERE id = p_track_id
  RETURNING * INTO v_track;
  
  RETURN v_track;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION finalize_track TO authenticated;

-- Function to get user's track feed
CREATE OR REPLACE FUNCTION get_user_track_feed(
  p_user_id UUID, 
  p_limit INTEGER DEFAULT 20, 
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  track_id UUID,
  user_id UUID,
  title VARCHAR(255),
  description TEXT,
  activity_type VARCHAR(20),
  distance_meters DECIMAL(12, 2),
  duration_seconds INTEGER,
  elevation_gain_m DECIMAL(8, 2),
  geometry JSONB,
  status VARCHAR(20),
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  shared_at TIMESTAMPTZ,
  likes_count BIGINT,
  comments_count BIGINT,
  user_display_name VARCHAR(100),
  user_avatar_url TEXT,
  user_username VARCHAR(50),
  park_name VARCHAR(255),
  park_code VARCHAR(10),
  trail_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ut.id as track_id,
    ut.user_id,
    ut.title,
    ut.description,
    ut.activity_type,
    ut.distance_meters,
    ut.duration_seconds,
    ut.elevation_gain_m,
    ut.geometry,
    ut.status,
    ut.is_public,
    ut.created_at,
    ut.shared_at,
    COALESCE(tl.likes_count, 0) as likes_count,
    COALESCE(tc.comments_count, 0) as comments_count,
    p.display_name as user_display_name,
    p.avatar_url as user_avatar_url,
    p.username as user_username,
    COALESCE(np.full_name, lp.name) as park_name,
    ut.park_code,
    t.name as trail_name
  FROM user_tracks ut
  INNER JOIN user_follows uf ON ut.user_id = uf.following_id
  LEFT JOIN profiles p ON ut.user_id = p.id
  LEFT JOIN nps_parks np ON ut.park_id = np.id
  LEFT JOIN local_parks lp ON ut.local_park_id = lp.id
  LEFT JOIN trails t ON ut.trail_id = t.id
  LEFT JOIN (
    SELECT track_id, COUNT(*) as likes_count
    FROM track_likes
    GROUP BY track_id
  ) tl ON ut.id = tl.track_id
  LEFT JOIN (
    SELECT track_id, COUNT(*) as comments_count
    FROM track_comments
    GROUP BY track_id
  ) tc ON ut.id = tc.track_id
  WHERE uf.follower_id = p_user_id
    AND ut.is_public = TRUE
    AND ut.status = 'shared'
  ORDER BY ut.shared_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_track_feed TO authenticated;

-- Function to get public tracks for discover feed
CREATE OR REPLACE FUNCTION get_discover_tracks(
  p_limit INTEGER DEFAULT 20, 
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  track_id UUID,
  user_id UUID,
  title VARCHAR(255),
  description TEXT,
  activity_type VARCHAR(20),
  distance_meters DECIMAL(12, 2),
  duration_seconds INTEGER,
  elevation_gain_m DECIMAL(8, 2),
  geometry JSONB,
  created_at TIMESTAMPTZ,
  shared_at TIMESTAMPTZ,
  likes_count BIGINT,
  comments_count BIGINT,
  user_display_name VARCHAR(100),
  user_avatar_url TEXT,
  user_username VARCHAR(50),
  park_name VARCHAR(255),
  park_code VARCHAR(10),
  trail_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ut.id as track_id,
    ut.user_id,
    ut.title,
    ut.description,
    ut.activity_type,
    ut.distance_meters,
    ut.duration_seconds,
    ut.elevation_gain_m,
    ut.geometry,
    ut.created_at,
    ut.shared_at,
    COALESCE(tl.likes_count, 0) as likes_count,
    COALESCE(tc.comments_count, 0) as comments_count,
    p.display_name as user_display_name,
    p.avatar_url as user_avatar_url,
    p.username as user_username,
    COALESCE(np.full_name, lp.name) as park_name,
    ut.park_code,
    t.name as trail_name
  FROM user_tracks ut
  LEFT JOIN profiles p ON ut.user_id = p.id
  LEFT JOIN nps_parks np ON ut.park_id = np.id
  LEFT JOIN local_parks lp ON ut.local_park_id = lp.id
  LEFT JOIN trails t ON ut.trail_id = t.id
  LEFT JOIN (
    SELECT track_id, COUNT(*) as likes_count
    FROM track_likes
    GROUP BY track_id
  ) tl ON ut.id = tl.track_id
  LEFT JOIN (
    SELECT track_id, COUNT(*) as comments_count
    FROM track_comments
    GROUP BY track_id
  ) tc ON ut.id = tc.track_id
  WHERE ut.is_public = TRUE
    AND ut.status = 'shared'
  ORDER BY ut.shared_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_discover_tracks TO anon, authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE user_tracks IS 'GPS tracks recorded by pro users while hiking, biking, or driving through parks';
COMMENT ON TABLE track_points IS 'Individual GPS points for each track with position, altitude, speed, and heading';
COMMENT ON TABLE track_likes IS 'Likes on shared tracks';
COMMENT ON TABLE track_comments IS 'Comments on shared tracks';
COMMENT ON VIEW track_stats IS 'Aggregated stats for tracks (likes, comments)';
COMMENT ON FUNCTION can_user_create_track IS 'Check if user has pro subscription to create tracks';
COMMENT ON FUNCTION calculate_track_stats IS 'Calculate distance, elevation, and other stats from track points';
COMMENT ON FUNCTION finalize_track IS 'Complete a track recording and calculate final statistics';
COMMENT ON FUNCTION get_user_track_feed IS 'Get tracks from followed users for the feed';
COMMENT ON FUNCTION get_discover_tracks IS 'Get public tracks for the discover feed';
