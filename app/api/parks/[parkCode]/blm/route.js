import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/parks/[parkCode]/blm
 *
 * Get BLM lands near a specific park
 *
 * Query parameters:
 * - radius: Search radius in meters (default: 50000, max: 100000)
 * - limit: Maximum results (default: 20, max: 50)
 */
export async function GET(request, { params }) {
  try {
    const { parkCode } = await params;
    const { searchParams } = new URL(request.url);

    const radius = Math.min(parseInt(searchParams.get('radius') || '50000', 10), 100000);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!parkCode) {
      return NextResponse.json({ error: 'Park code is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // First, find the park by park_code or ID
    // Try all_parks view which includes NPS, Wikidata, and local parks
    let parkQuery = supabase
      .from('all_parks')
      .select('id, park_code, full_name, latitude, longitude, source')
      .or(`park_code.eq.${parkCode},id.eq.${parkCode}`)
      .limit(1);

    const { data: parkData, error: parkError } = await parkQuery;

    if (parkError) {
      console.error('Error fetching park:', parkError);
      return NextResponse.json({ error: 'Failed to fetch park' }, { status: 500 });
    }

    if (!parkData || parkData.length === 0) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
    }

    const park = parkData[0];

    // Check if park has coordinates
    if (!park.latitude || !park.longitude) {
      return NextResponse.json({
        blmLands: [],
        park: {
          id: park.id,
          parkCode: park.park_code,
          name: park.full_name,
        },
        message: 'Park does not have coordinates for BLM land search',
      });
    }

    // Use the RPC function to find BLM lands near the park
    const { data: blmData, error: blmError } = await supabase.rpc('find_blm_near_park', {
      p_park_id: park.id,
      p_park_source: park.source,
      p_radius_meters: radius,
    });

    if (blmError) {
      console.error('Error fetching BLM lands near park:', blmError);
      return NextResponse.json({ error: 'Failed to fetch BLM lands' }, { status: 500 });
    }

    // Limit results and parse geometry
    const blmLands = (blmData || []).slice(0, limit).map((b) => ({
      id: b.id,
      unitName: b.unit_name,
      state: b.state,
      areaAcres: b.area_acres,
      distanceMeters: b.distance_meters,
      distanceMiles: b.distance_meters ? (b.distance_meters / 1609.344).toFixed(1) : null,
      geojson: b.geometry_geojson ? JSON.parse(b.geometry_geojson) : null,
    }));

    return NextResponse.json({
      blmLands,
      total: blmLands.length,
      park: {
        id: park.id,
        parkCode: park.park_code,
        name: park.full_name,
        latitude: park.latitude,
        longitude: park.longitude,
      },
      searchRadius: radius,
    });
  } catch (error) {
    console.error('Park BLM API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}