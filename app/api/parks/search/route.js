/**
 * Parks Search API Route
 * GET /api/parks/search - Full-text search for parks
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for searching parks
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Use full-text search on the nps_parks table
    const { data: parks, error, count } = await supabase
      .from('nps_parks')
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
        images
      `,
        { count: 'exact' }
      )
      .textSearch('full_name', q, {
        type: 'websearch',
        config: 'english',
      })
      .order('full_name')
      .range(offset, offset + limit - 1);

    if (error) {
      // Fallback to ilike search if full-text search fails
      const { data: fallbackParks, error: fallbackError, count: fallbackCount } = await supabase
        .from('nps_parks')
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
          images
        `,
          { count: 'exact' }
        )
        .or(`full_name.ilike.%${q}%,description.ilike.%${q}%`)
        .order('full_name')
        .range(offset, offset + limit - 1);

      if (fallbackError) {
        console.error('Database error:', fallbackError);
        return NextResponse.json({ error: 'Failed to search parks' }, { status: 500 });
      }

      return NextResponse.json({
        parks: fallbackParks,
        query: q,
        pagination: {
          page,
          limit,
          total: fallbackCount,
          totalPages: Math.ceil(fallbackCount / limit),
          hasMore: offset + limit < fallbackCount,
        },
      });
    }

    return NextResponse.json({
      parks,
      query: q,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasMore: offset + limit < count,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}