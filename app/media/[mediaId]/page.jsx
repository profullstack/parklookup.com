import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import MediaDetailClient from './MediaDetailClient';

/**
 * Generate metadata for the media page
 */
export async function generateMetadata({ params }) {
  const { mediaId } = await params;
  const supabase = createServiceClient();

  const { data: media } = await supabase
    .from('user_media')
    .select(`
      *,
      profiles:user_id (display_name),
      nps_parks:park_id (full_name, park_code)
    `)
    .eq('id', mediaId)
    .eq('status', 'ready')
    .single();

  if (!media) {
    return {
      title: 'Media Not Found | ParkLookup',
    };
  }

  const title = media.title || `Photo at ${media.nps_parks?.full_name || 'Park'}`;
  const description = media.description || `Shared by ${media.profiles?.display_name || 'a visitor'}`;

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

  // Fetch media with related data
  const { data: media, error } = await supabase
    .from('user_media')
    .select(`
      *,
      profiles:user_id (
        id,
        display_name,
        avatar_url,
        bio
      ),
      nps_parks:park_id (
        id,
        park_code,
        full_name
      )
    `)
    .eq('id', mediaId)
    .eq('status', 'ready')
    .single();

  if (error || !media) {
    notFound();
  }

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
  };

  return <MediaDetailClient media={mediaWithUrls} />;
}