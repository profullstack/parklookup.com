import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import UserProfileClient from './UserProfileClient';

/**
 * Generate metadata for the user profile page
 */
export async function generateMetadata({ params }) {
  const { username } = await params;
  const supabase = createServiceClient();

  // Check if the param is a UUID (user ID) or username
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);

  let profile;
  if (isUUID) {
    const result = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', username)
      .single();
    profile = result.data;
  } else {
    const result = await supabase
      .from('profiles')
      .select('display_name, username')
      .ilike('username', username)
      .single();
    profile = result.data;
  }

  if (!profile) {
    return {
      title: 'User Not Found | ParkLookup',
    };
  }

  return {
    title: `${profile.display_name || profile.username} | ParkLookup`,
    description: `View photos and videos shared by ${profile.display_name || profile.username}`,
  };
}

/**
 * User Profile Page
 * Shows user profile with their photos and follow functionality
 * Supports lookup by username or user ID (UUID) for backward compatibility
 */
export default async function UserProfilePage({ params }) {
  const { username } = await params;
  const supabase = createServiceClient();

  // Check if the param is a UUID (user ID) or username
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);

  let profile;
  let error;

  if (isUUID) {
    // Lookup by user ID
    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', username)
      .single();
    profile = result.data;
    error = result.error;
  } else {
    // Lookup by username (case-insensitive)
    const result = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', username)
      .single();
    profile = result.data;
    error = result.error;
  }

  if (error || !profile) {
    notFound();
  }

  const userId = profile.id;

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

  // Get recent media (without the broken join)
  const { data: recentMedia } = await supabase
    .from('user_media')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(12);

  // Get park info separately if needed
  const parkCodes = [...new Set(recentMedia?.map((m) => m.park_code).filter(Boolean) || [])];
  let parkMap = {};
  
  if (parkCodes.length > 0) {
    const { data: parks } = await supabase
      .from('all_parks')
      .select('park_code, full_name')
      .in('park_code', parkCodes);
    
    parks?.forEach((p) => {
      parkMap[p.park_code] = p;
    });
  }

  // Get public URLs for media and attach profile data
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
      park: parkMap[item.park_code] || null,
      // Attach profile data so MediaCard can display username and display_name
      profiles: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
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