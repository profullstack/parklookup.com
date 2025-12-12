-- Migration: Update all_parks view to include local parks (county & city parks)
-- This allows the /parks page and search to include local parks

-- Drop the old view
DROP VIEW IF EXISTS all_parks;

-- Create updated view that includes NPS, Wikidata, and Local parks
CREATE OR REPLACE VIEW all_parks AS
-- NPS parks with optional Wikidata data
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

-- Wikidata parks NOT linked to any NPS park (state parks, etc.)
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
)

UNION ALL

-- Local parks (county & city parks from OpenStreetMap)
SELECT 
  lp.id,
  lp.slug AS park_code,
  lp.name AS full_name,
  lp.description,
  s.code AS states,
  lp.latitude,
  lp.longitude,
  CASE 
    WHEN lp.park_type = 'county' THEN 'County Park'
    WHEN lp.park_type = 'city' THEN 'City Park'
    WHEN lp.park_type = 'regional' THEN 'Regional Park'
    WHEN lp.park_type = 'municipal' THEN 'Municipal Park'
    ELSE 'Local Park'
  END AS designation,
  lp.website AS url,
  NULL AS weather_info,
  -- Build images array from park_photos
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'url', pp.image_url,
        'title', COALESCE(pp.title, lp.name),
        'thumb_url', pp.thumb_url
      )
    )
    FROM park_photos pp
    WHERE pp.park_id = lp.id
    LIMIT 5
  ) AS images,
  lp.activities,
  NULL AS operating_hours,
  NULL AS entrance_fees,
  lp.wikidata_id,
  (SELECT pp.image_url FROM park_photos pp WHERE pp.park_id = lp.id AND pp.is_primary = true LIMIT 1) AS wikidata_image,
  NULL AS area,
  NULL AS area_unit,
  NULL AS elevation,
  NULL AS elevation_unit,
  NULL AS inception,
  lp.managing_agency AS managing_org,
  NULL AS commons_category,
  NULL AS link_confidence,
  'local' AS source
FROM local_parks lp
JOIN states s ON lp.state_id = s.id;

-- Grant access to the view
GRANT SELECT ON all_parks TO anon, authenticated;

-- Add comment explaining the view
COMMENT ON VIEW all_parks IS 'Unified view of all parks from NPS, Wikidata, and Local (county/city) sources.';

-- ============================================
-- Update find_nearby_parks function to include local parks
-- ============================================

-- Drop the old function first
DROP FUNCTION IF EXISTS find_nearby_parks(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);

-- Create new function that searches NPS, Wikidata, and Local parks
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
AS $$
BEGIN
  RETURN QUERY
  -- NPS parks
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
  
  -- Wikidata parks (state parks not linked to NPS)
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
  
  UNION ALL
  
  -- Local parks (county & city parks)
  SELECT
    lp.id,
    lp.slug::TEXT AS park_code,
    lp.name::TEXT AS full_name,
    lp.description::TEXT,
    s.code::TEXT AS states,
    lp.latitude,
    lp.longitude,
    CASE 
      WHEN lp.park_type = 'county' THEN 'County Park'
      WHEN lp.park_type = 'city' THEN 'City Park'
      WHEN lp.park_type = 'regional' THEN 'Regional Park'
      WHEN lp.park_type = 'municipal' THEN 'Municipal Park'
      ELSE 'Local Park'
    END::TEXT AS designation,
    lp.website::TEXT AS url,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'url', pp.image_url,
          'title', COALESCE(pp.title, lp.name)
        )
      )
      FROM park_photos pp
      WHERE pp.park_id = lp.id
      LIMIT 3
    ) AS images,
    ST_Distance(
      lp.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000 AS distance_km,
    'local'::TEXT AS source
  FROM local_parks lp
  JOIN states s ON lp.state_id = s.id
  WHERE lp.location IS NOT NULL
    AND ST_DWithin(
      lp.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  
  ORDER BY distance_km ASC
  LIMIT max_results;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_parks TO anon, authenticated;