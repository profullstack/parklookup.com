-- Query Optimization Migration
-- Adds indexes to improve query performance for common operations

-- ============================================
-- PART 1: Indexes for all_parks view performance
-- The all_parks view uses UNION ALL across nps_parks and wikidata_parks
-- ============================================

-- Index for sorting by full_name (common query pattern)
CREATE INDEX IF NOT EXISTS idx_nps_parks_full_name ON nps_parks(full_name);
CREATE INDEX IF NOT EXISTS idx_wikidata_parks_label ON wikidata_parks(label);

-- Index for filtering by source (nps vs wikidata)
-- This helps when the view is filtered by source type

-- Composite index for common query patterns on nps_parks
CREATE INDEX IF NOT EXISTS idx_nps_parks_states_designation ON nps_parks(states, designation);

-- Index for park_links lookups (used in NOT EXISTS subquery)
CREATE INDEX IF NOT EXISTS idx_park_links_wikidata_park_id ON park_links(wikidata_park_id);

-- ============================================
-- PART 2: Indexes for nearby_places performance
-- ============================================

-- Index for data_cid lookups (used in upserts)
CREATE INDEX IF NOT EXISTS idx_nearby_places_data_cid ON nearby_places(data_cid);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_nearby_places_category ON nearby_places(category);

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_nearby_places_lat_lng ON nearby_places(latitude, longitude);

-- ============================================
-- PART 3: Indexes for park_nearby_places performance
-- ============================================

-- Composite index for park_id and place_id lookups
CREATE INDEX IF NOT EXISTS idx_park_nearby_places_park_place ON park_nearby_places(park_id, place_id);

-- ============================================
-- PART 4: Indexes for favorites performance
-- ============================================

-- Index for user favorites lookups
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- Composite index for user + nps_park lookups
CREATE INDEX IF NOT EXISTS idx_favorites_user_nps_park ON favorites(user_id, nps_park_id);

-- Index for wikidata_park_id if the column exists (added in later migration)
-- This will silently fail if the column doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'favorites' AND column_name = 'wikidata_park_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_favorites_user_wikidata ON favorites(user_id, wikidata_park_id);
  END IF;
END $$;

-- ============================================
-- PART 5: Indexes for trips performance
-- ============================================

-- Index for user trips lookups
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);

-- Index for trip_stops by trip_id
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id ON trip_stops(trip_id);

-- ============================================
-- PART 6: Analyze tables to update statistics
-- ============================================

-- Update statistics for query planner
ANALYZE nps_parks;
ANALYZE wikidata_parks;
ANALYZE park_links;
ANALYZE nearby_places;
ANALYZE park_nearby_places;
ANALYZE favorites;
ANALYZE trips;
ANALYZE trip_stops;

-- ============================================
-- PART 7: Comments
-- ============================================
COMMENT ON INDEX idx_nps_parks_full_name IS 'Improves sorting by park name in all_parks view';
COMMENT ON INDEX idx_wikidata_parks_label IS 'Improves sorting by park name in all_parks view';
COMMENT ON INDEX idx_park_links_wikidata_park_id IS 'Improves NOT EXISTS subquery in all_parks view';
COMMENT ON INDEX idx_nearby_places_data_cid IS 'Improves upsert performance for nearby_places';