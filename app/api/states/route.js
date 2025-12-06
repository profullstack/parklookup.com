import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Creates a Supabase client for server-side operations
 */
const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * GET /api/states
 * Returns all states with park counts
 */
export async function GET(request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    // Query parameters
    const withParks = searchParams.get('withParks') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let query = supabase
      .from('states')
      .select('id, code, name, slug, latitude, longitude, park_count')
      .order('name');

    // Optionally filter to only states with parks
    if (withParks) {
      query = query.gt('park_count', 0);
    }

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch states' }, { status: 500 });
    }

    return NextResponse.json({
      states: data ?? [],
      total: data?.length ?? 0,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}