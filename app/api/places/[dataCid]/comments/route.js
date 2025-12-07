import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/places/[dataCid]/comments
 * Get comments for a place
 */
export async function GET(request, { params }) {
  try {
    const { dataCid } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!dataCid) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // First get the place ID from data_cid
    const { data: place, error: placeError } = await supabase
      .from('nearby_places')
      .select('id')
      .eq('data_cid', dataCid)
      .single();

    if (placeError) {
      if (placeError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      }
      throw placeError;
    }

    // Get comments with user info
    const { data: comments, error: commentsError } = await supabase
      .from('place_comments')
      .select(
        `
        id,
        content,
        rating,
        created_at,
        updated_at,
        user_id
      `
      )
      .eq('place_id', place.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (commentsError) {
      throw commentsError;
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('place_comments')
      .select('*', { count: 'exact', head: true })
      .eq('place_id', place.id);

    return NextResponse.json({
      comments: comments || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

/**
 * POST /api/places/[dataCid]/comments
 * Add a comment to a place
 */
export async function POST(request, { params }) {
  try {
    const { dataCid } = await params;
    const body = await request.json();
    const { content, rating } = body;

    if (!dataCid) {
      return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
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

    // Get the place ID from data_cid
    const { data: place, error: placeError } = await supabase
      .from('nearby_places')
      .select('id')
      .eq('data_cid', dataCid)
      .single();

    if (placeError) {
      if (placeError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      }
      throw placeError;
    }

    // Create the comment
    const { data: comment, error: commentError } = await supabase
      .from('place_comments')
      .insert({
        place_id: place.id,
        user_id: user.id,
        content: content.trim(),
        rating: rating || null,
      })
      .select()
      .single();

    if (commentError) {
      throw commentError;
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}