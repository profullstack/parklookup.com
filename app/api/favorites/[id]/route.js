/**
 * Single Favorite API Route
 * GET /api/favorites/[id] - Get a single favorite
 * PATCH /api/favorites/[id] - Update a favorite
 * DELETE /api/favorites/[id] - Delete a favorite
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for fetching a single favorite
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const supabase = createServerClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const { id } = params;
    const supabase = createServerClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notes, visited, visitedAt } = body;

    // Build update object
    const updates = {};
    if (notes !== undefined) updates.notes = notes;
    if (visited !== undefined) updates.visited = visited;
    if (visitedAt !== undefined) updates.visited_at = visitedAt;

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
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const supabase = createServerClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to delete favorite' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}