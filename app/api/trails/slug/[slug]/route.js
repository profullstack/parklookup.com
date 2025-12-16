import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/trails/slug/[slug]
 * Fetch a single trail by its slug
 */
export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const supabase = createServiceClient();

    if (!slug) {
      return NextResponse.json(
        { error: 'Trail slug is required' },
        { status: 400 }
      );
    }

    // Fetch trail with GeoJSON geometry
    const { data: trail, error } = await supabase
      .from('trails')
      .select(`
        id,
        source,
        source_id,
        park_id,
        park_source,
        name,
        slug,
        difficulty,
        length_meters,
        elevation_gain_m,
        surface,
        description,
        is_user_submitted,
        created_at,
        updated_at
      `)
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Trail not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Get GeoJSON geometry using the database function
    const { data: geoData, error: geoError } = await supabase
      .rpc('get_trail_with_geojson', { trail_id: trail.id });

    if (!geoError && geoData && geoData.length > 0) {
      trail.geojson = geoData[0].geojson;
    }

    // Fetch associated park info
    if (trail.park_id) {
      const { data: park } = await supabase
        .from('all_parks')
        .select('id, name, full_name, park_code, source, latitude, longitude, states')
        .eq('id', trail.park_id)
        .single();

      if (park) {
        trail.park = park;
      }
    }

    return NextResponse.json({ trail });
  } catch (error) {
    console.error('Error fetching trail by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trail' },
      { status: 500 }
    );
  }
}