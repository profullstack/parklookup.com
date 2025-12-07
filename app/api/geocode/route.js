/**
 * Geocode API Route
 * GET /api/geocode - Reverse geocode coordinates to address
 */

import { NextResponse } from 'next/server';
import { reverseGeocode, isValidLatitude, isValidLongitude } from '@/lib/api/here';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET handler for reverse geocoding
 * Query params:
 *   - lat: Latitude (required)
 *   - lng: Longitude (required)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Validate required parameters
    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude (lat) and longitude (lng) are required' },
        { status: 400 }
      );
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    // Validate coordinate values
    if (!isValidLatitude(latNum)) {
      return NextResponse.json(
        { error: 'Invalid latitude. Must be between -90 and 90.' },
        { status: 400 }
      );
    }

    if (!isValidLongitude(lngNum)) {
      return NextResponse.json(
        { error: 'Invalid longitude. Must be between -180 and 180.' },
        { status: 400 }
      );
    }

    // Check if HERE API key is configured
    if (!process.env.HERE_API_KEY) {
      return NextResponse.json(
        { error: 'Geocoding service is not configured' },
        { status: 503 }
      );
    }

    // Perform reverse geocoding
    const result = await reverseGeocode(latNum, lngNum);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Geocode API error:', error);

    // Handle specific error types
    if (error.message.includes('HERE API error')) {
      return NextResponse.json(
        { error: 'Geocoding service error', details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}