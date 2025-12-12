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
 * GET /api/media/[mediaId]/comments
 * Get all comments for a media item
 */
export async function GET(request, { params }) {
  try {
    const { mediaId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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

    // Get comments with user info
    const { data: comments, error } = await supabase
      .from('media_comments')
      .select(
        `
        *,
        profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq('media_id', mediaId)
      .is('parent_id', null) // Only top-level comments
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    // Get replies for each comment
    const commentIds = comments.map((c) => c.id);
    const { data: replies } = await supabase
      .from('media_comments')
      .select(
        `
        *,
        profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `
      )
      .in('parent_id', commentIds)
      .order('created_at', { ascending: true });

    // Group replies by parent
    const repliesByParent = {};
    replies?.forEach((reply) => {
      if (!repliesByParent[reply.parent_id]) {
        repliesByParent[reply.parent_id] = [];
      }
      repliesByParent[reply.parent_id].push(reply);
    });

    // Add replies to comments
    const commentsWithReplies = comments.map((comment) => ({
      ...comment,
      replies: repliesByParent[comment.id] || [],
    }));

    return NextResponse.json({ comments: commentsWithReplies });
  } catch (error) {
    console.error('Error in GET /api/media/[mediaId]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/media/[mediaId]/comments
 * Create a new comment on media
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId } = await params;
    const { content, parentId } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

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

    // If parentId is provided, verify parent comment exists
    if (parentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('media_comments')
        .select('id')
        .eq('id', parentId)
        .eq('media_id', mediaId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from('media_comments')
      .insert({
        media_id: mediaId,
        user_id: user.id,
        content: content.trim(),
        parent_id: parentId || null,
      })
      .select(
        `
        *,
        profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `
      )
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/media/[mediaId]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}