/**
 * Single Favorite API Route
 * GET /api/favorites/[id] - Get a single favorite
 * PATCH /api/favorites/[id] - Update a favorite
 * DELETE /api/favorites/[id] - Delete a favorite
 *
 * Supports both NPS parks (nps_park_id) and Wikidata/state parks (wikidata_park_id)
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
        wikidata_park_id,
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
        ),
        wikidata_parks (
          id,
          wikidata_id,
          label,
          state,
          latitude,
          longitude,
          image_url,
          website
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

    // Transform to include park data in a unified format
    const isNpsPark = favorite.nps_park_id && favorite.nps_parks;
    const isWikidataPark = favorite.wikidata_park_id && favorite.wikidata_parks;
    
    let park = null;
    let source = null;
    
    if (isNpsPark) {
      park = favorite.nps_parks;
      source = 'nps';
    } else if (isWikidataPark) {
      const wp = favorite.wikidata_parks;
      park = {
        id: wp.id,
        park_code: wp.wikidata_id,
        full_name: wp.label,
        description: null,
        states: wp.state,
        latitude: wp.latitude,
        longitude: wp.longitude,
        designation: 'State Park',
        url: wp.website,
        images: wp.image_url ? [{ url: wp.image_url, title: wp.label }] : null,
      };
      source = 'wikidata';
    }

    return NextResponse.json({
      favorite: {
        ...favorite,
        park,
        source,
        nps_parks: undefined,
        wikidata_parks: undefined,
      }
    });
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
 * The [id] parameter can be:
 * - The favorite record ID
 * - The nps_park_id (UUID)
 * - The wikidata_park_id (UUID)
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
    const { data: deletedByNpsParkId, error: npsError } = await supabase
      .from('favorites')
      .delete()
      .eq('nps_park_id', id)
      .eq('user_id', user.id)
      .select();

    if (!npsError && deletedByNpsParkId && deletedByNpsParkId.length > 0) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Try to delete by wikidata_park_id (for state parks)
    const { data: deletedByWikidataParkId, error: wikiError } = await supabase
      .from('favorites')
      .delete()
      .eq('wikidata_park_id', id)
      .eq('user_id', user.id)
      .select();

    if (!wikiError && deletedByWikidataParkId && deletedByWikidataParkId.length > 0) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // If no rows deleted by park IDs, try by favorite record id
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