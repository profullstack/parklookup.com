-- Function to find nearby parks using PostGIS
-- This function uses ST_DWithin for efficient spatial queries

CREATE OR REPLACE FUNCTION find_nearby_parks(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 100000,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  park_code VARCHAR(10),
  full_name VARCHAR(255),
  description TEXT,
  states VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  designation VARCHAR(100),
  url VARCHAR(500),
  images JSONB,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
    np.images,
    ST_Distance(
      np.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000 AS distance_km
  FROM nps_parks np
  WHERE np.location IS NOT NULL
    AND ST_DWithin(
      np.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_km ASC
  LIMIT max_results;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_parks TO anon, authenticated;