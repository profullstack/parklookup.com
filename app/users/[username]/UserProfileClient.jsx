'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { toggleFollow, getUserMedia, toggleMediaLike } from '@/lib/media/media-client';
import { MediaCard } from '@/components/media/MediaGrid';

/**
 * User Profile Client Component
 */
export default function UserProfileClient({ profile, initialMedia = [] }) {
  const { user, accessToken } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile.followers_count || 0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [media, setMedia] = useState(initialMedia);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialMedia.length >= 12);
  const [offset, setOffset] = useState(initialMedia.length);

  const isOwnProfile = user?.id === profile.id;

  // Check if current user is following this profile
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!accessToken || isOwnProfile) return;

      try {
        const response = await fetch(`/api/users/${profile.id}/follow`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await response.json();
        setIsFollowing(data.is_following);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };

    checkFollowStatus();
  }, [profile.id, accessToken, isOwnProfile]);

  const handleFollowToggle = async () => {
    if (!accessToken || isFollowLoading || isOwnProfile) return;

    setIsFollowLoading(true);
    const previousFollowing = isFollowing;
    const previousCount = followersCount;

    // Optimistic update
    setIsFollowing(!isFollowing);
    setFollowersCount(isFollowing ? followersCount - 1 : followersCount + 1);

    const result = await toggleFollow(accessToken, profile.id, isFollowing);

    if (result.error) {
      // Revert on error
      setIsFollowing(previousFollowing);
      setFollowersCount(previousCount);
    }

    setIsFollowLoading(false);
  };

  const handleLoadMore = async () => {
    setLoading(true);
    const { media: newMedia, error } = await getUserMedia(profile.id, {
      limit: 12,
      offset,
    });

    if (!error && newMedia) {
      setMedia((prev) => [...prev, ...newMedia]);
      setHasMore(newMedia.length >= 12);
      setOffset((prev) => prev + newMedia.length);
    }

    setLoading(false);
  };

  const handleLikeToggle = async (mediaId, currentlyLiked) => {
    if (!accessToken) {
      return { error: { message: 'Please sign in to like photos' } };
    }

    return toggleMediaLike(accessToken, mediaId, currentlyLiked);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name || 'User'}
                  width={120}
                  height={120}
                  className="rounded-full"
                />
              ) : (
                <div className="w-30 h-30 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {profile.display_name || profile.username}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400">@{profile.username}</p>
                </div>
                {!isOwnProfile && user && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      isFollowing
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50`}
                  >
                    {isFollowLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                {isOwnProfile && (
                  <Link
                    href="/settings"
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Edit Profile
                  </Link>
                )}
              </div>

              {/* Stats */}
              <div className="flex justify-center sm:justify-start gap-6 mb-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {profile.media_count}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {followersCount}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {profile.following_count}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Following</p>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-gray-600 dark:text-gray-400 mb-2">{profile.bio}</p>
              )}

              {/* Location & Website */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-gray-500 dark:text-gray-400">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-green-600 hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <span>{new URL(profile.website).hostname}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Media Grid */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Photos & Videos
          </h2>

          {media.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No photos yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isOwnProfile
                  ? 'Share your first photo from a park!'
                  : 'This user hasn\'t shared any photos yet.'}
              </p>
              {isOwnProfile && (
                <Link
                  href="/parks"
                  className="inline-flex items-center mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Browse Parks
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {media.map((item) => (
                  <MediaCard
                    key={item.id}
                    media={item}
                    onLikeToggle={handleLikeToggle}
                    currentUserId={user?.id}
                  />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}