import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/places/[dataCid]
 * Get a single place by its data_cid with stats
 */
export async function GET(request, { params }) {
  try {
    const { dataCid } = await params;

    if (!dataCid) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get place details
    const { data: place, error: placeError } = await supabase
      .from('nearby_places')
      .select('*')
      .eq('data_cid', dataCid)
      .single();

    if (placeError) {
      if (placeError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      }
      throw placeError;
    }

    // Get place stats
    const { data: stats, error: statsError } = await supabase
      .from('place_stats')
      .select('*')
      .eq('data_cid', dataCid)
      .single();

    // Get associated parks
    const { data: parkLinks, error: parkLinksError } = await supabase
      .from('park_nearby_places')
      .select('park_id, distance_miles, search_location')
      .eq('place_id', place.id);

    // Get park details for each linked park
    let parks = [];
    if (parkLinks && parkLinks.length > 0) {
      const parkIds = parkLinks.map((link) => link.park_id);

      // Try to get from all_parks view first
      const { data: parkData, error: parkError } = await supabase
        .from('all_parks')
        .select('id, park_code, name, designation, images, latitude, longitude')
        .in('id', parkIds);

      if (!parkError && parkData) {
        parks = parkData.map((park) => {
          const link = parkLinks.find((l) => l.park_id === park.id);
          return {
            ...park,
            distance_miles: link?.distance_miles,
            search_location: link?.search_location,
          };
        });
      }
    }

    return NextResponse.json({
      place: {
        ...place,
        likes_count: stats?.likes_count || 0,
        comments_count: stats?.comments_count || 0,
        avg_user_rating: stats?.avg_user_rating || null,
      },
      parks,
    });
  } catch (error) {
    console.error('Error fetching place:', error);
    return NextResponse.json({ error: 'Failed to fetch place' }, { status: 500 });
  }
}