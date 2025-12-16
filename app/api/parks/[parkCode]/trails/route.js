import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/parks/[parkCode]/trails
 *
 * Get all trails associated with a specific park
 *
 * Query parameters:
 * - difficulty: Filter by difficulty (easy, moderate, hard)
 * - minLength: Minimum length in meters
 * - maxLength: Maximum length in meters
 * - limit: Maximum results (default: 50)
 * - includeGeometry: Include GeoJSON geometry (default: false)
 */
export async function GET(request, { params }) {
  try {
    const { parkCode } = await params;

    if (!parkCode) {
      return NextResponse.json({ error: 'Park code is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get('difficulty');
    const minLength = searchParams.get('minLength');
    const maxLength = searchParams.get('maxLength');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const includeGeometry = searchParams.get('includeGeometry') === 'true';

    const supabase = await createServerClient();

    // First, find the park by park_code
    const { data: parkData, error: parkError } = await supabase
      .from('all_parks')
      .select('id, source, latitude, longitude')
      .eq('park_code', parkCode)
      .single();

    if (parkError || !parkData) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
    }

    const { id: parkId, source: parkSource, latitude, longitude } = parkData;

    // Use the RPC function to find trails for this park
    const { data: trailsData, error: trailsError } = await supabase.rpc('find_trails_for_park', {
      p_park_id: parkId,
      p_park_source: parkSource,
      p_radius_meters: 10000, // 10km radius for point-based parks
    });

    if (trailsError) {
      console.error('Error fetching trails for park:', trailsError);
      return NextResponse.json({ error: 'Failed to fetch trails' }, { status: 500 });
    }

    // Apply filters
    let filteredTrails = trailsData || [];

    if (difficulty) {
      filteredTrails = filteredTrails.filter((t) => t.difficulty === difficulty);
    }
    if (minLength) {
      filteredTrails = filteredTrails.filter((t) => t.length_meters >= parseFloat(minLength));
    }
    if (maxLength) {
      filteredTrails = filteredTrails.filter((t) => t.length_meters <= parseFloat(maxLength));
    }

    // Apply limit
    filteredTrails = filteredTrails.slice(0, limit);

    // Transform trails for response
    const trails = filteredTrails.map((trail) => {
      const result = {
        id: trail.id,
        name: trail.name,
        slug: trail.slug,
        difficulty: trail.difficulty,
        length_meters: trail.length_meters,
        elevation_gain_m: trail.elevation_gain_m,
        surface: trail.surface,
        trail_type: trail.trail_type,
        sac_scale: trail.sac_scale,
      };

      // Include geometry if requested
      if (includeGeometry && trail.geometry) {
        try {
          // Convert WKT to GeoJSON if needed
          result.geometry = trail.geometry;
        } catch {
          result.geometry = null;
        }
      }

      return result;
    });

    // Calculate summary stats
    const summary = {
      total: trails.length,
      byDifficulty: {
        easy: trails.filter((t) => t.difficulty === 'easy').length,
        moderate: trails.filter((t) => t.difficulty === 'moderate').length,
        hard: trails.filter((t) => t.difficulty === 'hard').length,
      },
      totalLengthMeters: trails.reduce((sum, t) => sum + (t.length_meters || 0), 0),
    };

    return NextResponse.json({
      parkCode,
      parkId,
      parkSource,
      trails,
      summary,
    });
  } catch (error) {
    console.error('Park trails API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}