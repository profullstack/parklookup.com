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
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
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
 * GET /api/parks/[parkCode]/comments
 * Get all comments for a park
 */
export async function GET(request, { params }) {
  try {
    const { parkCode } = await params;
    const supabase = createServiceClient();

    // First get the park ID from the park code
    const { data: park, error: parkError } = await supabase
      .from('all_parks')
      .select('id')
      .eq('park_code', parkCode)
      .single();

    if (parkError || !park) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
    }

    // Get comments for this park
    const { data: comments, error } = await supabase
      .from('park_comments')
      .select('*')
      .eq('park_id', park.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching park comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error('Error in GET /api/parks/[parkCode]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/parks/[parkCode]/comments
 * Create a new comment for a park
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { parkCode } = await params;
    const { content, rating } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (rating !== null && rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // First get the park ID from the park code
    const { data: park, error: parkError } = await supabase
      .from('all_parks')
      .select('id')
      .eq('park_code', parkCode)
      .single();

    if (parkError || !park) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
    }

    // Create the comment
    const { data: comment, error } = await supabase
      .from('park_comments')
      .insert({
        park_id: park.id,
        user_id: user.id,
        content: content.trim(),
        rating: rating || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating park comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/parks/[parkCode]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}