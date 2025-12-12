/**
 * Local Parks API Route
 *
 * GET /api/local-parks - List local parks with filtering and pagination
 *
 * Query Parameters:
 *   - state: Filter by state code (e.g., CA)
 *   - county: Filter by county slug
 *   - city: Filter by city slug
 *   - park_type: Filter by park type (county, city, regional, municipal)
 *   - access: Filter by access type (Open, Restricted, Unknown)
 *   - page: Page number (default: 1)
 *   - limit: Results per page (default: 20, max: 100)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Default page size */
const DEFAULT_LIMIT = 20;

/** Maximum page size */
const MAX_LIMIT = 100;

/**
 * GET /api/local-parks
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const stateCode = searchParams.get('state')?.toUpperCase();
    const countySlug = searchParams.get('county');
    const citySlug = searchParams.get('city');
    const parkType = searchParams.get('park_type');
    const access = searchParams.get('access');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || DEFAULT_LIMIT.toString(), 10))
    );

    const offset = (page - 1) * limit;

    // Create Supabase client
    const supabase = await createClient();

    // Build query
    let query = supabase
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
        state_id,
        county_id,
        city_id,
        wikidata_id,
        created_at,
        states!inner(id, code, name, slug),
        counties(id, name, slug),
        cities(id, name, slug)
      `,
        { count: 'exact' }
      )
      .order('name', { ascending: true });

    // Apply filters
    if (stateCode) {
      query = query.eq('states.code', stateCode);
    }

    if (countySlug) {
      query = query.eq('counties.slug', countySlug);
    }

    if (citySlug) {
      query = query.eq('cities.slug', citySlug);
    }

    if (parkType) {
      query = query.eq('park_type', parkType);
    }

    if (access) {
      query = query.eq('access', access);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: parks, error, count } = await query;

    if (error) {
      console.error('Error fetching local parks:', error);
      return NextResponse.json({ error: 'Failed to fetch parks' }, { status: 500 });
    }

    // Fetch primary photos for parks
    const parkIds = parks?.map((p) => p.id) || [];
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

    // Transform response
    const transformedParks = parks?.map((park) => ({
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
      created_at: park.created_at,
    }));

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      parks: transformedParks || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error in local parks API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}