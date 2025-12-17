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
 * PUT /api/trails/[id]/comments/[commentId]
 * Update a comment
 */
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trailId, commentId } = await params;
    const { content, rating } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (rating !== null && rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify comment exists and belongs to user
    const { data: existingComment, error: fetchError } = await supabase
      .from('trail_comments')
      .select('*')
      .eq('id', commentId)
      .eq('trail_id', trailId)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (existingComment.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the comment
    const { data: comment, error } = await supabase
      .from('trail_comments')
      .update({
        content: content.trim(),
        rating: rating || null,
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating trail comment:', error);
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Error in PUT /api/trails/[id]/comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/trails/[id]/comments/[commentId]
 * Delete a comment
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trailId, commentId } = await params;
    const supabase = createServiceClient();

    // Verify comment exists and belongs to user
    const { data: existingComment, error: fetchError } = await supabase
      .from('trail_comments')
      .select('*')
      .eq('id', commentId)
      .eq('trail_id', trailId)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (existingComment.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the comment
    const { error } = await supabase.from('trail_comments').delete().eq('id', commentId);

    if (error) {
      console.error('Error deleting trail comment:', error);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/trails/[id]/comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
