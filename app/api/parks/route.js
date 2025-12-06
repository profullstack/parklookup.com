/**
 * Parks API Route
 * GET /api/parks - List all parks with pagination and filtering
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for listing parks
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Filter parameters
    const state = searchParams.get('state');
    const q = searchParams.get('q');
    const designation = searchParams.get('designation');

    // Sort parameters
    const sortBy = searchParams.get('sortBy') || 'full_name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from('parks_combined')
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
        link_confidence
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (state) {
      query = query.ilike('states', `%${state}%`);
    }

    if (designation) {
      query = query.eq('designation', designation);
    }

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Apply sorting
    const validSortColumns = ['full_name', 'states', 'designation', 'park_code'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'full_name';
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: parks, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch parks' }, { status: 500 });
    }

    return NextResponse.json({
      parks,
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