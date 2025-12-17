import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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

    const supabase = createServiceClient();

    // First, find the park by park_code or ID
    const { data: parkResults, error: parkError } = await supabase
      .from('all_parks')
      .select('id, source, latitude, longitude, park_code')
      .or(`park_code.eq.${parkCode},id.eq.${parkCode}`)
      .limit(1);

    if (parkError) {
      console.error('Error fetching park:', parkError);
      return NextResponse.json({ error: 'Failed to fetch park' }, { status: 500 });
    }

    if (!parkResults || parkResults.length === 0) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
    }

    const parkData = parkResults[0];

    const { id: parkId, source: parkSource, latitude, longitude } = parkData;

    // Use the trails_with_park view which includes geometry_geojson
    // First get trail IDs from the RPC function, then fetch full data with GeoJSON
    const { data: trailsData, error: trailsError } = await supabase.rpc('find_trails_for_park', {
      p_park_id: parkId,
      p_park_source: parkSource,
      p_radius_meters: 10000, // 10km radius for point-based parks
    });

    if (trailsError) {
      console.error('Error fetching trails for park:', trailsError);
      return NextResponse.json({ error: 'Failed to fetch trails' }, { status: 500 });
    }

    // Get trail IDs to fetch with GeoJSON
    const trailIds = (trailsData || []).map((t) => t.id);

    // Fetch trails with GeoJSON geometry from the view
    let trailsWithGeojson = [];
    if (trailIds.length > 0 && includeGeometry) {
      const { data: viewData, error: viewError } = await supabase
        .from('trails_with_park')
        .select('*')
        .in('id', trailIds);

      if (!viewError && viewData) {
        trailsWithGeojson = viewData;
      }
    }

    // Create a map for quick lookup
    const geojsonMap = new Map(trailsWithGeojson.map((t) => [t.id, t.geometry_geojson]));

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
      if (includeGeometry) {
        const geojsonStr = geojsonMap.get(trail.id);
        if (geojsonStr) {
          try {
            result.geojson = JSON.parse(geojsonStr);
          } catch {
            result.geojson = null;
          }
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