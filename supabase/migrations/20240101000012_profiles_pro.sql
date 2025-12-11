-- Add Pro Tier Support to Profiles
-- This migration adds the is_pro field for free tier enforcement

-- ============================================
-- Add is_pro column to profiles
-- ============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE;

-- Create index for pro status queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro ON profiles(is_pro);

-- ============================================
-- Function to check if user is pro
-- ============================================
CREATE OR REPLACE FUNCTION is_user_pro(p_user_id UUID)
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
GRANT EXECUTE ON FUNCTION is_user_pro TO authenticated;

-- ============================================
-- Function to check if user can create trip
-- Returns true if user is pro OR has no trips yet
-- ============================================
CREATE OR REPLACE FUNCTION can_user_create_trip(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_trip_count INTEGER;
BEGIN
  -- Check if user is pro
  SELECT COALESCE(is_pro, FALSE) INTO v_is_pro
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Pro users can always create trips
  IF v_is_pro THEN
    RETURN TRUE;
  END IF;
  
  -- Free users can only create 1 trip
  SELECT COUNT(*)::INTEGER INTO v_trip_count
  FROM trips 
  WHERE user_id = p_user_id;
  
  RETURN v_trip_count < 1;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_user_create_trip TO authenticated;

-- ============================================
-- Comment for documentation
-- ============================================
COMMENT ON COLUMN profiles.is_pro IS 'Whether the user has a pro subscription. Free users can only create 1 trip.';