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
 * GET /api/users/[userId]/follow
 * Check if current user is following the target user
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    const { userId } = await params;

    if (!user) {
      return NextResponse.json({ is_following: false });
    }

    const supabase = createServiceClient();

    // Check if following
    const { data: follow } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .single();

    return NextResponse.json({ is_following: !!follow });
  } catch (error) {
    console.error('Error in GET /api/users/[userId]/follow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/users/[userId]/follow
 * Follow a user
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;

    // Can't follow yourself
    if (user.id === userId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify target user exists
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .single();

    if (existingFollow) {
      return NextResponse.json({ error: 'Already following' }, { status: 409 });
    }

    // Create follow
    const { error } = await supabase.from('user_follows').insert({
      follower_id: user.id,
      following_id: userId,
    });

    if (error) {
      console.error('Error creating follow:', error);
      return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
    }

    // Get updated follower count
    const { count } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    return NextResponse.json(
      {
        success: true,
        is_following: true,
        followers_count: count || 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/users/[userId]/follow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[userId]/follow
 * Unfollow a user
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;

    const supabase = createServiceClient();

    // Delete follow
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', userId);

    if (error) {
      console.error('Error deleting follow:', error);
      return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
    }

    // Get updated follower count
    const { count } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    return NextResponse.json({
      success: true,
      is_following: false,
      followers_count: count || 0,
    });
  } catch (error) {
    console.error('Error in DELETE /api/users/[userId]/follow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}