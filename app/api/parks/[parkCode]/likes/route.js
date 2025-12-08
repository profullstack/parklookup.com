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
 * GET /api/parks/[parkCode]/likes
 * Get likes count and user's like status for a park
 */
export async function GET(request, { params }) {
  try {
    const { parkCode } = await params;
    const user = await getUserFromRequest(request);
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

    // Get likes count
    const { count, error: countError } = await supabase
      .from('park_likes')
      .select('*', { count: 'exact', head: true })
      .eq('park_id', park.id);

    if (countError) {
      console.error('Error fetching park likes count:', countError);
      return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
    }

    // Check if user has liked
    let userHasLiked = false;
    if (user) {
      const { data: userLike } = await supabase
        .from('park_likes')
        .select('id')
        .eq('park_id', park.id)
        .eq('user_id', user.id)
        .single();

      userHasLiked = !!userLike;
    }

    return NextResponse.json({
      likes_count: count || 0,
      user_has_liked: userHasLiked,
    });
  } catch (error) {
    console.error('Error in GET /api/parks/[parkCode]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/parks/[parkCode]/likes
 * Add a like to a park
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Add like (upsert to handle duplicates)
    const { error } = await supabase.from('park_likes').upsert(
      {
        park_id: park.id,
        user_id: user.id,
      },
      { onConflict: 'park_id,user_id' }
    );

    if (error) {
      console.error('Error adding park like:', error);
      return NextResponse.json({ error: 'Failed to add like' }, { status: 500 });
    }

    // Get updated count
    const { count } = await supabase
      .from('park_likes')
      .select('*', { count: 'exact', head: true })
      .eq('park_id', park.id);

    return NextResponse.json({
      likes_count: count || 0,
      user_has_liked: true,
    });
  } catch (error) {
    console.error('Error in POST /api/parks/[parkCode]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/parks/[parkCode]/likes
 * Remove a like from a park
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Remove like
    const { error } = await supabase
      .from('park_likes')
      .delete()
      .eq('park_id', park.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error removing park like:', error);
      return NextResponse.json({ error: 'Failed to remove like' }, { status: 500 });
    }

    // Get updated count
    const { count } = await supabase
      .from('park_likes')
      .select('*', { count: 'exact', head: true })
      .eq('park_id', park.id);

    return NextResponse.json({
      likes_count: count || 0,
      user_has_liked: false,
    });
  } catch (error) {
    console.error('Error in DELETE /api/parks/[parkCode]/likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}