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

    // Public/discover feed - show recent media from all users
    const { data: media, error } = await supabase
      .from('user_media')
      .select('*')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching discover feed:', error);
      return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
    }

    if (!media || media.length === 0) {
      return NextResponse.json({
        media: [],
        feed_type: 'discover',
      });
    }

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
    const mediaWithUrls = media.map((item) => {
      const { data: mediaUrl } = supabase.storage
        .from('user-media')
        .getPublicUrl(item.storage_path);

      const { data: thumbnailUrl } = item.thumbnail_path
        ? supabase.storage.from('media-thumbnails').getPublicUrl(item.thumbnail_path)
        : { data: null };

      const profile = profileMap[item.user_id];
      const park = parkMap[item.park_code];

      return {
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

      const mediaWithLikeStatus = mediaWithUrls.map((item) => ({
        ...item,
        user_has_liked: likedMediaIds.has(item.media_id),
      }));

      return NextResponse.json({
        media: mediaWithLikeStatus,
        feed_type: 'discover',
      });
    }

    return NextResponse.json({
      media: mediaWithUrls.map((item) => ({ ...item, user_has_liked: false })),
      feed_type: 'discover',
    });
  } catch (error) {
    console.error('Error in GET /api/feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}