-- Migration: Create function to get popular parks with images
-- This function returns NPS parks that have images, sorted by popularity (likes + comments)

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_popular_parks_with_images(INTEGER, INTEGER);

-- Create function to get popular parks with images sorted by popularity
CREATE OR REPLACE FUNCTION get_popular_parks_with_images(
  p_limit INTEGER DEFAULT 8,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  park_code VARCHAR(10),
  full_name TEXT,
  description TEXT,
  states TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  designation TEXT,
  url TEXT,
  images JSONB,
  wikidata_id TEXT,
  wikidata_image TEXT,
  link_confidence NUMERIC,
  source TEXT,
  likes_count BIGINT,
  comments_count BIGINT,
  popularity_score BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.id,
    ap.park_code,
    ap.full_name,
    ap.description,
    ap.states,
    ap.latitude,
    ap.longitude,
    ap.designation,
    ap.url,
    ap.images,
    ap.wikidata_id,
    ap.wikidata_image,
    ap.link_confidence,
    ap.source,
    COALESCE(pl.likes_count, 0) AS likes_count,
    COALESCE(pc.comments_count, 0) AS comments_count,
    COALESCE(pl.likes_count, 0) + COALESCE(pc.comments_count, 0) AS popularity_score
  FROM all_parks ap
  LEFT JOIN (
    SELECT park_code, COUNT(*) AS likes_count
    FROM park_likes
    GROUP BY park_code
  ) pl ON ap.park_code = pl.park_code
  LEFT JOIN (
    SELECT park_code, COUNT(*) AS comments_count
    FROM park_comments
    GROUP BY park_code
  ) pc ON ap.park_code = pc.park_code
  WHERE ap.source = 'nps'
    AND ap.images IS NOT NULL
    AND ap.images != '[]'::JSONB
    AND jsonb_array_length(ap.images) > 0
    AND ap.images->0->>'url' IS NOT NULL
    AND ap.images->0->>'url' != ''
  ORDER BY 
    -- Sort by popularity (likes + comments) descending
    COALESCE(pl.likes_count, 0) + COALESCE(pc.comments_count, 0) DESC,
    -- Then by name for consistent ordering
    ap.full_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_popular_parks_with_images(INTEGER, INTEGER) TO anon, authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION get_popular_parks_with_images IS 'Returns NPS parks with images sorted by popularity (likes + comments count)';
