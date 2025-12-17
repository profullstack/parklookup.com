/**
 * Individual Track Comment API Route
 * PATCH /api/tracks/[id]/comments/[commentId] - Update a comment
 * DELETE /api/tracks/[id]/comments/[commentId] - Delete a comment
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
 * PATCH handler for updating a comment
 */
export async function PATCH(request, { params }) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id, commentId } = await params;

    if (!id || !commentId) {
      return NextResponse.json({ error: 'Track ID and Comment ID are required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Verify comment exists and belongs to user
    const { data: comment, error: commentError } = await supabase
      .from('track_comments')
      .select('id, user_id, track_id')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Verify comment belongs to the specified track
    if (comment.track_id !== id) {
      return NextResponse.json({ error: 'Comment does not belong to this track' }, { status: 400 });
    }

    // Verify ownership
    if (comment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this comment' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { content } = body;

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

    // Update comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('track_comments')
      .update({
        content: trimmedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
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
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    return NextResponse.json({
      comment: {
        id: updatedComment.id,
        content: updatedComment.content,
        parentId: updatedComment.parent_id,
        createdAt: updatedComment.created_at,
        updatedAt: updatedComment.updated_at,
        user: updatedComment.profiles
          ? {
              id: updatedComment.profiles.id,
              displayName: updatedComment.profiles.display_name,
              avatarUrl: updatedComment.profiles.avatar_url,
              username: updatedComment.profiles.username,
            }
          : null,
      },
      message: 'Comment updated successfully',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE handler for deleting a comment
 */
export async function DELETE(request, { params }) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id, commentId } = await params;

    if (!id || !commentId) {
      return NextResponse.json({ error: 'Track ID and Comment ID are required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Verify comment exists
    const { data: comment, error: commentError } = await supabase
      .from('track_comments')
      .select('id, user_id, track_id')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Verify comment belongs to the specified track
    if (comment.track_id !== id) {
      return NextResponse.json({ error: 'Comment does not belong to this track' }, { status: 400 });
    }

    // Get track to check if user is track owner
    const { data: track } = await supabase
      .from('user_tracks')
      .select('user_id')
      .eq('id', id)
      .single();

    const isCommentOwner = comment.user_id === user.id;
    const isTrackOwner = track?.user_id === user.id;

    // Allow deletion if user owns the comment OR owns the track
    if (!isCommentOwner && !isTrackOwner) {
      return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 });
    }

    // Delete comment (this will cascade delete replies due to FK constraint)
    const { error: deleteError } = await supabase
      .from('track_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    // Get updated comments count
    const { count: commentsCount } = await supabase
      .from('track_comments')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', id);

    return NextResponse.json({
      commentsCount,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
