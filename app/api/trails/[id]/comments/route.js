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
 * GET /api/trails/[id]/comments
 * Get all comments for a trail
 */
export async function GET(request, { params }) {
  try {
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

    // Get comments for this trail with user profile info
    const { data: comments, error } = await supabase
      .from('trail_comments')
      .select('*')
      .eq('trail_id', trailId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trail comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    // Fetch user profiles for all comments
    const userIds = [...new Set((comments || []).map((c) => c.user_id))];
    let profileMap = {};
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);
      
      profiles?.forEach((p) => {
        profileMap[p.id] = p;
      });
    }

    // Attach profile info to each comment
    const commentsWithProfiles = (comments || []).map((comment) => ({
      ...comment,
      profile: profileMap[comment.user_id] || null,
    }));

    return NextResponse.json({ comments: commentsWithProfiles });
  } catch (error) {
    console.error('Error in GET /api/trails/[id]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/trails/[id]/comments
 * Create a new comment for a trail
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trailId } = await params;
    const { content, rating } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (rating !== null && rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

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

    // Create the comment
    const { data: comment, error } = await supabase
      .from('trail_comments')
      .insert({
        trail_id: trailId,
        user_id: user.id,
        content: content.trim(),
        rating: rating || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trail comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Fetch the user's profile to include in response
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      comment: {
        ...comment,
        profile: profile || null,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/trails/[id]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
