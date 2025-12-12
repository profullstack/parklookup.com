import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import MediaDetailClient from './MediaDetailClient';

/**
 * Generate metadata for the media page
 */
export async function generateMetadata({ params }) {
  const { mediaId } = await params;
  const supabase = createServiceClient();

  // Fetch media without relationship joins (park_id FK was removed)
  const { data: media } = await supabase
    .from('user_media')
    .select('*')
    .eq('id', mediaId)
    .eq('status', 'ready')
    .single();

  if (!media) {
    return {
      title: 'Media Not Found | ParkLookup',
    };
  }

  // Fetch profile separately
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', media.user_id)
    .single();

  // Fetch park separately using park_code
  const { data: park } = media.park_code
    ? await supabase
        .from('all_parks')
        .select('full_name, park_code')
        .eq('park_code', media.park_code)
        .single()
    : { data: null };

  const title = media.title || `Photo at ${park?.full_name || 'Park'}`;
  const description = media.description || `Shared by ${profile?.display_name || 'a visitor'}`;

  return {
    title: `${title} | ParkLookup`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
  };
}

/**
 * Media Detail Page
 * Shows a single photo/video with comments
 */
export default async function MediaDetailPage({ params }) {
  const { mediaId } = await params;
  const supabase = createServiceClient();

  // Fetch media without relationship joins (park_id FK was removed)
  const { data: media, error } = await supabase
    .from('user_media')
    .select('*')
    .eq('id', mediaId)
    .eq('status', 'ready')
    .single();

  if (error || !media) {
    notFound();
  }

  // Fetch profile separately
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .eq('id', media.user_id)
    .single();

  // Fetch park separately using park_code (supports all park types)
  const { data: park } = media.park_code
    ? await supabase
        .from('all_parks')
        .select('id, park_code, full_name')
        .eq('park_code', media.park_code)
        .single()
    : { data: null };

  // Attach profile and park to media object for compatibility
  media.profiles = profile;
  media.park = park;

  // Get public URLs
  const { data: mediaUrl } = supabase.storage
    .from('user-media')
    .getPublicUrl(media.storage_path);

  const { data: thumbnailUrl } = media.thumbnail_path
    ? supabase.storage.from('media-thumbnails').getPublicUrl(media.thumbnail_path)
    : { data: null };

  // Get likes count
  const { count: likesCount } = await supabase
    .from('media_likes')
    .select('*', { count: 'exact', head: true })
    .eq('media_id', mediaId);

  // Get comments count
  const { count: commentsCount } = await supabase
    .from('media_comments')
    .select('*', { count: 'exact', head: true })
    .eq('media_id', mediaId);

  const mediaWithUrls = {
    ...media,
    url: mediaUrl?.publicUrl,
    thumbnail_url: thumbnailUrl?.publicUrl,
    likes_count: likesCount || 0,
    comments_count: commentsCount || 0,
    // Keep backward compatibility with nps_parks reference
    nps_parks: park,
  };

  return <MediaDetailClient media={mediaWithUrls} />;
}