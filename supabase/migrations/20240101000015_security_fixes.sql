-- Security Fixes Migration
-- Fixes security issues identified by Supabase linter:
-- 1. Remove SECURITY DEFINER from views
-- 2. Enable RLS on tables missing it
-- 3. Set search_path on functions

-- ============================================
-- PART 1: Fix SECURITY DEFINER Views
-- Views need to be recreated without SECURITY DEFINER
-- ============================================

-- Drop and recreate parks_combined view
DROP VIEW IF EXISTS parks_combined CASCADE;
CREATE VIEW parks_combined AS
SELECT
  np.id,
  np.park_code,
  np.full_name,
  np.description,
  np.states,
  np.latitude,
  np.longitude,
  np.designation,
  np.url,
  np.weather_info,
  np.images,
  np.activities,
  np.operating_hours,
  np.entrance_fees,
  wp.wikidata_id,
  wp.image_url AS wikidata_image,
  wp.area,
  wp.area_unit,
  wp.elevation,
  wp.elevation_unit,
  wp.inception,
  wp.managing_org,
  wp.commons_category,
  pl.confidence_score AS link_confidence
FROM nps_parks np
LEFT JOIN park_links pl ON np.id = pl.nps_park_id
LEFT JOIN wikidata_parks wp ON pl.wikidata_park_id = wp.id;

GRANT SELECT ON parks_combined TO anon, authenticated;

-- Drop and recreate parks_by_state view
-- Using the original schema which joins through nps_park_locations
DROP VIEW IF EXISTS parks_by_state CASCADE;
CREATE VIEW parks_by_state AS
SELECT
  s.id AS state_id,
  s.code AS state_code,
  s.name AS state_name,
  s.slug AS state_slug,
  np.id AS park_id,
  np.park_code,
  np.full_name,
  np.description,
  np.latitude,
  np.longitude,
  np.designation,
  np.images
FROM states s
LEFT JOIN nps_park_locations npl ON s.id = npl.state_id
LEFT JOIN nps_parks np ON npl.nps_park_id = np.id
ORDER BY s.name, np.full_name;

GRANT SELECT ON parks_by_state TO anon, authenticated;

-- Drop and recreate all_parks_by_state view
-- Using the original schema which joins through nps_park_locations
DROP VIEW IF EXISTS all_parks_by_state CASCADE;
CREATE VIEW all_parks_by_state AS
SELECT
  s.id AS state_id,
  s.code AS state_code,
  s.name AS state_name,
  s.slug AS state_slug,
  'national' AS park_category,
  np.id AS park_id,
  np.park_code AS park_code,
  np.full_name AS park_name,
  np.description,
  np.latitude,
  np.longitude,
  np.designation AS park_type,
  np.images
FROM states s
LEFT JOIN nps_park_locations npl ON s.id = npl.state_id
LEFT JOIN nps_parks np ON npl.nps_park_id = np.id
WHERE np.id IS NOT NULL
UNION ALL
SELECT
  s.id AS state_id,
  s.code AS state_code,
  s.name AS state_name,
  s.slug AS state_slug,
  'state' AS park_category,
  sp.id AS park_id,
  sp.slug AS park_code,
  sp.name AS park_name,
  sp.description,
  sp.latitude,
  sp.longitude,
  sp.park_type,
  sp.images
FROM states s
LEFT JOIN state_parks sp ON s.id = sp.state_id
WHERE sp.id IS NOT NULL
ORDER BY state_name, park_name;

GRANT SELECT ON all_parks_by_state TO anon, authenticated;

-- Drop and recreate place_stats view
-- Using place_id as the join column (matching original schema)
DROP VIEW IF EXISTS place_stats CASCADE;
CREATE VIEW place_stats AS
SELECT
  np.id AS place_id,
  np.title,
  COALESCE(likes.like_count, 0) AS like_count,
  COALESCE(comments.comment_count, 0) AS comment_count,
  COALESCE(comments.avg_rating, 0) AS avg_rating
FROM nearby_places np
LEFT JOIN (
  SELECT place_id, COUNT(*) AS like_count
  FROM place_likes
  GROUP BY place_id
) likes ON np.id = likes.place_id
LEFT JOIN (
  SELECT place_id, COUNT(*) AS comment_count, AVG(rating) AS avg_rating
  FROM place_comments
  WHERE rating IS NOT NULL
  GROUP BY place_id
) comments ON np.id = comments.place_id;

GRANT SELECT ON place_stats TO anon, authenticated;

-- Drop and recreate trips_with_stops view
DROP VIEW IF EXISTS trips_with_stops CASCADE;
CREATE VIEW trips_with_stops AS
SELECT 
  t.id,
  t.user_id,
  t.title,
  t.origin,
  t.origin_lat,
  t.origin_lng,
  t.start_date,
  t.end_date,
  t.interests,
  t.difficulty,
  t.radius_miles,
  t.ai_summary,
  t.created_at,
  t.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', ts.id,
        'day_number', ts.day_number,
        'park_code', ts.park_code,
        'park_name', np.full_name,
        'park_images', np.images,
        'activities', ts.activities,
        'morning_plan', ts.morning_plan,
        'afternoon_plan', ts.afternoon_plan,
        'evening_plan', ts.evening_plan,
        'driving_notes', ts.driving_notes,
        'highlights', ts.highlights,
        'order_index', ts.order_index
      ) ORDER BY ts.day_number, ts.order_index
    ) FILTER (WHERE ts.id IS NOT NULL),
    '[]'::json
  ) AS stops
FROM trips t
LEFT JOIN trip_stops ts ON t.id = ts.trip_id
LEFT JOIN nps_parks np ON ts.park_code = np.park_code
GROUP BY t.id;

GRANT SELECT ON trips_with_stops TO authenticated;

-- Drop and recreate all_parks view
DROP VIEW IF EXISTS all_parks CASCADE;
CREATE VIEW all_parks AS
SELECT 
  np.id,
  np.park_code,
  np.full_name,
  np.description,
  np.states,
  np.latitude,
  np.longitude,
  np.designation,
  np.url,
  np.weather_info,
  np.images,
  np.activities,
  np.operating_hours,
  np.entrance_fees,
  wp.wikidata_id,
  wp.image_url AS wikidata_image,
  wp.area,
  wp.area_unit,
  wp.elevation,
  wp.elevation_unit,
  wp.inception,
  wp.managing_org,
  wp.commons_category,
  pl.confidence_score AS link_confidence,
  'nps' AS source
FROM nps_parks np
LEFT JOIN park_links pl ON np.id = pl.nps_park_id
LEFT JOIN wikidata_parks wp ON pl.wikidata_park_id = wp.id
UNION ALL
SELECT 
  wp.id,
  wp.wikidata_id AS park_code,
  wp.label AS full_name,
  NULL AS description,
  wp.state AS states,
  wp.latitude,
  wp.longitude,
  'State Park' AS designation,
  wp.website AS url,
  NULL AS weather_info,
  CASE 
    WHEN wp.image_url IS NOT NULL THEN 
      jsonb_build_array(jsonb_build_object('url', wp.image_url, 'title', wp.label))
    ELSE NULL 
  END AS images,
  NULL AS activities,
  NULL AS operating_hours,
  NULL AS entrance_fees,
  wp.wikidata_id,
  wp.image_url AS wikidata_image,
  wp.area,
  wp.area_unit,
  wp.elevation,
  wp.elevation_unit,
  wp.inception,
  wp.managing_org,
  wp.commons_category,
  NULL AS link_confidence,
  'wikidata' AS source
FROM wikidata_parks wp
WHERE NOT EXISTS (
  SELECT 1 FROM park_links pl WHERE pl.wikidata_park_id = wp.id
);

GRANT SELECT ON all_parks TO anon, authenticated;

-- ============================================
-- PART 2: Enable RLS on Tables
-- ============================================

-- NOTE: spatial_ref_sys is a PostGIS system table owned by the postgres user.
-- We cannot enable RLS on it as we don't have ownership permissions.
-- This is a known limitation and the table only contains reference data.

-- Enable RLS on park_nearby_places
ALTER TABLE IF EXISTS park_nearby_places ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all reads on park_nearby_places (public data)
DROP POLICY IF EXISTS "Allow read access to park_nearby_places" ON park_nearby_places;
CREATE POLICY "Allow read access to park_nearby_places"
  ON park_nearby_places FOR SELECT
  USING (true);

-- Service role can manage park_nearby_places
DROP POLICY IF EXISTS "Service role can manage park_nearby_places" ON park_nearby_places;
CREATE POLICY "Service role can manage park_nearby_places"
  ON park_nearby_places FOR ALL
  USING (auth.role() = 'service_role');

-- Enable RLS on nearby_places
ALTER TABLE IF EXISTS nearby_places ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all reads on nearby_places (public data)
DROP POLICY IF EXISTS "Allow read access to nearby_places" ON nearby_places;
CREATE POLICY "Allow read access to nearby_places"
  ON nearby_places FOR SELECT
  USING (true);

-- Service role can manage nearby_places
DROP POLICY IF EXISTS "Service role can manage nearby_places" ON nearby_places;
CREATE POLICY "Service role can manage nearby_places"
  ON nearby_places FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- PART 3: Fix Function Search Paths
-- Set search_path to prevent search path injection attacks
-- ============================================

-- Fix find_nearby_parks function
CREATE OR REPLACE FUNCTION find_nearby_parks(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 100000,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  park_code TEXT,
  full_name TEXT,
  description TEXT,
  states TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  designation TEXT,
  url TEXT,
  images JSONB,
  distance_km DOUBLE PRECISION,
  source TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.id,
    np.park_code::TEXT,
    np.full_name::TEXT,
    np.description::TEXT,
    np.states::TEXT,
    np.latitude,
    np.longitude,
    np.designation::TEXT,
    np.url::TEXT,
    np.images,
    ST_Distance(
      np.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000 AS distance_km,
    'nps'::TEXT AS source
  FROM nps_parks np
  WHERE np.location IS NOT NULL
    AND ST_DWithin(
      np.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  
  UNION ALL
  
  SELECT
    wp.id,
    wp.wikidata_id::TEXT AS park_code,
    wp.label::TEXT AS full_name,
    NULL::TEXT AS description,
    wp.state::TEXT AS states,
    wp.latitude,
    wp.longitude,
    'State Park'::TEXT AS designation,
    wp.website::TEXT AS url,
    CASE
      WHEN wp.image_url IS NOT NULL THEN
        jsonb_build_array(jsonb_build_object('url', wp.image_url, 'title', wp.label))
      ELSE NULL
    END AS images,
    ST_Distance(
      wp.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000 AS distance_km,
    'wikidata'::TEXT AS source
  FROM wikidata_parks wp
  WHERE wp.location IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM park_links pl WHERE pl.wikidata_park_id = wp.id
    )
    AND ST_DWithin(
      wp.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  
  ORDER BY distance_km ASC
  LIMIT max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION find_nearby_parks TO anon, authenticated;

-- Fix update_location_from_coords function
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

-- Fix update_updated_at_column function
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

-- Fix update_place_comments_updated_at function
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

-- Fix can_user_create_trip function
CREATE OR REPLACE FUNCTION can_user_create_trip(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_trip_count INTEGER;
BEGIN
  SELECT COALESCE(is_pro, FALSE) INTO v_is_pro
  FROM profiles 
  WHERE id = p_user_id;
  
  IF v_is_pro THEN
    RETURN TRUE;
  END IF;
  
  SELECT COUNT(*)::INTEGER INTO v_trip_count
  FROM trips 
  WHERE user_id = p_user_id;
  
  RETURN v_trip_count < 1;
END;
$$;

GRANT EXECUTE ON FUNCTION can_user_create_trip TO authenticated;

-- Fix count_user_trips function
CREATE OR REPLACE FUNCTION count_user_trips(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM trips 
    WHERE user_id = p_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION count_user_trips TO authenticated;

-- Fix get_park_stats function (if it exists)
-- Note: There may be multiple overloaded versions of this function
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

-- Grant with explicit signature to avoid ambiguity
GRANT EXECUTE ON FUNCTION get_park_stats(TEXT) TO anon, authenticated;

-- Fix is_user_pro function
CREATE OR REPLACE FUNCTION is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(is_pro, FALSE)
    FROM profiles 
    WHERE id = p_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_user_pro TO authenticated;

-- Fix update_nearby_places_updated_at function
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

-- ============================================
-- PART 4: Comments
-- ============================================
COMMENT ON VIEW parks_combined IS 'Combined view of NPS parks with linked Wikidata data';
COMMENT ON VIEW parks_by_state IS 'NPS parks organized by state';
COMMENT ON VIEW all_parks_by_state IS 'All parks (NPS and Wikidata) organized by state';
COMMENT ON VIEW place_stats IS 'Aggregated stats for places (likes, comments, ratings)';
COMMENT ON VIEW trips_with_stops IS 'Trips with their associated stops and park details';
COMMENT ON VIEW all_parks IS 'Unified view of all parks from NPS and Wikidata sources';