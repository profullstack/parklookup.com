-- Migration: Add foreign key from media_comments to profiles
-- This allows PostgREST to automatically join media_comments with profiles

-- First, we need to add a foreign key constraint from media_comments.user_id to profiles.id
-- This is safe because profiles.id references auth.users(id) and media_comments.user_id also references auth.users(id)

-- Add foreign key constraint (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'media_comments_user_id_profiles_fkey'
    AND table_name = 'media_comments'
  ) THEN
    ALTER TABLE media_comments
    ADD CONSTRAINT media_comments_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Also add the same for media_likes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'media_likes_user_id_profiles_fkey'
    AND table_name = 'media_likes'
  ) THEN
    ALTER TABLE media_likes
    ADD CONSTRAINT media_likes_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Also add the same for user_media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_media_user_id_profiles_fkey'
    AND table_name = 'user_media'
  ) THEN
    ALTER TABLE user_media
    ADD CONSTRAINT user_media_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Also add the same for user_follows (both follower and following)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_follows_follower_id_profiles_fkey'
    AND table_name = 'user_follows'
  ) THEN
    ALTER TABLE user_follows
    ADD CONSTRAINT user_follows_follower_id_profiles_fkey
    FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_follows_following_id_profiles_fkey'
    AND table_name = 'user_follows'
  ) THEN
    ALTER TABLE user_follows
    ADD CONSTRAINT user_follows_following_id_profiles_fkey
    FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON CONSTRAINT media_comments_user_id_profiles_fkey ON media_comments IS 'Foreign key to profiles for PostgREST joins';
COMMENT ON CONSTRAINT media_likes_user_id_profiles_fkey ON media_likes IS 'Foreign key to profiles for PostgREST joins';
COMMENT ON CONSTRAINT user_media_user_id_profiles_fkey ON user_media IS 'Foreign key to profiles for PostgREST joins';
COMMENT ON CONSTRAINT user_follows_follower_id_profiles_fkey ON user_follows IS 'Foreign key to profiles for PostgREST joins';
COMMENT ON CONSTRAINT user_follows_following_id_profiles_fkey ON user_follows IS 'Foreign key to profiles for PostgREST joins';