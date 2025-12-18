import { createServiceClient } from '@/lib/supabase/server';
import TrackDetailClient from './TrackDetailClient';

/**
 * Generate metadata for track detail page
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: track } = await supabase
    .from('user_tracks')
    .select('title, activity_type, distance_meters, duration_seconds')
    .eq('id', id)
    .single();

  if (!track) {
    return {
      title: 'Track Not Found | ParkLookup',
    };
  }

  const title = track.title || `${track.activity_type} Track`;
  const distance = track.distance_meters
    ? `${(track.distance_meters / 1000).toFixed(1)} km`
    : '';
  const duration = track.duration_seconds
    ? `${Math.floor(track.duration_seconds / 60)} min`
    : '';

  return {
    title: `${title} | ParkLookup`,
    description: `${track.activity_type} track${distance ? ` - ${distance}` : ''}${duration ? ` - ${duration}` : ''}`,
  };
}

/**
 * Track Detail Page
 * Server component that fetches track data and renders client component
 */
export default async function TrackDetailPage({ params }) {
  const { id } = await params;
  const supabase = createServiceClient();

  // First, fetch just the track without joins to verify it exists
  const { data: baseTrack, error: baseError } = await supabase
    .from('user_tracks')
    .select('*')
    .eq('id', id)
    .single();

  // If base track doesn't exist, show not found
  if (baseError || !baseTrack) {
    console.error('Track not found:', baseError);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Track Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              This track may have been deleted or you don&apos;t have permission to view it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch related data separately (profiles, parks, trails)
  // This way if any join fails, we still have the base track
  let profiles = null;
  let nps_parks = null;
  let local_parks = null;
  let trails = null;

  // Fetch user profile
  if (baseTrack.user_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username')
      .eq('id', baseTrack.user_id)
      .single();
    profiles = data;
  }

  // Fetch NPS park if referenced
  if (baseTrack.park_id) {
    const { data } = await supabase
      .from('nps_parks')
      .select('id, park_code, full_name')
      .eq('id', baseTrack.park_id)
      .single();
    nps_parks = data;
  }

  // Fetch local park if referenced
  if (baseTrack.local_park_id) {
    const { data } = await supabase
      .from('local_parks')
      .select('id, name, slug')
      .eq('id', baseTrack.local_park_id)
      .single();
    local_parks = data;
  }

  // Fetch trail if referenced
  if (baseTrack.trail_id) {
    const { data } = await supabase
      .from('trails')
      .select('id, name, slug')
      .eq('id', baseTrack.trail_id)
      .single();
    trails = data;
  }

  // Combine base track with related data
  const track = {
    ...baseTrack,
    profiles,
    nps_parks,
    local_parks,
    trails,
  };

  // Fetch track points
  const { data: points } = await supabase
    .from('track_points')
    .select('*')
    .eq('track_id', id)
    .order('sequence_num', { ascending: true });

  // Fetch track media
  const { data: trackMedia } = await supabase
    .from('track_media')
    .select(`
      *,
      user_media (
        id,
        media_type,
        storage_path,
        thumbnail_path,
        title,
        description,
        width,
        height,
        duration,
        status
      )
    `)
    .eq('track_id', id)
    .order('captured_at', { ascending: true });

  // Get media URLs
  const mediaWithUrls = (trackMedia || [])
    .filter((tm) => tm.user_media?.status === 'ready')
    .map((tm) => {
      const { data: mediaUrl } = supabase.storage
        .from('user-media')
        .getPublicUrl(tm.user_media.storage_path);

      const { data: thumbnailUrl } = tm.user_media.thumbnail_path
        ? supabase.storage.from('media-thumbnails').getPublicUrl(tm.user_media.thumbnail_path)
        : { data: null };

      return {
        id: tm.id,
        media_id: tm.media_id,
        latitude: tm.latitude,
        longitude: tm.longitude,
        altitude_m: tm.altitude_m,
        captured_at: tm.captured_at,
        media_type: tm.user_media.media_type,
        title: tm.user_media.title,
        description: tm.user_media.description,
        width: tm.user_media.width,
        height: tm.user_media.height,
        duration: tm.user_media.duration,
        url: mediaUrl?.publicUrl,
        thumbnail_url: thumbnailUrl?.publicUrl,
      };
    });

  // Fetch likes count
  const { count: likesCount } = await supabase
    .from('track_likes')
    .select('*', { count: 'exact', head: true })
    .eq('track_id', id);

  // Fetch comments count
  const { count: commentsCount } = await supabase
    .from('track_comments')
    .select('*', { count: 'exact', head: true })
    .eq('track_id', id);

  return (
    <TrackDetailClient
      track={{
        ...track,
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
      }}
      points={points || []}
      media={mediaWithUrls}
    />
  );
}
