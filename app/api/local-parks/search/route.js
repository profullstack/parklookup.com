/**
 * Local Parks Search API Route
 *
 * GET /api/local-parks/search - Full-text search for local parks
 *
 * Query Parameters:
 *   - q: Search query (required)
 *   - state: Filter by state code (e.g., CA)
 *   - park_type: Filter by park type (county, city, regional, municipal)
 *   - access: Filter by access type (Open, Restricted, Unknown)
 *   - lat: Latitude for distance sorting
 *   - lng: Longitude for distance sorting
 *   - radius: Search radius in miles (default: 50, requires lat/lng)
 *   - page: Page number (default: 1)
 *   - limit: Results per page (default: 20, max: 100)
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/** Default page size */
const DEFAULT_LIMIT = 20;

/** Maximum page size */
const MAX_LIMIT = 100;

/** Default search radius in miles */
const DEFAULT_RADIUS = 50;

/**
 * GET /api/local-parks/search
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const query = searchParams.get('q')?.trim();
    const stateCode = searchParams.get('state')?.toUpperCase();
    const parkType = searchParams.get('park_type');
    const access = searchParams.get('access');
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')) : null;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')) : null;
    const radius = parseFloat(searchParams.get('radius') || DEFAULT_RADIUS.toString());
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || DEFAULT_LIMIT.toString(), 10))
    );

    // Validate query
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    // Create Supabase client
    const supabase = createServiceClient();

    // Check if we should use nearby search
    const useNearbySearch = lat !== null && lng !== null;

    let parks = [];
    let count = 0;

    if (useNearbySearch) {
      // Use the find_nearby_local_parks function with text filter
      const { data, error } = await supabase.rpc('find_nearby_local_parks', {
        lat,
        lng,
        radius_miles: Math.round(radius),
        limit_count: limit * 10, // Fetch more to filter
      });

      if (error) {
        console.error('Error in nearby search:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      // Filter by search query
      const queryLower = query.toLowerCase();
      let filtered = (data || []).filter(
        (park) =>
          park.name?.toLowerCase().includes(queryLower) ||
          park.managing_agency?.toLowerCase().includes(queryLower)
      );

      // Apply additional filters
      if (stateCode) {
        filtered = filtered.filter((p) => p.state_code === stateCode);
      }
      if (parkType) {
        filtered = filtered.filter((p) => p.park_type === parkType);
      }
      if (access) {
        filtered = filtered.filter((p) => p.access === access);
      }

      count = filtered.length;
      parks = filtered.slice(offset, offset + limit).map((park) => ({
        id: park.id,
        name: park.name,
        slug: park.slug,
        park_type: park.park_type,
        managing_agency: park.managing_agency,
        latitude: park.latitude,
        longitude: park.longitude,
        access: park.access,
        state: { code: park.state_code },
        county: park.county_name ? { name: park.county_name } : null,
        city: park.city_name ? { name: park.city_name } : null,
        distance_miles: park.distance_miles,
        primary_photo_url: park.primary_photo_url,
      }));
    } else {
      // Use full-text search
      // Build the search query using PostgreSQL full-text search
      let dbQuery = supabase
        .from('local_parks')
        .select(
          `
          id,
          name,
          slug,
          park_type,
          managing_agency,
          latitude,
          longitude,
          access,
          wikidata_id,
          states!inner(code, name, slug),
          counties(name, slug),
          cities(name, slug)
        `,
          { count: 'exact' }
        )
        .or(`name.ilike.%${query}%,managing_agency.ilike.%${query}%`)
        .order('name', { ascending: true });

      // Apply filters
      if (stateCode) {
        dbQuery = dbQuery.eq('states.code', stateCode);
      }
      if (parkType) {
        dbQuery = dbQuery.eq('park_type', parkType);
      }
      if (access) {
        dbQuery = dbQuery.eq('access', access);
      }

      // Apply pagination
      dbQuery = dbQuery.range(offset, offset + limit - 1);

      const { data, error, count: totalCount } = await dbQuery;

      if (error) {
        console.error('Error in text search:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      count = totalCount || 0;

      // Fetch primary photos
      const parkIds = data?.map((p) => p.id) || [];
      let photosMap = {};

      if (parkIds.length > 0) {
        const { data: photos } = await supabase
          .from('park_photos')
          .select('park_id, thumb_url')
          .in('park_id', parkIds)
          .eq('is_primary', true);

        if (photos) {
          photosMap = photos.reduce((acc, photo) => {
            acc[photo.park_id] = photo.thumb_url;
            return acc;
          }, {});
        }
      }

      parks = (data || []).map((park) => ({
        id: park.id,
        name: park.name,
        slug: park.slug,
        park_type: park.park_type,
        managing_agency: park.managing_agency,
        latitude: park.latitude,
        longitude: park.longitude,
        access: park.access,
        wikidata_id: park.wikidata_id,
        state: park.states
          ? {
              code: park.states.code,
              name: park.states.name,
              slug: park.states.slug,
            }
          : null,
        county: park.counties
          ? {
              name: park.counties.name,
              slug: park.counties.slug,
            }
          : null,
        city: park.cities
          ? {
              name: park.cities.name,
              slug: park.cities.slug,
            }
          : null,
        primary_photo_url: photosMap[park.id] || null,
      }));
    }

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);

    return NextResponse.json({
      query,
      parks,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        state: stateCode || null,
        park_type: parkType || null,
        access: access || null,
        location: useNearbySearch ? { lat, lng, radius } : null,
      },
    });
  } catch (error) {
    console.error('Error in local parks search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}