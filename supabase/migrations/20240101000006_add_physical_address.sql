-- Migration: Add physical_address column to parks tables
-- This stores the geocoded address from HERE API

-- Add physical_address column to nps_parks
ALTER TABLE nps_parks ADD COLUMN IF NOT EXISTS physical_address TEXT;

-- Add physical_address column to wikidata_parks
ALTER TABLE wikidata_parks ADD COLUMN IF NOT EXISTS physical_address TEXT;

-- Update the all_parks view to include physical_address
DROP VIEW IF EXISTS all_parks;

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
  np.physical_address,
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
  wp.physical_address,
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

-- Add comment explaining the column
COMMENT ON COLUMN nps_parks.physical_address IS 'Geocoded physical address from HERE API';
COMMENT ON COLUMN wikidata_parks.physical_address IS 'Geocoded physical address from HERE API';