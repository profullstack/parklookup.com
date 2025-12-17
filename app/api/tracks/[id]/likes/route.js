/**
 * Track Likes API Route
 * GET /api/tracks/[id]/likes - Get likes for a track
 * POST /api/tracks/[id]/likes - Like a track
 * DELETE /api/tracks/[id]/likes - Unlike a track
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Get authenticated user from request
 * @param {Request} request - Incoming request
 * @returns {Promise<Object|null>} User object or null
 */
const getAuthenticatedUser = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = createServerClient({ useServiceRole: true });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.error('Auth error:', error?.message);
    return null;
  }

  return user;
};

/**
 * GET handler for getting track likes
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Verify track exists and is accessible
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id, is_public, status')
      .eq('id', id)
      .neq('status', 'deleted')
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Check access
    const user = await getAuthenticatedUser(request);
    const isOwner = user?.id === track.user_id;
    const isPublic = track.is_public && track.status === 'shared';

    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get likes with user info
    const { data: likes, error, count } = await supabase
      .from('track_likes')
      .select(
        `
        id,
        created_at,
        profiles!track_likes_user_id_fkey (
          id,
          display_name,
          avatar_url,
          username
        )
      `,
        { count: 'exact' }
      )
      .eq('track_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
    }

    // Check if current user has liked
    let userHasLiked = false;
    if (user) {
      const { data: userLike } = await supabase
        .from('track_likes')
        .select('id')
        .eq('track_id', id)
        .eq('user_id', user.id)
        .single();
      userHasLiked = !!userLike;
    }

    // Transform likes
    const transformedLikes = likes.map((like) => ({
      id: like.id,
      createdAt: like.created_at,
      user: like.profiles
        ? {
            id: like.profiles.id,
            displayName: like.profiles.display_name,
            avatarUrl: like.profiles.avatar_url,
            username: like.profiles.username,
          }
        : null,
    }));

    return NextResponse.json({
      likes: transformedLikes,
      likesCount: count,
      userHasLiked,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST handler for liking a track
 */
export async function POST(request, { params }) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Verify track exists and is public (or owned by user)
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id, is_public, status')
      .eq('id', id)
      .neq('status', 'deleted')
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const isOwner = user.id === track.user_id;
    const isPublic = track.is_public && track.status === 'shared';

    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('track_likes')
      .select('id')
      .eq('track_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      return NextResponse.json(
        {
          error: 'Already liked',
          message: 'You have already liked this track.',
        },
        { status: 400 }
      );
    }

    // Create like
    const { data: like, error: insertError } = await supabase
      .from('track_likes')
      .insert({
        track_id: id,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            error: 'Already liked',
            message: 'You have already liked this track.',
          },
          { status: 400 }
        );
      }
      console.error('Database error:', insertError);
      return NextResponse.json({ error: 'Failed to like track' }, { status: 500 });
    }

    // Get updated likes count
    const { count: likesCount } = await supabase
      .from('track_likes')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', id);

    return NextResponse.json(
      {
        like: {
          id: like.id,
          createdAt: like.created_at,
        },
        likesCount,
        message: 'Track liked successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE handler for unliking a track
 */
export async function DELETE(request, { params }) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Delete like
    const { error: deleteError, count } = await supabase
      .from('track_likes')
      .delete({ count: 'exact' })
      .eq('track_id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return NextResponse.json({ error: 'Failed to unlike track' }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json(
        {
          error: 'Not liked',
          message: 'You have not liked this track.',
        },
        { status: 400 }
      );
    }

    // Get updated likes count
    const { count: likesCount } = await supabase
      .from('track_likes')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', id);

    return NextResponse.json({
      likesCount,
      message: 'Track unliked successfully',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
