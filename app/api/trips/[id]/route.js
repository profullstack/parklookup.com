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

    // Fetch park details for each stop from all_parks view (includes NPS and Wikidata parks)
    const parkCodes = [...new Set(trip.trip_stops.map(s => s.park_code))];
    
    let parksMap = {};
    if (parkCodes.length > 0) {
      // First try NPS parks
      const { data: npsParks } = await supabase
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

      if (npsParks) {
        parksMap = npsParks.reduce((acc, park) => {
          acc[park.park_code] = park;
          return acc;
        }, {});
      }

      // Find any park codes not found in NPS (likely Wikidata parks)
      const foundCodes = new Set(Object.keys(parksMap));
      const missingCodes = parkCodes.filter(code => !foundCodes.has(code));

      // Fetch missing parks from all_parks view (includes Wikidata parks)
      if (missingCodes.length > 0) {
        const { data: allParks } = await supabase
          .from('all_parks')
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
            activities,
            source
          `)
          .in('park_code', missingCodes);

        if (allParks) {
          allParks.forEach(park => {
            parksMap[park.park_code] = park;
          });
        }
      }
    }

    // Sort stops by day_number and order_index
    const sortedStops = trip.trip_stops.sort((a, b) => {
      if (a.day_number !== b.day_number) {
        return a.day_number - b.day_number;
      }
      return a.order_index - b.order_index;
    });

    // Fetch products based on trip interests/activities
    let recommendedProducts = [];
    const allActivities = [...new Set([
      ...(trip.interests || []),
      ...trip.trip_stops.flatMap(s => s.activities || [])
    ])];

    if (allActivities.length > 0) {
      // Try to get products for each activity
      const { data: activityProducts } = await supabase
        .from('activity_products')
        .select('product_id, activity_name')
        .in('activity_name', allActivities);

      if (activityProducts && activityProducts.length > 0) {
        const productIds = [...new Set(activityProducts.map(ap => ap.product_id))];
        const { data: products } = await supabase
          .from('products')
          .select(`
            id,
            asin,
            title,
            brand,
            price,
            currency,
            original_price,
            rating,
            ratings_total,
            main_image_url,
            is_prime,
            affiliate_url,
            product_categories (
              name,
              slug
            )
          `)
          .in('id', productIds)
          .eq('is_active', true)
          .order('rating', { ascending: false })
          .limit(10);

        if (products) {
          recommendedProducts = products;
        }
      }
    }

    // If no activity-specific products, get general outdoor products
    if (recommendedProducts.length === 0) {
      const { data: generalProducts } = await supabase
        .from('products')
        .select(`
          id,
          asin,
          title,
          brand,
          price,
          currency,
          original_price,
          rating,
          ratings_total,
          main_image_url,
          is_prime,
          affiliate_url,
          product_categories (
            name,
            slug
          )
        `)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(10);

      if (generalProducts) {
        recommendedProducts = generalProducts;
      }
    }

    // Fetch nearby places for each park (dining, bars, etc.)
    const nearbyPlacesMap = {};
    if (parkCodes.length > 0) {
      // Get park IDs from all_parks view
      const { data: parkIds } = await supabase
        .from('all_parks')
        .select('id, park_code')
        .in('park_code', parkCodes);

      if (parkIds && parkIds.length > 0) {
        const parkIdMap = parkIds.reduce((acc, p) => {
          acc[p.id] = p.park_code;
          return acc;
        }, {});

        // Fetch nearby places for all parks at once
        const { data: nearbyPlacesData } = await supabase
          .from('park_nearby_places')
          .select(`
            park_id,
            distance_miles,
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
              thumbnail
            )
          `)
          .in('park_id', Object.keys(parkIdMap))
          .limit(100);

        if (nearbyPlacesData) {
          // Group by park_code and category
          nearbyPlacesData.forEach(item => {
            if (!item.nearby_places) {
              return;
            }
            
            const parkCode = parkIdMap[item.park_id];
            if (!parkCode) {
              return;
            }

            if (!nearbyPlacesMap[parkCode]) {
              nearbyPlacesMap[parkCode] = {
                dining: [],
                bars: [],
                lodging: [],
                entertainment: [],
                shopping: [],
                attractions: []
              };
            }

            const place = {
              ...item.nearby_places,
              distanceMiles: item.distance_miles
            };

            const category = item.nearby_places.category?.toLowerCase() || 'attractions';
            if (nearbyPlacesMap[parkCode][category]) {
              nearbyPlacesMap[parkCode][category].push(place);
            }
          });

          // Limit each category to 5 places per park
          Object.keys(nearbyPlacesMap).forEach(parkCode => {
            Object.keys(nearbyPlacesMap[parkCode]).forEach(category => {
              nearbyPlacesMap[parkCode][category] = nearbyPlacesMap[parkCode][category]
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 5);
            });
          });
        }
      }
    }

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
      stops: sortedStops.map(stop => {
        const parkData = parksMap[stop.park_code];
        // Determine source: NPS parks don't have source field, Wikidata parks have source='wikidata'
        const source = parkData?.source || 'nps';
        return {
          id: stop.id,
          dayNumber: stop.day_number,
          parkCode: stop.park_code,
          park: parkData ? {
            name: parkData.full_name,
            description: parkData.description,
            states: parkData.states,
            latitude: parkData.latitude,
            longitude: parkData.longitude,
            designation: parkData.designation,
            url: parkData.url,
            images: parkData.images,
            activities: parkData.activities,
            source,
          } : null,
          activities: stop.activities,
          morningPlan: stop.morning_plan,
          afternoonPlan: stop.afternoon_plan,
          eveningPlan: stop.evening_plan,
          drivingNotes: stop.driving_notes,
          highlights: stop.highlights,
          notes: stop.notes,
          nearbyPlaces: nearbyPlacesMap[stop.park_code] || null,
        };
      }),
      recommendedProducts: recommendedProducts.map(p => ({
        id: p.id,
        asin: p.asin,
        title: p.title,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        originalPrice: p.original_price,
        rating: p.rating,
        ratingsTotal: p.ratings_total,
        imageUrl: p.main_image_url,
        isPrime: p.is_prime,
        affiliateUrl: p.affiliate_url,
        category: p.product_categories?.name || null,
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