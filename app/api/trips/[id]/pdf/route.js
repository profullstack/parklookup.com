/**
 * Trip PDF Export API Route
 * GET /api/trips/[id]/pdf - Generate and download PDF for a trip (Pro feature)
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { generateTripPdf } from '@/lib/pdf/trip-pdf-generator.js';
import { isUserProFromDb } from '@/lib/subscription/pro-status';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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
  const supabase = createServerClient({ useServiceRole: true });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('Auth error:', error?.message);
    return null;
  }

  return user;
};


/**
 * Transform database trip to API format
 * @param {Object} trip - Database trip object
 * @returns {Object} Transformed trip
 */
const transformTrip = (trip) => {
  return {
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
    stops: (trip.trip_stops || [])
      .sort((a, b) => {
        if (a.day_number !== b.day_number) {
          return a.day_number - b.day_number;
        }
        return (a.order_index || 0) - (b.order_index || 0);
      })
      .map((stop) => ({
        id: stop.id,
        dayNumber: stop.day_number,
        parkCode: stop.park_code,
        park: stop.park || null,
        activities: stop.activities,
        morningPlan: stop.morning_plan,
        afternoonPlan: stop.afternoon_plan,
        eveningPlan: stop.evening_plan,
        drivingNotes: stop.driving_notes,
        highlights: stop.highlights,
        notes: stop.notes,
      })),
  };
};

/**
 * GET handler for generating trip PDF
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Validate trip ID
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Check if user is pro
    const isPro = await isUserProFromDb(supabase, user.id);
    if (!isPro) {
      return NextResponse.json(
        { error: 'PDF export is a Pro feature' },
        { status: 403 }
      );
    }

    // Fetch trip with all details
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select(
        `
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
      `
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (tripError) {
      if (tripError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
      }
      console.error('Database error:', tripError);
      return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 });
    }

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Fetch park details for each stop
    const parkCodes = [...new Set(trip.trip_stops.map((s) => s.park_code))];
    let parksMap = {};

    if (parkCodes.length > 0) {
      // First try NPS parks
      const { data: npsParks } = await supabase
        .from('nps_parks')
        .select(
          `
          park_code,
          full_name,
          description,
          states,
          latitude,
          longitude,
          designation
        `
        )
        .in('park_code', parkCodes);

      if (npsParks) {
        parksMap = npsParks.reduce((acc, park) => {
          acc[park.park_code] = {
            name: park.full_name,
            description: park.description,
            states: park.states,
            latitude: park.latitude,
            longitude: park.longitude,
            designation: park.designation,
          };
          return acc;
        }, {});
      }

      // Find any park codes not found in NPS (likely Wikidata parks)
      const foundCodes = new Set(Object.keys(parksMap));
      const missingCodes = parkCodes.filter((code) => !foundCodes.has(code));

      if (missingCodes.length > 0) {
        const { data: allParks } = await supabase
          .from('all_parks')
          .select(
            `
            park_code,
            full_name,
            description,
            states,
            latitude,
            longitude,
            designation
          `
          )
          .in('park_code', missingCodes);

        if (allParks) {
          allParks.forEach((park) => {
            parksMap[park.park_code] = {
              name: park.full_name,
              description: park.description,
              states: park.states,
              latitude: park.latitude,
              longitude: park.longitude,
              designation: park.designation,
            };
          });
        }
      }
    }

    // Add park data to stops
    trip.trip_stops = trip.trip_stops.map((stop) => ({
      ...stop,
      park: parksMap[stop.park_code] || null,
    }));

    // Transform trip data
    const transformedTrip = transformTrip(trip);

    // Generate PDF
    const { buffer, filename } = await generateTripPdf(transformedTrip);

    // Return PDF as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}