-- Migration: Create all_parks view that includes both NPS and Wikidata parks
-- This allows searching across all parks, not just NPS parks

-- Drop the old view if it exists (we'll recreate it)
DROP VIEW IF EXISTS all_parks;

-- Create a unified view that includes:
-- 1. NPS parks (with optional Wikidata enrichment)
-- 2. Standalone Wikidata parks (state parks not linked to NPS)
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
  wp.wikidata_id AS park_code,  -- Use wikidata_id as park_code for state parks
  wp.label AS full_name,
  NULL AS description,
  wp.state AS states,
  wp.latitude,
  wp.longitude,
  'State Park' AS designation,  -- Default designation for state parks
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

-- Grant access to the view
GRANT SELECT ON all_parks TO anon, authenticated;

-- Create indexes on wikidata_parks for better search performance
CREATE INDEX IF NOT EXISTS idx_wikidata_parks_label ON wikidata_parks(label);
CREATE INDEX IF NOT EXISTS idx_wikidata_parks_search ON wikidata_parks USING GIN(
  to_tsvector('english', coalesce(label, ''))
);

-- Add comment explaining the view
COMMENT ON VIEW all_parks IS 'Unified view of all parks from NPS and Wikidata sources. NPS parks may have linked Wikidata data. Standalone Wikidata parks (state parks) are included separately.';

-- ============================================
-- Update find_nearby_parks function to include all parks
-- ============================================

-- Drop the old function first
DROP FUNCTION IF EXISTS find_nearby_parks(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);

-- Create new function that searches both NPS and Wikidata parks
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
  
  ORDER BY distance_km ASC
  LIMIT max_results;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_parks TO anon, authenticated;