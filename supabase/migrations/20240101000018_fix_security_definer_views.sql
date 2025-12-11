-- Migration: Fix SECURITY DEFINER views
-- This migration explicitly sets SECURITY INVOKER on all views
-- to fix the security_definer_view linter errors

-- ============================================
-- PART 1: Recreate views with SECURITY INVOKER
-- ============================================

-- Drop and recreate parks_combined view with SECURITY INVOKER
DROP VIEW IF EXISTS parks_combined CASCADE;
CREATE VIEW parks_combined
WITH (security_invoker = true)
AS
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

-- Drop and recreate parks_by_state view with SECURITY INVOKER
DROP VIEW IF EXISTS parks_by_state CASCADE;
CREATE VIEW parks_by_state
WITH (security_invoker = true)
AS
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

-- Drop and recreate all_parks_by_state view with SECURITY INVOKER
DROP VIEW IF EXISTS all_parks_by_state CASCADE;
CREATE VIEW all_parks_by_state
WITH (security_invoker = true)
AS
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

-- Drop and recreate place_stats view with SECURITY INVOKER
DROP VIEW IF EXISTS place_stats CASCADE;
CREATE VIEW place_stats
WITH (security_invoker = true)
AS
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

-- Drop and recreate trips_with_stops view with SECURITY INVOKER
DROP VIEW IF EXISTS trips_with_stops CASCADE;
CREATE VIEW trips_with_stops
WITH (security_invoker = true)
AS
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

-- Drop and recreate all_parks view with SECURITY INVOKER
DROP VIEW IF EXISTS all_parks CASCADE;
CREATE VIEW all_parks
WITH (security_invoker = true)
AS
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
-- PART 2: Handle spatial_ref_sys table
-- This is a PostGIS system table that we cannot modify directly.
-- ============================================

-- Note: spatial_ref_sys is owned by the postgres superuser and is part of PostGIS.
-- We cannot enable RLS on it as we don't have ownership permissions.
-- This is a known limitation - the table only contains reference data for coordinate systems.
-- The Supabase linter warning for this table can be safely ignored.

-- ============================================
-- PART 3: Add comments to views
-- ============================================
COMMENT ON VIEW parks_combined IS 'Combined view of NPS parks with linked Wikidata data (SECURITY INVOKER)';
COMMENT ON VIEW parks_by_state IS 'NPS parks organized by state (SECURITY INVOKER)';
COMMENT ON VIEW all_parks_by_state IS 'All parks (NPS and Wikidata) organized by state (SECURITY INVOKER)';
COMMENT ON VIEW place_stats IS 'Aggregated stats for places (likes, comments, ratings) (SECURITY INVOKER)';
COMMENT ON VIEW trips_with_stops IS 'Trips with their associated stops and park details (SECURITY INVOKER)';
COMMENT ON VIEW all_parks IS 'Unified view of all parks from NPS and Wikidata sources (SECURITY INVOKER)';