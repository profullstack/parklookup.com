-- Migration: Add foreign key from track tables to profiles
-- This allows PostgREST to automatically join track_comments, track_likes, and user_tracks with profiles

-- Add foreign key constraint for track_comments (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'track_comments_user_id_profiles_fkey'
    AND table_name = 'track_comments'
  ) THEN
    ALTER TABLE track_comments
    ADD CONSTRAINT track_comments_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for track_likes (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'track_likes_user_id_profiles_fkey'
    AND table_name = 'track_likes'
  ) THEN
    ALTER TABLE track_likes
    ADD CONSTRAINT track_likes_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for user_tracks (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_tracks_user_id_profiles_fkey'
    AND table_name = 'user_tracks'
  ) THEN
    ALTER TABLE user_tracks
    ADD CONSTRAINT user_tracks_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add comments for the constraints
COMMENT ON CONSTRAINT track_comments_user_id_profiles_fkey ON track_comments IS 'Foreign key to profiles for PostgREST joins';
COMMENT ON CONSTRAINT track_likes_user_id_profiles_fkey ON track_likes IS 'Foreign key to profiles for PostgREST joins';
COMMENT ON CONSTRAINT user_tracks_user_id_profiles_fkey ON user_tracks IS 'Foreign key to profiles for PostgREST joins';
