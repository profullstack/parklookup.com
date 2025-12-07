/**
 * Parks Nearby API Route
 * GET /api/parks/nearby - Find parks near a location
 */

import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for finding nearby parks
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseFloat(searchParams.get('radius') || '100'); // Default 100km
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Latitude (lat) and longitude (lng) are required' },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90) {
      return NextResponse.json({ error: 'Latitude must be between -90 and 90' }, { status: 400 });
    }

    if (lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Use PostGIS to find nearby parks
    // ST_DWithin uses meters, so convert km to meters
    const radiusMeters = radius * 1000;

    const { data: parks, error } = await supabase.rpc('find_nearby_parks', {
      user_lat: lat,
      user_lng: lng,
      radius_meters: radiusMeters,
      max_results: limit,
    });

    if (error) {
      // Fallback to simple distance calculation if RPC not available
      console.warn('RPC not available, using fallback:', error.message);

      // Fallback: query all_parks view to include both NPS and state parks
      const { data: allParks, error: fallbackError } = await supabase
        .from('all_parks')
        .select(
          `
          id,
          park_code,
          full_name,
          description,
          states,
          latitude,
          longitude,
          designation,
          url,
          images,
          source
        `
        )
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (fallbackError) {
        console.error('Database error:', fallbackError);
        return NextResponse.json({ error: 'Failed to find nearby parks' }, { status: 500 });
      }

      // Calculate distances and filter
      const parksWithDistance = allParks
        .map((park) => {
          const distance = haversineDistance(
            { latitude: lat, longitude: lng },
            { latitude: park.latitude, longitude: park.longitude }
          );
          return { ...park, distance };
        })
        .filter((park) => park.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      return NextResponse.json({
        parks: parksWithDistance,
        location: { lat, lng },
        radius,
      });
    }

    return NextResponse.json({
      parks,
      location: { lat, lng },
      radius,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Calculate Haversine distance between two coordinates in kilometers
 */
function haversineDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in km

  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}