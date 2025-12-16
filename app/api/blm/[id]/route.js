import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/blm/[id]
 *
 * Get details for a specific BLM land by ID
 *
 * Returns full BLM land details including geometry as GeoJSON
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'BLM land ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Use the RPC function to get BLM land with GeoJSON geometry
    const { data, error } = await supabase.rpc('get_blm_with_geojson', {
      blm_id: id,
    });

    if (error) {
      console.error('Error fetching BLM land:', error);
      return NextResponse.json({ error: 'Failed to fetch BLM land' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'BLM land not found' }, { status: 404 });
    }

    const blmLand = data[0];

    // Parse geometry GeoJSON
    const result = {
      ...blmLand,
      geojson: blmLand.geometry_geojson ? JSON.parse(blmLand.geometry_geojson) : null,
    };

    // Remove the raw geometry_geojson string
    delete result.geometry_geojson;

    return NextResponse.json({ blmLand: result });
  } catch (error) {
    console.error('BLM detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}