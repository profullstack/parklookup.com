/**
 * Parks Search API Route
 * GET /api/parks/search - Full-text search for parks
 */

import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for searching parks
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q');
    const state = searchParams.get('state');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offsetParam = searchParams.get('offset');
    const offset = offsetParam ? parseInt(offsetParam, 10) : (page - 1) * limit;

    const supabase = createServerClient();

    // Build query based on parameters
    // Use all_parks view to include both NPS and state parks
    let query = supabase
      .from('all_parks')
      .select(
        `
        id,
        park_code,
        full_name,
        description,
        states,
        latitude,
        longitude,
        designation,
        url,
        images,
        wikidata_id,
        wikidata_image,
        link_confidence,
        source
      `,
        { count: 'exact' }
      );

    // Apply search filter if query provided
    if (q && q.trim().length > 0) {
      query = query.or(`full_name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Apply state filter if provided
    if (state && state.trim().length > 0) {
      query = query.ilike('states', `%${state}%`);
    }

    const { data: parks, error, count } = await query
      .order('full_name')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to search parks' }, { status: 500 });
    }

    return NextResponse.json({
      parks: parks || [],
      total: count || 0,
      query: q,
      state,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}