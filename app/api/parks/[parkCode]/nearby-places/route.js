/**
 * Nearby Places API Route
 * GET /api/parks/[parkCode]/nearby-places - Get nearby places for a park
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET handler for nearby places
 * Query params:
 *   - category: Filter by category (dining, entertainment, bars, lodging, shopping, attractions)
 *   - limit: Maximum number of results (default: 20)
 */
export async function GET(request, { params }) {
  try {
    const { parkCode } = params;

    if (!parkCode) {
      return NextResponse.json({ error: 'Park code is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const supabase = createServerClient();

    // First, get the park ID from the park code
    const { data: park, error: parkError } = await supabase
      .from('all_parks')
      .select('id')
      .eq('park_code', parkCode)
      .single();

    if (parkError || !park) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
    }

    // Build query for nearby places
    let query = supabase
      .from('park_nearby_places')
      .select(
        `
        place_id,
        distance_miles,
        search_location,
        nearby_places (
          id,
          data_cid,
          title,
          category,
          address,
          phone,
          website,
          latitude,
          longitude,
          rating,
          reviews_count,
          price_level,
          thumbnail,
          hours,
          description
        )
      `
      )
      .eq('park_id', park.id);

    // Apply category filter if provided
    if (category) {
      query = query.eq('nearby_places.category', category);
    }

    // Apply limit
    query = query.limit(limit);

    const { data: placesData, error: placesError } = await query;

    if (placesError) {
      console.error('Error fetching nearby places:', placesError);
      return NextResponse.json({ error: 'Failed to fetch nearby places' }, { status: 500 });
    }

    // Transform the data to a cleaner format
    const places = placesData
      .filter((item) => item.nearby_places) // Filter out any null joins
      .map((item) => ({
        ...item.nearby_places,
        distanceMiles: item.distance_miles,
        searchLocation: item.search_location,
      }));

    // Group by category for easier frontend consumption
    const byCategory = places.reduce((acc, place) => {
      const cat = place.category;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(place);
      return acc;
    }, {});

    return NextResponse.json({
      parkCode,
      places,
      byCategory,
      total: places.length,
    });
  } catch (error) {
    console.error('Nearby places API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}