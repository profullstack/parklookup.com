-- Performance Fixes Migration
-- Fixes performance issues identified by Supabase linter:
-- 1. Replace auth.uid() with (select auth.uid()) in RLS policies
-- 2. Replace auth.role() with (select auth.role()) in RLS policies
-- 3. Remove duplicate permissive policies for SELECT operations

-- ============================================
-- PART 1: Fix RLS Policies with auth.uid() and auth.role()
-- Using (select auth.uid()) prevents re-evaluation for each row
-- ============================================

-- profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = (select auth.uid()));

-- favorites table
DROP POLICY IF EXISTS "Users can view their own favorites" ON favorites;
CREATE POLICY "Users can view their own favorites"
  ON favorites FOR SELECT
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own favorites" ON favorites;
CREATE POLICY "Users can insert their own favorites"
  ON favorites FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own favorites" ON favorites;
CREATE POLICY "Users can update their own favorites"
  ON favorites FOR UPDATE
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own favorites" ON favorites;
CREATE POLICY "Users can delete their own favorites"
  ON favorites FOR DELETE
  USING (user_id = (select auth.uid()));

-- import_logs table
DROP POLICY IF EXISTS "Import logs are only accessible by service role" ON import_logs;
CREATE POLICY "Import logs are only accessible by service role"
  ON import_logs FOR ALL
  USING ((select auth.role()) = 'service_role');

-- place_comments table
DROP POLICY IF EXISTS "Authenticated users can create comments" ON place_comments;
CREATE POLICY "Authenticated users can create comments"
  ON place_comments FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own comments" ON place_comments;
CREATE POLICY "Users can update their own comments"
  ON place_comments FOR UPDATE
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own comments" ON place_comments;
CREATE POLICY "Users can delete their own comments"
  ON place_comments FOR DELETE
  USING (user_id = (select auth.uid()));

-- place_likes table
DROP POLICY IF EXISTS "Authenticated users can create likes" ON place_likes;
CREATE POLICY "Authenticated users can create likes"
  ON place_likes FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own likes" ON place_likes;
CREATE POLICY "Users can delete their own likes"
  ON place_likes FOR DELETE
  USING (user_id = (select auth.uid()));

-- park_comments table
DROP POLICY IF EXISTS "Authenticated users can create park comments" ON park_comments;
CREATE POLICY "Authenticated users can create park comments"
  ON park_comments FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own park comments" ON park_comments;
CREATE POLICY "Users can update their own park comments"
  ON park_comments FOR UPDATE
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own park comments" ON park_comments;
CREATE POLICY "Users can delete their own park comments"
  ON park_comments FOR DELETE
  USING (user_id = (select auth.uid()));

-- park_likes table
DROP POLICY IF EXISTS "Authenticated users can create park likes" ON park_likes;
CREATE POLICY "Authenticated users can create park likes"
  ON park_likes FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own park likes" ON park_likes;
CREATE POLICY "Users can delete their own park likes"
  ON park_likes FOR DELETE
  USING (user_id = (select auth.uid()));

-- trips table
DROP POLICY IF EXISTS "Users can view their own trips" ON trips;
CREATE POLICY "Users can view their own trips"
  ON trips FOR SELECT
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own trips" ON trips;
CREATE POLICY "Users can insert their own trips"
  ON trips FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
CREATE POLICY "Users can update their own trips"
  ON trips FOR UPDATE
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own trips" ON trips;
CREATE POLICY "Users can delete their own trips"
  ON trips FOR DELETE
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Service role can manage trips" ON trips;
CREATE POLICY "Service role can manage trips"
  ON trips FOR ALL
  USING ((select auth.role()) = 'service_role');

-- trip_stops table
DROP POLICY IF EXISTS "Users can view stops for their own trips" ON trip_stops;
CREATE POLICY "Users can view stops for their own trips"
  ON trip_stops FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_stops.trip_id 
      AND trips.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert stops for their own trips" ON trip_stops;
CREATE POLICY "Users can insert stops for their own trips"
  ON trip_stops FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_stops.trip_id 
      AND trips.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update stops for their own trips" ON trip_stops;
CREATE POLICY "Users can update stops for their own trips"
  ON trip_stops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_stops.trip_id 
      AND trips.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete stops for their own trips" ON trip_stops;
CREATE POLICY "Users can delete stops for their own trips"
  ON trip_stops FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_stops.trip_id 
      AND trips.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Service role can manage trip_stops" ON trip_stops;
CREATE POLICY "Service role can manage trip_stops"
  ON trip_stops FOR ALL
  USING ((select auth.role()) = 'service_role');

-- product_import_logs table
DROP POLICY IF EXISTS "Product import logs are only accessible by service role" ON product_import_logs;
CREATE POLICY "Product import logs are only accessible by service role"
  ON product_import_logs FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- PART 2: Fix Service Role Policies
-- Remove duplicate SELECT policies - service role already has access via FOR ALL
-- ============================================

-- nps_parks - remove service role SELECT policy (already covered by FOR ALL)
DROP POLICY IF EXISTS "Service role can manage NPS parks" ON nps_parks;
CREATE POLICY "Service role can manage NPS parks"
  ON nps_parks FOR ALL
  USING ((select auth.role()) = 'service_role');

-- wikidata_parks
DROP POLICY IF EXISTS "Service role can manage Wikidata parks" ON wikidata_parks;
CREATE POLICY "Service role can manage Wikidata parks"
  ON wikidata_parks FOR ALL
  USING ((select auth.role()) = 'service_role');

-- park_links
DROP POLICY IF EXISTS "Service role can manage park links" ON park_links;
CREATE POLICY "Service role can manage park links"
  ON park_links FOR ALL
  USING ((select auth.role()) = 'service_role');

-- states
DROP POLICY IF EXISTS "Service role can manage states" ON states;
CREATE POLICY "Service role can manage states"
  ON states FOR ALL
  USING ((select auth.role()) = 'service_role');

-- counties
DROP POLICY IF EXISTS "Service role can manage counties" ON counties;
CREATE POLICY "Service role can manage counties"
  ON counties FOR ALL
  USING ((select auth.role()) = 'service_role');

-- cities
DROP POLICY IF EXISTS "Service role can manage cities" ON cities;
CREATE POLICY "Service role can manage cities"
  ON cities FOR ALL
  USING ((select auth.role()) = 'service_role');

-- state_parks
DROP POLICY IF EXISTS "Service role can manage state parks" ON state_parks;
CREATE POLICY "Service role can manage state parks"
  ON state_parks FOR ALL
  USING ((select auth.role()) = 'service_role');

-- nps_park_locations
DROP POLICY IF EXISTS "Service role can manage park locations" ON nps_park_locations;
CREATE POLICY "Service role can manage park locations"
  ON nps_park_locations FOR ALL
  USING ((select auth.role()) = 'service_role');

-- product_categories
DROP POLICY IF EXISTS "Service role can manage product categories" ON product_categories;
CREATE POLICY "Service role can manage product categories"
  ON product_categories FOR ALL
  USING ((select auth.role()) = 'service_role');

-- products
DROP POLICY IF EXISTS "Service role can manage products" ON products;
CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  USING ((select auth.role()) = 'service_role');

-- park_products
DROP POLICY IF EXISTS "Service role can manage park products" ON park_products;
CREATE POLICY "Service role can manage park products"
  ON park_products FOR ALL
  USING ((select auth.role()) = 'service_role');

-- activity_products
DROP POLICY IF EXISTS "Service role can manage activity products" ON activity_products;
CREATE POLICY "Service role can manage activity products"
  ON activity_products FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- PART 3: Comments
-- ============================================
COMMENT ON POLICY "Users can view their own profile" ON profiles IS 'Optimized with (select auth.uid()) to prevent per-row evaluation';
COMMENT ON POLICY "Service role can manage trips" ON trips IS 'Optimized with (select auth.role()) to prevent per-row evaluation';