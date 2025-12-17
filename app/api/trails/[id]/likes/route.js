import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * Get user from Authorization header
 * @param {Request} request - The request object
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserFromRequest(request) {
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.replace('Bearer ', '');
    const supabase = createServiceClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}

/**
 * GET /api/trails/[id]/likes
 * Get likes count and user's like status for a trail
 */
export async function GET(request, { params }) {
  try {
    const { id: trailId } = await params;
    const supabase = createServiceClient();

    // Get current user (optional)
    const user = await getUserFromRequest(request);

    // Verify trail exists
    const { data: trail, error: trailError } = await supabase
      .from('trails')
      .select('id')
      .eq('id', trailId)
      .single();

    if (trailError || !trail) {
      return NextResponse.json({ error: 'Trail not found' }, { status: 404 });
    }

    // Get total likes count
    const { count, error: countError } = await supabase
      .from('trail_likes')
      .select('*', { count: 'exact', head: true })
      .eq('trail_id', trailId);

    if (countError) {
      console.error('Error fetching trail likes count:', countError);
      return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
    }

    // Check if current user has liked
    let userHasLiked = false;
    if (user) {
      const { data: userLike } = await supabase
        .from('trail_likes')
        .select('id')
        .eq('trail_id', trailId)
        .eq('user_id', user.id)
        .single();

      userHasLiked = !!userLike;
    }

    return NextResponse.json({
      likes_count: count || 0,
      user_has_liked: userHasLiked,
    });
  } catch (error) {
    console.error('Error in GET /api/trails/[id]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/trails/[id]/likes
 * Like a trail
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trailId } = await params;
    const supabase = createServiceClient();

    // Verify trail exists
    const { data: trail, error: trailError } = await supabase
      .from('trails')
      .select('id')
      .eq('id', trailId)
      .single();

    if (trailError || !trail) {
      return NextResponse.json({ error: 'Trail not found' }, { status: 404 });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('trail_likes')
      .select('id')
      .eq('trail_id', trailId)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      // Already liked, return current state
      const { count } = await supabase
        .from('trail_likes')
        .select('*', { count: 'exact', head: true })
        .eq('trail_id', trailId);

      return NextResponse.json({
        likes_count: count || 0,
        user_has_liked: true,
      });
    }

    // Create the like
    const { error } = await supabase.from('trail_likes').insert({
      trail_id: trailId,
      user_id: user.id,
    });

    if (error) {
      console.error('Error creating trail like:', error);
      return NextResponse.json({ error: 'Failed to like trail' }, { status: 500 });
    }

    // Get updated count
    const { count } = await supabase
      .from('trail_likes')
      .select('*', { count: 'exact', head: true })
      .eq('trail_id', trailId);

    return NextResponse.json(
      {
        likes_count: count || 0,
        user_has_liked: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/trails/[id]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/trails/[id]/likes
 * Unlike a trail
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trailId } = await params;
    const supabase = createServiceClient();

    // Delete the like
    const { error } = await supabase
      .from('trail_likes')
      .delete()
      .eq('trail_id', trailId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting trail like:', error);
      return NextResponse.json({ error: 'Failed to unlike trail' }, { status: 500 });
    }

    // Get updated count
    const { count } = await supabase
      .from('trail_likes')
      .select('*', { count: 'exact', head: true })
      .eq('trail_id', trailId);

    return NextResponse.json({
      likes_count: count || 0,
      user_has_liked: false,
    });
  } catch (error) {
    console.error('Error in DELETE /api/trails/[id]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
