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
 * PATCH /api/media/[mediaId]/comments/[commentId]
 * Update a comment
 */
export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId, commentId } = await params;
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get comment and verify ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('media_comments')
      .select('*')
      .eq('id', commentId)
      .eq('media_id', mediaId)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (existingComment.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update comment
    const { data: comment, error } = await supabase
      .from('media_comments')
      .update({ content: content.trim() })
      .eq('id', commentId)
      .select(
        `
        *,
        profiles:user_id (
          display_name,
          avatar_url
        )
      `
      )
      .single();

    if (error) {
      console.error('Error updating comment:', error);
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Error in PATCH /api/media/[mediaId]/comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/media/[mediaId]/comments/[commentId]
 * Delete a comment
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId, commentId } = await params;

    const supabase = createServiceClient();

    // Get comment and verify ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('media_comments')
      .select('*')
      .eq('id', commentId)
      .eq('media_id', mediaId)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (existingComment.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete comment (cascades to replies)
    const { error } = await supabase.from('media_comments').delete().eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/media/[mediaId]/comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}