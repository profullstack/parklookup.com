import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/trails/[id]
 *
 * Get a single trail by ID with full details including GeoJSON geometry
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Trail ID is required' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Use the RPC function to get trail with GeoJSON geometry
    const { data, error } = await supabase.rpc('get_trail_with_geojson', {
      trail_id: id,
    });

    if (error) {
      console.error('Error fetching trail:', error);
      return NextResponse.json({ error: 'Failed to fetch trail' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Trail not found' }, { status: 404 });
    }

    const trail = data[0];

    // Parse the GeoJSON geometry string
    if (trail.geometry_geojson) {
      try {
        trail.geometry = JSON.parse(trail.geometry_geojson);
        delete trail.geometry_geojson;
      } catch {
        // Keep as string if parsing fails
        trail.geometry = null;
      }
    }

    // Fetch associated park info if park_id exists
    if (trail.park_id && trail.park_source) {
      const { data: parkData } = await supabase
        .from('all_parks')
        .select('id, park_code, full_name, states, designation, latitude, longitude')
        .eq('id', trail.park_id)
        .eq('source', trail.park_source)
        .single();

      if (parkData) {
        trail.park = parkData;
      }
    }

    return NextResponse.json(trail);
  } catch (error) {
    console.error('Trail detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}