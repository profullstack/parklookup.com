/**
 * Favorites API Route
 * GET /api/favorites - Get user favorites
 * POST /api/favorites - Add a favorite
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
 * Determine if a park ID belongs to NPS or Wikidata
 * @param {object} supabase - Supabase client
 * @param {string} parkId - The park ID to check
 * @returns {Promise<{source: string, exists: boolean}>}
 */
async function determineParkSource(supabase, parkId) {
  // First check NPS parks
  const { data: npsData } = await supabase
    .from('nps_parks')
    .select('id')
    .eq('id', parkId)
    .single();
  
  if (npsData) {
    return { source: 'nps', exists: true };
  }
  
  // Then check Wikidata parks
  const { data: wikiData } = await supabase
    .from('wikidata_parks')
    .select('id')
    .eq('id', parkId)
    .single();
  
  if (wikiData) {
    return { source: 'wikidata', exists: true };
  }
  
  return { source: null, exists: false };
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

    // Fetch favorites with both NPS and Wikidata park data
    let query = supabase
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
      .eq('user_id', user.id);

    if (visitedOnly) {
      query = query.eq('visited', true);
    }

    query = query.order('created_at', { ascending: false });

    const { data: favorites, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
    }

    // Transform the response to use 'park' for frontend compatibility
    // Handle both NPS and Wikidata parks
    const transformedFavorites = (favorites || []).map((fav) => {
      // Determine which park data to use
      const isNpsPark = fav.nps_park_id && fav.nps_parks;
      const isWikidataPark = fav.wikidata_park_id && fav.wikidata_parks;
      
      let park = null;
      let parkId = null;
      let source = null;
      
      if (isNpsPark) {
        park = fav.nps_parks;
        parkId = fav.nps_park_id;
        source = 'nps';
      } else if (isWikidataPark) {
        // Transform wikidata park to match NPS park structure
        const wp = fav.wikidata_parks;
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
        parkId = fav.wikidata_park_id;
        source = 'wikidata';
      }
      
      return {
        ...fav,
        park,
        park_id: parkId,
        source,
        // Remove the raw join data
        nps_parks: undefined,
        wikidata_parks: undefined,
      };
    });

    return NextResponse.json({ favorites: transformedFavorites });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST handler for adding a favorite
 * Automatically detects if the park is NPS or Wikidata and stores accordingly
 */
export async function POST(request) {
  try {
    const { user, error: authError } = await getUserFromToken(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });
    const body = await request.json();
    const { parkId, notes, source } = body;

    if (!parkId) {
      return NextResponse.json({ error: 'Park ID is required' }, { status: 400 });
    }

    // Determine the park source if not provided
    let parkSource = source;
    if (!parkSource) {
      const { source: detectedSource, exists } = await determineParkSource(supabase, parkId);
      if (!exists) {
        return NextResponse.json({ error: 'Park not found' }, { status: 404 });
      }
      parkSource = detectedSource;
    }

    // Build the insert object based on park source
    const insertData = {
      user_id: user.id,
      notes: notes || null,
    };

    if (parkSource === 'nps') {
      insertData.nps_park_id = parkId;
    } else if (parkSource === 'wikidata') {
      insertData.wikidata_park_id = parkId;
    } else {
      return NextResponse.json({ error: 'Invalid park source' }, { status: 400 });
    }

    const { data: favorite, error } = await supabase
      .from('favorites')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Park already in favorites' }, { status: 409 });
      }
      if (error.code === '23503') {
        // Foreign key constraint violation - park ID not found
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Park not found in database' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
    }

    return NextResponse.json({ favorite, source: parkSource }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}