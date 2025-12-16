import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/blm
 *
 * List BLM lands with optional filtering and pagination
 *
 * Query parameters:
 * - state: Filter by state abbreviation (e.g., CA, NV, UT)
 * - near: Coordinates for nearby search (lat,lng)
 * - radius: Search radius in meters (default: 50000)
 * - minArea: Minimum area in acres
 * - maxArea: Maximum area in acres
 * - limit: Maximum results (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 * - search: Full-text search query on unit name
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const state = searchParams.get('state')?.toUpperCase();
    const near = searchParams.get('near');
    const radius = parseInt(searchParams.get('radius') || '50000', 10);
    const minArea = searchParams.get('minArea');
    const maxArea = searchParams.get('maxArea');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search');

    const supabase = createServiceClient();

    // If searching near a point, use the RPC function
    if (near) {
      const [lat, lng] = near.split(',').map(parseFloat);

      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
          { error: 'Invalid coordinates format. Use: near=lat,lng' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc('find_nearby_blm', {
        lat,
        lng,
        radius_meters: radius,
        limit_count: limit,
      });

      if (error) {
        console.error('Error fetching nearby BLM lands:', error);
        return NextResponse.json({ error: 'Failed to fetch BLM lands' }, { status: 500 });
      }

      // Apply additional filters to RPC results
      let filteredData = data || [];

      if (state) {
        filteredData = filteredData.filter((b) => b.state === state);
      }
      if (minArea) {
        filteredData = filteredData.filter((b) => b.area_acres >= parseFloat(minArea));
      }
      if (maxArea) {
        filteredData = filteredData.filter((b) => b.area_acres <= parseFloat(maxArea));
      }

      // Parse geometry_geojson for each result
      const blmLands = filteredData.map((b) => ({
        ...b,
        geojson: b.geometry_geojson ? JSON.parse(b.geometry_geojson) : null,
      }));

      return NextResponse.json({
        blmLands,
        total: blmLands.length,
        limit,
        offset: 0,
      });
    }

    // Standard query from blm_lands table
    let query = supabase
      .from('blm_lands')
      .select(
        `
        id,
        source,
        source_id,
        unit_name,
        managing_agency,
        state,
        area_acres,
        centroid_lat,
        centroid_lng,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (state) {
      query = query.eq('state', state);
    }
    if (minArea) {
      query = query.gte('area_acres', parseFloat(minArea));
    }
    if (maxArea) {
      query = query.lte('area_acres', parseFloat(maxArea));
    }
    if (search) {
      query = query.textSearch('unit_name', search, { type: 'websearch' });
    }

    // Apply pagination and ordering
    query = query
      .range(offset, offset + limit - 1)
      .order('area_acres', { ascending: false, nullsFirst: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching BLM lands:', error);
      return NextResponse.json({ error: 'Failed to fetch BLM lands' }, { status: 500 });
    }

    return NextResponse.json({
      blmLands: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('BLM API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}