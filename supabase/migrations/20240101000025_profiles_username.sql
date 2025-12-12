-- Migration: Add username column to profiles table
-- This allows users to have a unique, URL-friendly username

-- Add username column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Create unique index for username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique 
ON profiles(LOWER(username));

-- Create regular index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username);

-- Add a function to generate a default username from email
CREATE OR REPLACE FUNCTION generate_default_username(email_address TEXT)
RETURNS TEXT AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract the part before @ and clean it
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(email_address, '@', 1), '[^a-z0-9]', '', 'g'));
  
  -- Ensure it's at least 3 characters
  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;
  
  -- Truncate to 40 chars to leave room for numbers
  base_username := LEFT(base_username, 40);
  
  final_username := base_username;
  
  -- Check for uniqueness and add number if needed
  WHILE EXISTS (SELECT 1 FROM profiles WHERE LOWER(username) = LOWER(final_username)) LOOP
    counter := counter + 1;
    final_username := base_username || counter::TEXT;
  END LOOP;
  
  RETURN final_username;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing profiles with usernames based on their email
UPDATE profiles 
SET username = generate_default_username(email)
WHERE username IS NULL AND email IS NOT NULL;

-- For any remaining profiles without email, use a UUID-based username
UPDATE profiles 
SET username = 'user_' || SUBSTRING(id::TEXT, 1, 8)
WHERE username IS NULL;

-- Now make username NOT NULL
ALTER TABLE profiles 
ALTER COLUMN username SET NOT NULL;

-- Add constraint to ensure username format (alphanumeric, underscores, 3-50 chars)
ALTER TABLE profiles 
ADD CONSTRAINT chk_username_format 
CHECK (username ~ '^[a-zA-Z0-9_]{3,50}$');

-- Add comment
COMMENT ON COLUMN profiles.username IS 'Unique username for URL-friendly profile links. Must be 3-50 alphanumeric characters or underscores.';