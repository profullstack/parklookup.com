/**
 * Favorites Tracks API Route
 * GET /api/favorites/tracks - Get user's liked tracks
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Helper to get user from authorization header
 */
async function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'No authorization token provided' };
  }

  const token = authHeader.substring(7);
  const supabase = createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user, error: null };
}

/**
 * GET handler for fetching user's liked tracks
 */
export async function GET(request) {
  try {
    const { user, error: authError } = await getUserFromToken(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Get all tracks the user has liked
    const { data: likedTracks, error } = await supabase
      .from('track_likes')
      .select(`
        id,
        created_at,
        track_id,
        user_tracks (
          id,
          user_id,
          title,
          description,
          activity_type,
          distance_meters,
          duration_seconds,
          elevation_gain_m,
          status,
          is_public,
          shared_at,
          park_code,
          geometry
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch liked tracks' }, { status: 500 });
    }

    // Filter out tracks that are:
    // 1. Deleted
    // 2. Not accessible (not public/shared AND not owned by the user)
    const validTracks = (likedTracks || []).filter((like) => {
      if (!like.user_tracks) return false;
      if (like.user_tracks.status === 'deleted') return false;
      
      // User can see their own tracks regardless of public status
      if (like.user_tracks.user_id === user.id) return true;
      
      // For other users' tracks, must be public and shared
      return like.user_tracks.is_public && like.user_tracks.status === 'shared';
    });

    // Get unique user IDs and park codes for additional data
    const userIds = [...new Set(validTracks.map((t) => t.user_tracks.user_id))];
    const parkCodes = [...new Set(validTracks.map((t) => t.user_tracks.park_code).filter(Boolean))];
    const trackIds = validTracks.map((t) => t.track_id);

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username')
      .in('id', userIds);

    // Fetch parks
    const { data: parks } = parkCodes.length > 0
      ? await supabase
          .from('all_parks')
          .select('id, park_code, full_name')
          .in('park_code', parkCodes)
      : { data: [] };

    // Fetch likes and comments counts
    const { data: likeCounts } = await supabase
      .from('track_likes')
      .select('track_id')
      .in('track_id', trackIds);

    const { data: commentCounts } = await supabase
      .from('track_comments')
      .select('track_id')
      .in('track_id', trackIds);

    // Create lookup maps
    const profileMap = {};
    profiles?.forEach((p) => {
      profileMap[p.id] = p;
    });

    const parkMap = {};
    parks?.forEach((p) => {
      parkMap[p.park_code] = p;
    });

    const likeCountMap = {};
    likeCounts?.forEach((like) => {
      likeCountMap[like.track_id] = (likeCountMap[like.track_id] || 0) + 1;
    });

    const commentCountMap = {};
    commentCounts?.forEach((comment) => {
      commentCountMap[comment.track_id] = (commentCountMap[comment.track_id] || 0) + 1;
    });

    // Transform tracks
    const transformedTracks = validTracks.map((like) => {
      const track = like.user_tracks;
      const profile = profileMap[track.user_id];
      const park = parkMap[track.park_code];

      return {
        like_id: like.id,
        liked_at: like.created_at,
        track_id: track.id,
        user_id: track.user_id,
        user_username: profile?.username,
        user_display_name: profile?.display_name,
        user_avatar_url: profile?.avatar_url,
        title: track.title,
        description: track.description,
        activity_type: track.activity_type,
        distance_meters: track.distance_meters,
        duration_seconds: track.duration_seconds,
        elevation_gain_m: track.elevation_gain_m,
        park_code: track.park_code,
        park_name: park?.full_name,
        geometry: track.geometry,
        likes_count: likeCountMap[track.id] || 0,
        comments_count: commentCountMap[track.id] || 0,
        shared_at: track.shared_at,
      };
    });

    return NextResponse.json({ tracks: transformedTracks });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
