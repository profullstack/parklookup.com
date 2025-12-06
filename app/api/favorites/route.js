/**
 * Favorites API Route
 * GET /api/favorites - Get user favorites
 * POST /api/favorites - Add a favorite
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Helper to get user from authorization header
 */
async function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'No authorization token provided' };
  }

  const token = authHeader.substring(7);
  const supabase = createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user, error: null };
}

/**
 * GET handler for fetching user favorites
 */
export async function GET(request) {
  try {
    const { user, error: authError } = await getUserFromToken(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });
    const { searchParams } = new URL(request.url);
    const visitedOnly = searchParams.get('visited') === 'true';

    let query = supabase
      .from('user_favorites')
      .select(
        `
        id,
        user_id,
        nps_park_id,
        notes,
        visited,
        visited_at,
        created_at,
        nps_parks (
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
        )
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (visitedOnly) {
      query = query.eq('visited', true);
    }

    const { data: favorites, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
    }

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST handler for adding a favorite
 */
export async function POST(request) {
  try {
    const { user, error: authError } = await getUserFromToken(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });
    const body = await request.json();
    const { parkId, notes } = body;

    if (!parkId) {
      return NextResponse.json({ error: 'Park ID is required' }, { status: 400 });
    }

    const { data: favorite, error } = await supabase
      .from('user_favorites')
      .insert({
        user_id: user.id,
        nps_park_id: parkId,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Park already in favorites' }, { status: 409 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
    }

    return NextResponse.json({ favorite }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}