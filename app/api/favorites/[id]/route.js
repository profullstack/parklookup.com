/**
 * Single Favorite API Route
 * GET /api/favorites/[id] - Get a single favorite
 * PATCH /api/favorites/[id] - Update a favorite
 * DELETE /api/favorites/[id] - Delete a favorite
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
 * GET handler for fetching a single favorite
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getUserFromToken(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    const { data: favorite, error } = await supabase
      .from('favorites')
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
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch favorite' }, { status: 500 });
    }

    return NextResponse.json({ favorite });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH handler for updating a favorite
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getUserFromToken(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });
    const body = await request.json();
    const { notes, visited, visitedAt } = body;

    // Build update object
    const updates = {};
    if (notes !== undefined) {updates.notes = notes;}
    if (visited !== undefined) {updates.visited = visited;}
    if (visitedAt !== undefined) {updates.visited_at = visitedAt;}

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: favorite, error } = await supabase
      .from('favorites')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 });
    }

    return NextResponse.json({ favorite });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE handler for removing a favorite
 * The [id] parameter can be either the favorite record ID or the nps_park_id (UUID)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getUserFromToken(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Try to delete by nps_park_id first (most common case from FavoriteButton)
    const { data: deletedByParkId, error: parkIdError } = await supabase
      .from('favorites')
      .delete()
      .eq('nps_park_id', id)
      .eq('user_id', user.id)
      .select();

    if (!parkIdError && deletedByParkId && deletedByParkId.length > 0) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // If no rows deleted by nps_park_id, try by favorite record id
    const { data: deletedById, error: idError } = await supabase
      .from('favorites')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select();

    if (idError) {
      console.error('Database error:', idError);
      return NextResponse.json({ error: 'Failed to delete favorite' }, { status: 500 });
    }

    if (!deletedById || deletedById.length === 0) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}