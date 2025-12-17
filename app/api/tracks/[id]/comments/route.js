/**
 * Track Comments API Route
 * GET /api/tracks/[id]/comments - Get comments for a track
 * POST /api/tracks/[id]/comments - Add a comment to a track
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
 * GET handler for getting track comments
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

    // Get comments with user info
    const { data: comments, error, count } = await supabase
      .from('track_comments')
      .select(
        `
        id,
        content,
        parent_id,
        created_at,
        updated_at,
        profiles!track_comments_user_id_fkey (
          id,
          display_name,
          avatar_url,
          username
        )
      `,
        { count: 'exact' }
      )
      .eq('track_id', id)
      .is('parent_id', null) // Only get top-level comments
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    // Get replies for each comment
    const commentIds = comments.map((c) => c.id);
    let repliesMap = {};

    if (commentIds.length > 0) {
      const { data: replies } = await supabase
        .from('track_comments')
        .select(
          `
          id,
          content,
          parent_id,
          created_at,
          updated_at,
          profiles!track_comments_user_id_fkey (
            id,
            display_name,
            avatar_url,
            username
          )
        `
        )
        .in('parent_id', commentIds)
        .order('created_at', { ascending: true });

      if (replies) {
        replies.forEach((reply) => {
          if (!repliesMap[reply.parent_id]) {
            repliesMap[reply.parent_id] = [];
          }
          repliesMap[reply.parent_id].push({
            id: reply.id,
            content: reply.content,
            createdAt: reply.created_at,
            updatedAt: reply.updated_at,
            user: reply.profiles
              ? {
                  id: reply.profiles.id,
                  displayName: reply.profiles.display_name,
                  avatarUrl: reply.profiles.avatar_url,
                  username: reply.profiles.username,
                }
              : null,
          });
        });
      }
    }

    // Transform comments
    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: comment.profiles
        ? {
            id: comment.profiles.id,
            displayName: comment.profiles.display_name,
            avatarUrl: comment.profiles.avatar_url,
            username: comment.profiles.username,
          }
        : null,
      replies: repliesMap[comment.id] || [],
    }));

    return NextResponse.json({
      comments: transformedComments,
      commentsCount: count,
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
 * POST handler for adding a comment to a track
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

    // Parse request body
    const body = await request.json();
    const { content, parentId } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    // Validate content length
    const trimmedContent = content.trim();
    if (trimmedContent.length > 2000) {
      return NextResponse.json(
        { error: 'Comment content must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // If parentId is provided, verify it exists and belongs to this track
    if (parentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('track_comments')
        .select('id, track_id')
        .eq('id', parentId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }

      if (parentComment.track_id !== id) {
        return NextResponse.json(
          { error: 'Parent comment does not belong to this track' },
          { status: 400 }
        );
      }
    }

    // Create comment
    const { data: comment, error: insertError } = await supabase
      .from('track_comments')
      .insert({
        track_id: id,
        user_id: user.id,
        content: trimmedContent,
        parent_id: parentId || null,
      })
      .select(
        `
        id,
        content,
        parent_id,
        created_at,
        profiles!track_comments_user_id_fkey (
          id,
          display_name,
          avatar_url,
          username
        )
      `
      )
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Get updated comments count
    const { count: commentsCount } = await supabase
      .from('track_comments')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', id);

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          content: comment.content,
          parentId: comment.parent_id,
          createdAt: comment.created_at,
          user: comment.profiles
            ? {
                id: comment.profiles.id,
                displayName: comment.profiles.display_name,
                avatarUrl: comment.profiles.avatar_url,
                username: comment.profiles.username,
              }
            : null,
        },
        commentsCount,
        message: 'Comment added successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
