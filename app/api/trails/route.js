import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/trails
 *
 * List trails with optional filtering and pagination
 *
 * Query parameters:
 * - difficulty: Filter by difficulty (easy, moderate, hard)
 * - minLength: Minimum length in meters
 * - maxLength: Maximum length in meters
 * - surface: Filter by surface type
 * - near: Coordinates for nearby search (lat,lng)
 * - radius: Search radius in meters (default: 50000)
 * - parkId: Filter by park ID
 * - parkSource: Filter by park source (nps, wikidata, local)
 * - limit: Maximum results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - search: Full-text search query
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const difficulty = searchParams.get('difficulty');
    const minLength = searchParams.get('minLength');
    const maxLength = searchParams.get('maxLength');
    const surface = searchParams.get('surface');
    const near = searchParams.get('near');
    const radius = parseInt(searchParams.get('radius') || '50000', 10);
    const parkId = searchParams.get('parkId');
    const parkSource = searchParams.get('parkSource');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search');

    const supabase = createServiceClient();

    // If searching near a point, use the RPC function
    if (near) {
      const [lat, lng] = near.split(',').map(parseFloat);

      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json({ error: 'Invalid coordinates format. Use: near=lat,lng' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('find_nearby_trails', {
        lat,
        lng,
        radius_meters: radius,
        limit_count: limit,
      });

      if (error) {
        console.error('Error fetching nearby trails:', error);
        return NextResponse.json({ error: 'Failed to fetch trails' }, { status: 500 });
      }

      // Apply additional filters to RPC results
      let filteredData = data;

      if (difficulty) {
        filteredData = filteredData.filter((t) => t.difficulty === difficulty);
      }
      if (minLength) {
        filteredData = filteredData.filter((t) => t.length_meters >= parseFloat(minLength));
      }
      if (maxLength) {
        filteredData = filteredData.filter((t) => t.length_meters <= parseFloat(maxLength));
      }
      if (surface) {
        filteredData = filteredData.filter((t) => t.surface === surface);
      }

      return NextResponse.json({
        trails: filteredData,
        total: filteredData.length,
        limit,
        offset: 0,
      });
    }

    // Standard query using the trails_with_park view
    let query = supabase
      .from('trails_with_park')
      .select('*', { count: 'exact' });

    // Apply filters
    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }
    if (minLength) {
      query = query.gte('length_meters', parseFloat(minLength));
    }
    if (maxLength) {
      query = query.lte('length_meters', parseFloat(maxLength));
    }
    if (surface) {
      query = query.eq('surface', surface);
    }
    if (parkId) {
      query = query.eq('park_id', parkId);
    }
    if (parkSource) {
      query = query.eq('park_source', parkSource);
    }
    if (search) {
      query = query.textSearch('name', search, { type: 'websearch' });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1).order('name', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching trails:', error);
      return NextResponse.json({ error: 'Failed to fetch trails' }, { status: 500 });
    }

    return NextResponse.json({
      trails: data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Trails API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}