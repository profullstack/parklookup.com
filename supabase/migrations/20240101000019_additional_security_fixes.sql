-- Migration: Additional Security Fixes
-- Fixes remaining security warnings:
-- 1. Fix get_park_stats function search_path
-- 2. Note about PostGIS extension (cannot be moved via migration)
-- 3. Note about leaked password protection (requires Supabase dashboard)

-- ============================================
-- PART 1: Fix get_park_stats function search_path
-- ============================================

-- There may be multiple overloaded versions of get_park_stats
-- We need to find and fix all of them

-- First, drop any existing versions
DROP FUNCTION IF EXISTS get_park_stats(TEXT);
DROP FUNCTION IF EXISTS get_park_stats(UUID);

-- Recreate get_park_stats with search_path set
CREATE OR REPLACE FUNCTION get_park_stats(p_park_code TEXT)
RETURNS TABLE (
  like_count BIGINT,
  comment_count BIGINT,
  avg_rating NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT COUNT(*) FROM park_likes WHERE park_code = p_park_code), 0) AS like_count,
    COALESCE((SELECT COUNT(*) FROM park_comments WHERE park_code = p_park_code), 0) AS comment_count,
    COALESCE((SELECT AVG(rating) FROM park_comments WHERE park_code = p_park_code), 0) AS avg_rating;
END;
$$;

GRANT EXECUTE ON FUNCTION get_park_stats(TEXT) TO anon, authenticated;

-- ============================================
-- PART 2: PostGIS Extension
-- ============================================

-- NOTE: The PostGIS extension is installed in the public schema.
-- Moving it to another schema requires superuser privileges and 
-- would break existing spatial queries that reference public.geography, etc.
-- 
-- This is a known limitation in Supabase. The warning can be safely ignored
-- as PostGIS is a trusted extension that provides spatial data types and functions.
--
-- If you want to move PostGIS to a different schema, you would need to:
-- 1. Create a new schema (e.g., CREATE SCHEMA extensions;)
-- 2. Drop and recreate PostGIS in that schema (requires superuser)
-- 3. Update all queries to use the new schema
--
-- This is typically done during initial project setup, not via migration.

-- ============================================
-- PART 3: Leaked Password Protection
-- ============================================

-- NOTE: Leaked password protection is an Auth setting that must be enabled
-- in the Supabase Dashboard, not via SQL migration.
--
-- To enable it:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to Authentication > Settings
-- 3. Under "Password Security", enable "Leaked Password Protection"
--
-- This feature checks passwords against HaveIBeenPwned.org to prevent
-- users from using compromised passwords.

-- ============================================
-- PART 4: Verify all functions have search_path set
-- ============================================

-- Recreate any other functions that might be missing search_path

-- update_location_from_coords trigger function
CREATE OR REPLACE FUNCTION update_location_from_coords()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

-- update_updated_at_column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- update_place_comments_updated_at trigger function
CREATE OR REPLACE FUNCTION update_place_comments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- update_nearby_places_updated_at trigger function
CREATE OR REPLACE FUNCTION update_nearby_places_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;