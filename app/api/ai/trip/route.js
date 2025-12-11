/**
 * AI Trip Generation API Route
 * POST /api/ai/trip - Generate a trip itinerary with SSE streaming
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { geocodeOrigin, milesToMeters } from '@/lib/api/geocode-origin';
import { generateTripStream, prepareParksForPrompt, TRIP_INTERESTS, DIFFICULTY_LEVELS } from '@/lib/ai/trip-generator';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Validate trip request body
 * @param {Object} body - Request body
 * @returns {Object} Validation result with isValid and errors
 */
const validateRequest = (body) => {
  const errors = [];

  if (!body.origin || typeof body.origin !== 'string') {
    errors.push('origin is required and must be a string');
  }

  if (!body.startDate) {
    errors.push('startDate is required');
  } else {
    const start = new Date(body.startDate);
    if (isNaN(start.getTime())) {
      errors.push('startDate must be a valid date');
    }
  }

  if (!body.endDate) {
    errors.push('endDate is required');
  } else {
    const end = new Date(body.endDate);
    if (isNaN(end.getTime())) {
      errors.push('endDate must be a valid date');
    }
  }

  if (body.startDate && body.endDate) {
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) {
      errors.push('endDate must be after startDate');
    }
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 14) {
      errors.push('Trip cannot exceed 14 days');
    }
  }

  if (!body.interests || !Array.isArray(body.interests) || body.interests.length === 0) {
    errors.push('interests is required and must be a non-empty array');
  } else {
    const invalidInterests = body.interests.filter(i => !TRIP_INTERESTS.includes(i));
    if (invalidInterests.length > 0) {
      errors.push(`Invalid interests: ${invalidInterests.join(', ')}`);
    }
  }

  if (!body.difficulty || !DIFFICULTY_LEVELS.includes(body.difficulty)) {
    errors.push(`difficulty must be one of: ${DIFFICULTY_LEVELS.join(', ')}`);
  }

  if (body.radiusMiles !== undefined) {
    const radius = parseInt(body.radiusMiles, 10);
    if (isNaN(radius) || radius < 50 || radius > 500) {
      errors.push('radiusMiles must be between 50 and 500');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
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
  const supabase = createServerClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user;
};

/**
 * Check if user can create a trip (free tier enforcement)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with canCreate and reason
 */
const checkTripLimit = async (userId) => {
  const supabase = createServerClient({ useServiceRole: true });

  // Check if user is pro
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .single();

  if (profile?.is_pro) {
    return { canCreate: true, isPro: true };
  }

  // Count existing trips for free users
  const { count } = await supabase
    .from('trips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count >= 1) {
    return {
      canCreate: false,
      isPro: false,
      reason: 'Free tier allows only 1 trip. Please upgrade to create more trips.',
    };
  }

  return { canCreate: true, isPro: false };
};

/**
 * Find nearby parks using the database
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radiusMiles - Search radius in miles
 * @returns {Promise<Object[]>} Array of parks
 */
const findNearbyParks = async (lat, lng, radiusMiles) => {
  const supabase = createServerClient();
  const radiusMeters = milesToMeters(radiusMiles);

  // Try RPC first
  const { data: parks, error } = await supabase.rpc('find_nearby_parks', {
    user_lat: lat,
    user_lng: lng,
    radius_meters: radiusMeters,
    max_results: 30,
  });

  if (error) {
    console.warn('RPC not available, using fallback:', error.message);

    // Fallback to all_parks view with manual filtering
    const { data: allParks, error: fallbackError } = await supabase
      .from('all_parks')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (fallbackError) {
      throw new Error('Failed to fetch parks');
    }

    // Calculate distances and filter
    const R = 6371; // Earth's radius in km
    const parksWithDistance = allParks
      .map(park => {
        const lat1 = (lat * Math.PI) / 180;
        const lat2 = (park.latitude * Math.PI) / 180;
        const deltaLat = ((park.latitude - lat) * Math.PI) / 180;
        const deltaLon = ((park.longitude - lng) * Math.PI) / 180;

        const a =
          Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance_km = R * c;

        return { ...park, distance_km };
      })
      .filter(park => park.distance_km <= radiusMiles * 1.60934)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 30);

    return parksWithDistance;
  }

  return parks;
};

/**
 * Save trip to database
 * @param {Object} tripData - Generated trip data
 * @param {Object} options - Trip options
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Saved trip
 */
const saveTrip = async (tripData, options, userId) => {
  const supabase = createServerClient({ useServiceRole: true });

  // Check if user already has a trip (for overwrite)
  const { data: existingTrips } = await supabase
    .from('trips')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  let tripId;

  if (existingTrips && existingTrips.length > 0) {
    // Update existing trip (overwrite)
    tripId = existingTrips[0].id;

    // Delete existing stops
    await supabase
      .from('trip_stops')
      .delete()
      .eq('trip_id', tripId);

    // Update trip
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        title: tripData.title,
        origin: options.origin,
        origin_lat: options.originLat,
        origin_lng: options.originLng,
        start_date: options.startDate,
        end_date: options.endDate,
        interests: options.interests,
        difficulty: options.difficulty,
        radius_miles: options.radiusMiles,
        ai_summary: {
          overall_summary: tripData.overall_summary,
          packing_list: tripData.packing_list,
          safety_notes: tripData.safety_notes,
          best_photo_spots: tripData.best_photo_spots,
          estimated_budget: tripData.estimated_budget,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (updateError) {
      throw new Error(`Failed to update trip: ${updateError.message}`);
    }
  } else {
    // Insert new trip
    const { data: newTrip, error: insertError } = await supabase
      .from('trips')
      .insert({
        user_id: userId,
        title: tripData.title,
        origin: options.origin,
        origin_lat: options.originLat,
        origin_lng: options.originLng,
        start_date: options.startDate,
        end_date: options.endDate,
        interests: options.interests,
        difficulty: options.difficulty,
        radius_miles: options.radiusMiles,
        ai_summary: {
          overall_summary: tripData.overall_summary,
          packing_list: tripData.packing_list,
          safety_notes: tripData.safety_notes,
          best_photo_spots: tripData.best_photo_spots,
          estimated_budget: tripData.estimated_budget,
        },
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save trip: ${insertError.message}`);
    }

    tripId = newTrip.id;
  }

  // Insert trip stops
  if (tripData.daily_schedule && tripData.daily_schedule.length > 0) {
    const stops = tripData.daily_schedule.map((day, index) => ({
      trip_id: tripId,
      park_code: day.park_code,
      day_number: day.day,
      activities: day.activities || [],
      morning_plan: day.morning,
      afternoon_plan: day.afternoon,
      evening_plan: day.evening,
      driving_notes: day.driving_notes,
      highlights: day.highlights,
      order_index: index,
    }));

    const { error: stopsError } = await supabase
      .from('trip_stops')
      .insert(stops);

    if (stopsError) {
      console.error('Failed to save trip stops:', stopsError);
    }
  }

  return { id: tripId };
};

/**
 * POST handler for trip generation with SSE streaming
 */
export async function POST(request) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateRequest(body);

    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Check free tier limit
    const limitCheck = await checkTripLimit(user.id);
    if (!limitCheck.canCreate) {
      return NextResponse.json(
        { error: limitCheck.reason, code: 'FREE_TIER_LIMIT' },
        { status: 402 }
      );
    }

    // Create SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event, data) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Step 1: Geocode origin
          send('progress', { stage: 'geocoding', message: `Finding location for "${body.origin}"...` });
          
          let originCoords;
          try {
            originCoords = await geocodeOrigin(body.origin);
          } catch (geoError) {
            send('error', { message: `Could not find location: ${geoError.message}` });
            controller.close();
            return;
          }

          send('progress', { 
            stage: 'geocoded', 
            message: `Found: ${originCoords.formattedAddress}`,
            location: originCoords,
          });

          // Step 2: Find nearby parks
          send('progress', { stage: 'finding_parks', message: 'Finding parks within your radius...' });
          
          const radiusMiles = body.radiusMiles || 200;
          const parks = await findNearbyParks(originCoords.lat, originCoords.lng, radiusMiles);

          if (parks.length === 0) {
            send('error', { message: 'No parks found within the specified radius. Try increasing the radius.' });
            controller.close();
            return;
          }

          send('progress', { 
            stage: 'parks_found', 
            message: `Found ${parks.length} parks within ${radiusMiles} miles`,
            parkCount: parks.length,
          });

          // Step 3: Generate trip with streaming
          send('progress', { stage: 'generating', message: 'Creating your personalized itinerary...' });

          const tripOptions = {
            origin: originCoords.formattedAddress,
            startDate: body.startDate,
            endDate: body.endDate,
            interests: body.interests,
            difficulty: body.difficulty,
            radiusMiles,
            parks: prepareParksForPrompt(parks),
          };

          let tripData;
          try {
            tripData = await generateTripStream(
              tripOptions,
              // onChunk callback
              (chunk) => {
                send('chunk', { partial: chunk });
              },
              // onDayComplete callback
              (dayInfo) => {
                send('day_complete', dayInfo);
              }
            );
          } catch (aiError) {
            send('error', { message: `AI generation failed: ${aiError.message}` });
            controller.close();
            return;
          }

          // Step 4: Save trip to database
          send('progress', { stage: 'saving', message: 'Saving your trip...' });

          const savedTrip = await saveTrip(tripData, {
            ...tripOptions,
            originLat: originCoords.lat,
            originLng: originCoords.lng,
          }, user.id);

          // Step 5: Send completion
          send('complete', {
            trip_id: savedTrip.id,
            redirect: `/trip/${savedTrip.id}`,
            title: tripData.title,
            days: tripData.daily_schedule?.length || 0,
          });

        } catch (error) {
          console.error('Trip generation error:', error);
          send('error', { message: error.message || 'An unexpected error occurred' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}