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
 * GET /api/media/[mediaId]/likes
 * Get likes for a media item and check if current user has liked
 */
export async function GET(request, { params }) {
  try {
    const { mediaId } = await params;
    const user = await getUserFromRequest(request);

    const supabase = createServiceClient();

    // Verify media exists
    const { data: media, error: mediaError } = await supabase
      .from('user_media')
      .select('id')
      .eq('id', mediaId)
      .eq('status', 'ready')
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Get like count
    const { count, error: countError } = await supabase
      .from('media_likes')
      .select('*', { count: 'exact', head: true })
      .eq('media_id', mediaId);

    if (countError) {
      console.error('Error counting likes:', countError);
      return NextResponse.json({ error: 'Failed to get likes' }, { status: 500 });
    }

    // Check if current user has liked
    let userHasLiked = false;
    if (user) {
      const { data: userLike } = await supabase
        .from('media_likes')
        .select('id')
        .eq('media_id', mediaId)
        .eq('user_id', user.id)
        .single();

      userHasLiked = !!userLike;
    }

    return NextResponse.json({
      likes_count: count || 0,
      user_has_liked: userHasLiked,
    });
  } catch (error) {
    console.error('Error in GET /api/media/[mediaId]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/media/[mediaId]/likes
 * Like a media item
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId } = await params;

    const supabase = createServiceClient();

    // Verify media exists
    const { data: media, error: mediaError } = await supabase
      .from('user_media')
      .select('id')
      .eq('id', mediaId)
      .eq('status', 'ready')
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('media_likes')
      .select('id')
      .eq('media_id', mediaId)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      return NextResponse.json({ error: 'Already liked' }, { status: 409 });
    }

    // Create like
    const { error } = await supabase.from('media_likes').insert({
      media_id: mediaId,
      user_id: user.id,
    });

    if (error) {
      console.error('Error creating like:', error);
      return NextResponse.json({ error: 'Failed to like media' }, { status: 500 });
    }

    // Get updated count
    const { count } = await supabase
      .from('media_likes')
      .select('*', { count: 'exact', head: true })
      .eq('media_id', mediaId);

    return NextResponse.json(
      {
        success: true,
        likes_count: count || 0,
        user_has_liked: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/media/[mediaId]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/media/[mediaId]/likes
 * Unlike a media item
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId } = await params;

    const supabase = createServiceClient();

    // Delete like
    const { error } = await supabase
      .from('media_likes')
      .delete()
      .eq('media_id', mediaId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting like:', error);
      return NextResponse.json({ error: 'Failed to unlike media' }, { status: 500 });
    }

    // Get updated count
    const { count } = await supabase
      .from('media_likes')
      .select('*', { count: 'exact', head: true })
      .eq('media_id', mediaId);

    return NextResponse.json({
      success: true,
      likes_count: count || 0,
      user_has_liked: false,
    });
  } catch (error) {
    console.error('Error in DELETE /api/media/[mediaId]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}