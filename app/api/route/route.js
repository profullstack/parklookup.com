/**
 * Route API
 * GET /api/route - Get driving route between waypoints using OSRM
 */

import { NextResponse } from 'next/server';

// OSRM public demo server (for production, consider self-hosting or using a paid service)
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * GET /api/route
 * Get driving route between waypoints
 * 
 * Query params:
 * - waypoints: Comma-separated list of coordinates in format "lng,lat;lng,lat;..."
 * 
 * Example: /api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const waypoints = searchParams.get('waypoints');

    if (!waypoints) {
      return NextResponse.json(
        { error: 'Missing waypoints parameter' },
        { status: 400 }
      );
    }

    // Validate waypoints format
    const waypointPairs = waypoints.split(';');
    if (waypointPairs.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 waypoints are required' },
        { status: 400 }
      );
    }

    // Validate each coordinate pair
    for (const pair of waypointPairs) {
      const [lng, lat] = pair.split(',').map(Number);
      if (isNaN(lng) || isNaN(lat)) {
        return NextResponse.json(
          { error: `Invalid coordinate pair: ${pair}` },
          { status: 400 }
        );
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
          { error: `Coordinates out of range: ${pair}` },
          { status: 400 }
        );
      }
    }

    // Call OSRM API
    const osrmUrl = `${OSRM_BASE_URL}/${waypoints}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(osrmUrl, {
      headers: {
        'User-Agent': 'ParkLookup/1.0',
      },
    });

    if (!response.ok) {
      console.error('OSRM API error:', response.status, await response.text());
      return NextResponse.json(
        { error: 'Failed to fetch route from routing service' },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return NextResponse.json(
        { error: 'No route found between the specified waypoints' },
        { status: 404 }
      );
    }

    const route = data.routes[0];

    // Extract route geometry (array of [lng, lat] coordinates)
    const geometry = route.geometry?.coordinates || [];
    
    // Convert to [lat, lng] format for Leaflet
    const coordinates = geometry.map(([lng, lat]) => [lat, lng]);

    // Extract route summary
    const summary = {
      distance: route.distance, // meters
      duration: route.duration, // seconds
      distanceMiles: (route.distance / 1609.344).toFixed(1),
      durationHours: (route.duration / 3600).toFixed(1),
    };

    // Extract leg information (between each waypoint)
    const legs = route.legs?.map((leg, index) => ({
      index,
      distance: leg.distance,
      duration: leg.duration,
      distanceMiles: (leg.distance / 1609.344).toFixed(1),
      durationMinutes: Math.round(leg.duration / 60),
      summary: leg.summary,
      steps: leg.steps?.map((step) => ({
        instruction: step.maneuver?.instruction || '',
        distance: step.distance,
        duration: step.duration,
        name: step.name,
        mode: step.mode,
        maneuver: {
          type: step.maneuver?.type,
          modifier: step.maneuver?.modifier,
          location: step.maneuver?.location,
        },
      })),
    })) || [];

    return NextResponse.json({
      success: true,
      route: {
        coordinates,
        summary,
        legs,
      },
    });
  } catch (error) {
    console.error('Route API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}