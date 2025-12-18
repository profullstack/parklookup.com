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
 * Fetch public tracks for the feed
 * @param {Object} supabase - Supabase client
 * @param {number} limit - Number of tracks to fetch
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of track items
 */
async function fetchPublicTracks(supabase, limit, offset) {
  const { data: tracks, error } = await supabase
    .from('user_tracks')
    .select(`
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
      created_at,
      park_code,
      geometry
    `)
    .eq('is_public', true)
    .eq('status', 'shared')
    .order('shared_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching public tracks:', error);
    return [];
  }

  if (!tracks || tracks.length === 0) {
    return [];
  }

  // Get unique user IDs and park codes
  const userIds = [...new Set(tracks.map((t) => t.user_id))];
  const parkCodes = [...new Set(tracks.map((t) => t.park_code).filter(Boolean))];
  const trackIds = tracks.map((t) => t.id);

  // Fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, username')
    .in('id', userIds);

  // Fetch parks
  const { data: parks } = await supabase
    .from('all_parks')
    .select('id, park_code, full_name')
    .in('park_code', parkCodes);

  // Fetch likes and comments counts
  const { data: likeCounts } = await supabase
    .from('track_likes')
    .select('track_id')
    .in('track_id', trackIds);

  const { data: commentCounts } = await supabase
    .from('track_comments')
    .select('track_id')
    .in('track_id', trackIds);

  // Fetch track media
  const { data: trackMedia } = await supabase
    .from('track_media')
    .select('track_id, media_id')
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

  const mediaCountMap = {};
  trackMedia?.forEach((tm) => {
    mediaCountMap[tm.track_id] = (mediaCountMap[tm.track_id] || 0) + 1;
  });

  // Transform tracks to feed items
  return tracks.map((track) => {
    const profile = profileMap[track.user_id];
    const park = parkMap[track.park_code];

    return {
      item_type: 'track',
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
      media_count: mediaCountMap[track.id] || 0,
      created_at: track.shared_at || track.created_at,
    };
  });
}

/**
 * GET /api/feed
 * Get personalized feed for authenticated user (media from followed users)
 * Or get public feed for unauthenticated users
 */
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type'); // 'following' or 'discover'

    const supabase = createServiceClient();

    // If user is authenticated and wants following feed
    if (user && type !== 'discover') {
      // Get media from followed users using the database function
      const { data: feedMedia, error } = await supabase.rpc('get_user_feed', {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('Error fetching user feed:', error);
        return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
      }

      // Get public URLs for media
      const mediaWithUrls = feedMedia.map((item) => {
        const { data: mediaUrl } = supabase.storage
          .from('user-media')
          .getPublicUrl(item.storage_path);

        const { data: thumbnailUrl } = item.thumbnail_path
          ? supabase.storage.from('media-thumbnails').getPublicUrl(item.thumbnail_path)
          : { data: null };

        return {
          ...item,
          url: mediaUrl?.publicUrl,
          thumbnail_url: thumbnailUrl?.publicUrl,
        };
      });

      // Check which media the user has liked
      const mediaIds = feedMedia.map((m) => m.media_id);
      const { data: userLikes } = await supabase
        .from('media_likes')
        .select('media_id')
        .eq('user_id', user.id)
        .in('media_id', mediaIds);

      const likedMediaIds = new Set(userLikes?.map((l) => l.media_id) || []);

      const mediaWithLikeStatus = mediaWithUrls.map((item) => ({
        ...item,
        user_has_liked: likedMediaIds.has(item.media_id),
      }));

      return NextResponse.json({
        media: mediaWithLikeStatus,
        feed_type: 'following',
      });
    }

    // Public/discover feed - show recent media AND tracks from all users
    // Fetch media and tracks in parallel
    const [mediaResult, tracks] = await Promise.all([
      supabase
        .from('user_media')
        .select('*')
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .range(offset, offset + Math.ceil(limit / 2) - 1),
      fetchPublicTracks(supabase, Math.ceil(limit / 2), offset),
    ]);

    const { data: media, error } = mediaResult;

    if (error) {
      console.error('Error fetching discover feed:', error);
      return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
    }

    // Process media items
    let mediaItems = [];
    if (media && media.length > 0) {
      // Get unique user IDs and park codes
      const userIds = [...new Set(media.map((m) => m.user_id))];
      const parkCodes = [...new Set(media.map((m) => m.park_code).filter(Boolean))];
      const mediaIds = media.map((m) => m.id);

      // Fetch profiles separately (include username for profile links)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username')
        .in('id', userIds);

      // Fetch parks separately (from all_parks view to support all park types)
      const { data: parks } = await supabase
        .from('all_parks')
        .select('id, park_code, full_name')
        .in('park_code', parkCodes);

      // Fetch likes and comments counts
      const { data: likeCounts } = await supabase
        .from('media_likes')
        .select('media_id')
        .in('media_id', mediaIds);

      const { data: commentCounts } = await supabase
        .from('media_comments')
        .select('media_id')
        .in('media_id', mediaIds);

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
        likeCountMap[like.media_id] = (likeCountMap[like.media_id] || 0) + 1;
      });

      const commentCountMap = {};
      commentCounts?.forEach((comment) => {
        commentCountMap[comment.media_id] = (commentCountMap[comment.media_id] || 0) + 1;
      });

      // Get public URLs and add counts
      mediaItems = media.map((item) => {
        const { data: mediaUrl } = supabase.storage
          .from('user-media')
          .getPublicUrl(item.storage_path);

        const { data: thumbnailUrl } = item.thumbnail_path
          ? supabase.storage.from('media-thumbnails').getPublicUrl(item.thumbnail_path)
          : { data: null };

        const profile = profileMap[item.user_id];
        const park = parkMap[item.park_code];

        return {
          item_type: 'media',
          media_id: item.id,
          user_id: item.user_id,
          user_username: profile?.username,
          park_code: item.park_code,
          media_type: item.media_type,
          storage_path: item.storage_path,
          thumbnail_path: item.thumbnail_path,
          title: item.title,
          description: item.description,
          width: item.width,
          height: item.height,
          duration: item.duration,
          created_at: item.created_at,
          likes_count: likeCountMap[item.id] || 0,
          comments_count: commentCountMap[item.id] || 0,
          user_display_name: profile?.display_name,
          user_avatar_url: profile?.avatar_url,
          park_name: park?.full_name,
          url: mediaUrl?.publicUrl,
          thumbnail_url: thumbnailUrl?.publicUrl,
        };
      });

      // Check which media the user has liked (if authenticated)
      if (user) {
        const { data: userLikes } = await supabase
          .from('media_likes')
          .select('media_id')
          .eq('user_id', user.id)
          .in('media_id', mediaIds);

        const likedMediaIds = new Set(userLikes?.map((l) => l.media_id) || []);

        mediaItems = mediaItems.map((item) => ({
          ...item,
          user_has_liked: likedMediaIds.has(item.media_id),
        }));
      } else {
        mediaItems = mediaItems.map((item) => ({ ...item, user_has_liked: false }));
      }
    }

    // Check which tracks the user has liked (if authenticated)
    let trackItems = tracks;
    if (user && tracks.length > 0) {
      const trackIds = tracks.map((t) => t.track_id);
      const { data: userTrackLikes } = await supabase
        .from('track_likes')
        .select('track_id')
        .eq('user_id', user.id)
        .in('track_id', trackIds);

      const likedTrackIds = new Set(userTrackLikes?.map((l) => l.track_id) || []);

      trackItems = tracks.map((item) => ({
        ...item,
        user_has_liked: likedTrackIds.has(item.track_id),
      }));
    } else {
      trackItems = tracks.map((item) => ({ ...item, user_has_liked: false }));
    }

    // Merge and sort by created_at
    const allItems = [...mediaItems, ...trackItems].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    // Limit to requested amount
    const limitedItems = allItems.slice(0, limit);

    return NextResponse.json({
      items: limitedItems,
      // Keep backward compatibility - media array contains only media items
      media: limitedItems.filter((item) => item.item_type === 'media' || !item.item_type),
      tracks: limitedItems.filter((item) => item.item_type === 'track'),
      feed_type: 'discover',
    });
  } catch (error) {
    console.error('Error in GET /api/feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}