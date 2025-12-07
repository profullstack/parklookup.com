import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/places/[dataCid]/likes
 * Get likes count and check if current user has liked
 */
export async function GET(request, { params }) {
  try {
    const { dataCid } = await params;

    if (!dataCid) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get the place ID from data_cid
    const { data: place, error: placeError } = await supabase
      .from('nearby_places')
      .select('id')
      .eq('data_cid', dataCid)
      .single();

    if (placeError) {
      if (placeError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      }
      throw placeError;
    }

    // Get likes count
    const { count, error: countError } = await supabase
      .from('place_likes')
      .select('*', { count: 'exact', head: true })
      .eq('place_id', place.id);

    if (countError) {
      throw countError;
    }

    // Check if current user has liked
    let userHasLiked = false;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: userLike } = await supabase
        .from('place_likes')
        .select('id')
        .eq('place_id', place.id)
        .eq('user_id', user.id)
        .single();

      userHasLiked = !!userLike;
    }

    return NextResponse.json({
      likes_count: count || 0,
      user_has_liked: userHasLiked,
    });
  } catch (error) {
    console.error('Error fetching likes:', error);
    return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
  }
}

/**
 * POST /api/places/[dataCid]/likes
 * Like a place
 */
export async function POST(request, { params }) {
  try {
    const { dataCid } = await params;

    if (!dataCid) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get the place ID from data_cid
    const { data: place, error: placeError } = await supabase
      .from('nearby_places')
      .select('id')
      .eq('data_cid', dataCid)
      .single();

    if (placeError) {
      if (placeError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      }
      throw placeError;
    }

    // Create the like
    const { data: like, error: likeError } = await supabase
      .from('place_likes')
      .insert({
        place_id: place.id,
        user_id: user.id,
      })
      .select()
      .single();

    if (likeError) {
      // Handle duplicate like
      if (likeError.code === '23505') {
        return NextResponse.json({ error: 'You have already liked this place' }, { status: 409 });
      }
      throw likeError;
    }

    // Get updated count
    const { count } = await supabase
      .from('place_likes')
      .select('*', { count: 'exact', head: true })
      .eq('place_id', place.id);

    return NextResponse.json(
      {
        success: true,
        likes_count: count || 0,
        user_has_liked: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating like:', error);
    return NextResponse.json({ error: 'Failed to like place' }, { status: 500 });
  }
}

/**
 * DELETE /api/places/[dataCid]/likes
 * Unlike a place
 */
export async function DELETE(request, { params }) {
  try {
    const { dataCid } = await params;

    if (!dataCid) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get the place ID from data_cid
    const { data: place, error: placeError } = await supabase
      .from('nearby_places')
      .select('id')
      .eq('data_cid', dataCid)
      .single();

    if (placeError) {
      if (placeError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      }
      throw placeError;
    }

    // Delete the like
    const { error: deleteError } = await supabase
      .from('place_likes')
      .delete()
      .eq('place_id', place.id)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    // Get updated count
    const { count } = await supabase
      .from('place_likes')
      .select('*', { count: 'exact', head: true })
      .eq('place_id', place.id);

    return NextResponse.json({
      success: true,
      likes_count: count || 0,
      user_has_liked: false,
    });
  } catch (error) {
    console.error('Error removing like:', error);
    return NextResponse.json({ error: 'Failed to unlike place' }, { status: 500 });
  }
}