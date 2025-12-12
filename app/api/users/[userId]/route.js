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
 * GET /api/users/[userId]
 * Get user profile with stats
 */
export async function GET(request, { params }) {
  try {
    const { userId } = await params;
    const currentUser = await getUserFromRequest(request);

    const supabase = createServiceClient();

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get follower count
    const { count: followersCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    // Get following count
    const { count: followingCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    // Get media count
    const { count: mediaCount } = await supabase
      .from('user_media')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'ready');

    // Check if current user is following
    let isFollowing = false;
    if (currentUser && currentUser.id !== userId) {
      const { data: follow } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .single();

      isFollowing = !!follow;
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        created_at: profile.created_at,
      },
      stats: {
        followers_count: followersCount || 0,
        following_count: followingCount || 0,
        media_count: mediaCount || 0,
      },
      is_following: isFollowing,
      is_own_profile: currentUser?.id === userId,
    });
  } catch (error) {
    console.error('Error in GET /api/users/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}