/**
 * Single Trip API Route
 * GET /api/trips/[id] - Fetch a single trip with full details
 * DELETE /api/trips/[id] - Delete a trip
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Get authenticated user from request
 * @param {Request} request - Incoming request
 * @returns {Promise<Object|null>} User object or null
 */
const getAuthenticatedUser = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  // Use service role to validate the token - this bypasses RLS for auth operations
  const supabase = createServerClient({ useServiceRole: true });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.error('Auth error:', error?.message);
    return null;
  }

  return user;
};

/**
 * Validate UUID format
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid UUID
 */
const isValidUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * GET handler for fetching a single trip
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Validate trip ID
    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid trip ID' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Fetch trip with all details
    const { data: trip, error } = await supabase
      .from('trips')
      .select(`
        id,
        user_id,
        title,
        origin,
        origin_lat,
        origin_lng,
        start_date,
        end_date,
        interests,
        difficulty,
        radius_miles,
        ai_summary,
        created_at,
        updated_at,
        trip_stops (
          id,
          park_code,
          day_number,
          activities,
          morning_plan,
          afternoon_plan,
          evening_plan,
          driving_notes,
          highlights,
          notes,
          order_index
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Trip not found' },
          { status: 404 }
        );
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trip' },
        { status: 500 }
      );
    }

    // Fetch park details for each stop
    const parkCodes = [...new Set(trip.trip_stops.map(s => s.park_code))];
    
    let parksMap = {};
    if (parkCodes.length > 0) {
      const { data: parks } = await supabase
        .from('nps_parks')
        .select(`
          park_code,
          full_name,
          description,
          states,
          latitude,
          longitude,
          designation,
          url,
          images,
          activities
        `)
        .in('park_code', parkCodes);

      if (parks) {
        parksMap = parks.reduce((acc, park) => {
          acc[park.park_code] = park;
          return acc;
        }, {});
      }
    }

    // Sort stops by day_number and order_index
    const sortedStops = trip.trip_stops.sort((a, b) => {
      if (a.day_number !== b.day_number) {
        return a.day_number - b.day_number;
      }
      return a.order_index - b.order_index;
    });

    // Transform trip data
    const transformedTrip = {
      id: trip.id,
      title: trip.title,
      origin: trip.origin,
      originLat: trip.origin_lat,
      originLng: trip.origin_lng,
      startDate: trip.start_date,
      endDate: trip.end_date,
      interests: trip.interests,
      difficulty: trip.difficulty,
      radiusMiles: trip.radius_miles,
      summary: trip.ai_summary?.overall_summary || null,
      packingList: trip.ai_summary?.packing_list || null,
      safetyNotes: trip.ai_summary?.safety_notes || [],
      bestPhotoSpots: trip.ai_summary?.best_photo_spots || [],
      estimatedBudget: trip.ai_summary?.estimated_budget || null,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
      stops: sortedStops.map(stop => ({
        id: stop.id,
        dayNumber: stop.day_number,
        parkCode: stop.park_code,
        park: parksMap[stop.park_code] ? {
          name: parksMap[stop.park_code].full_name,
          description: parksMap[stop.park_code].description,
          states: parksMap[stop.park_code].states,
          latitude: parksMap[stop.park_code].latitude,
          longitude: parksMap[stop.park_code].longitude,
          designation: parksMap[stop.park_code].designation,
          url: parksMap[stop.park_code].url,
          images: parksMap[stop.park_code].images,
          activities: parksMap[stop.park_code].activities,
        } : null,
        activities: stop.activities,
        morningPlan: stop.morning_plan,
        afternoonPlan: stop.afternoon_plan,
        eveningPlan: stop.evening_plan,
        drivingNotes: stop.driving_notes,
        highlights: stop.highlights,
        notes: stop.notes,
      })),
    };

    return NextResponse.json({ trip: transformedTrip });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for deleting a trip
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Validate trip ID
    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid trip ID' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient({ useServiceRole: true });

    // First verify the trip belongs to the user
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this trip' },
        { status: 403 }
      );
    }

    // Delete trip (cascade will delete trip_stops)
    const { error: deleteError } = await supabase
      .from('trips')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete trip' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Trip deleted successfully',
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}