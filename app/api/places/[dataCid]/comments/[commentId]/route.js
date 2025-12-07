import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * PUT /api/places/[dataCid]/comments/[commentId]
 * Update a comment
 */
export async function PUT(request, { params }) {
  try {
    const { dataCid, commentId } = await params;
    const body = await request.json();
    const { content, rating } = body;

    if (!dataCid || !commentId) {
      return NextResponse.json({ error: 'Place ID and Comment ID are required' }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
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

    // Update the comment (RLS will ensure user can only update their own)
    const { data: comment, error: commentError } = await supabase
      .from('place_comments')
      .update({
        content: content.trim(),
        rating: rating || null,
      })
      .eq('id', commentId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (commentError) {
      if (commentError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Comment not found or you do not have permission to edit it' },
          { status: 404 }
        );
      }
      throw commentError;
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

/**
 * DELETE /api/places/[dataCid]/comments/[commentId]
 * Delete a comment
 */
export async function DELETE(request, { params }) {
  try {
    const { dataCid, commentId } = await params;

    if (!dataCid || !commentId) {
      return NextResponse.json({ error: 'Place ID and Comment ID are required' }, { status: 400 });
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

    // Delete the comment (RLS will ensure user can only delete their own)
    const { error: deleteError } = await supabase
      .from('place_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}