import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import UserProfileClient from './UserProfileClient';

/**
 * Generate metadata for the user profile page
 */
export async function generateMetadata({ params }) {
  const { userId } = await params;
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  if (!profile) {
    return {
      title: 'User Not Found | ParkLookup',
    };
  }

  return {
    title: `${profile.display_name || 'User'} | ParkLookup`,
    description: `View photos and videos shared by ${profile.display_name || 'this user'}`,
  };
}

/**
 * User Profile Page
 * Shows user profile with their photos and follow functionality
 */
export default async function UserProfilePage({ params }) {
  const { userId } = await params;
  const supabase = createServiceClient();

  // Fetch user profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    notFound();
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

  // Get recent media
  const { data: recentMedia } = await supabase
    .from('user_media')
    .select(`
      *,
      nps_parks:park_id (
        park_code,
        full_name
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(12);

  // Get public URLs for media
  const mediaWithUrls = recentMedia?.map((item) => {
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
  }) || [];

  const profileData = {
    ...profile,
    followers_count: followersCount || 0,
    following_count: followingCount || 0,
    media_count: mediaCount || 0,
  };

  return <UserProfileClient profile={profileData} initialMedia={mediaWithUrls} />;
}