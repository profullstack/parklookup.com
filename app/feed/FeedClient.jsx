'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getFeed, toggleMediaLike } from '@/lib/media/media-client';

/**
 * Format relative time
 */
const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMins > 0) {
    return `${diffMins}m ago`;
  } else {
    return 'Just now';
  }
};

/**
 * Feed Item Component
 */
function FeedItem({ item, onLikeToggle, currentUserId }) {
  const [isLiked, setIsLiked] = useState(item.user_has_liked || false);
  const [likesCount, setLikesCount] = useState(item.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  const isVideo = item.media_type === 'video';
  const mediaId = item.media_id || item.id;

  const handleLikeClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId || isLiking) return;

    setIsLiking(true);
    const previousLiked = isLiked;
    const previousCount = likesCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    const result = await onLikeToggle(mediaId, isLiked);

    if (result.error) {
      // Revert on error
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
    }

    setIsLiking(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Link href={`/users/${item.user_id}`}>
          {item.user_avatar_url ? (
            <Image
              src={item.user_avatar_url}
              alt={item.user_display_name || 'User'}
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/users/${item.user_id}`}
            className="font-medium text-gray-900 dark:text-white hover:underline"
          >
            {item.user_display_name || 'Anonymous'}
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{formatRelativeTime(item.created_at)}</span>
            {item.park_name && (
              <>
                <span>•</span>
                <Link
                  href={`/parks/${item.park_code}`}
                  className="hover:text-green-600 truncate"
                >
                  {item.park_name}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Media */}
      <Link href={`/media/${mediaId}`} className="block">
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
          {/* For videos, use thumbnail_url; for photos, use url */}
          {(isVideo ? item.thumbnail_url : item.url) ? (
            <Image
              src={isVideo ? item.thumbnail_url : item.url}
              alt={item.title || 'User photo'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Video indicator */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 rounded-full p-3">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          {/* Duration for videos */}
          {isVideo && item.duration && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
              {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </Link>

      {/* Actions */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-2">
          {/* Like button */}
          <button
            onClick={handleLikeClick}
            disabled={!currentUserId || isLiking}
            className={`flex items-center gap-1 transition-colors ${
              isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400 hover:text-red-500'
            } ${!currentUserId ? 'cursor-default' : ''}`}
          >
            <svg
              className="w-6 h-6"
              fill={isLiked ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <span className="font-medium">{likesCount}</span>
          </button>

          {/* Comments */}
          <Link
            href={`/media/${mediaId}`}
            className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-green-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="font-medium">{item.comments_count || 0}</span>
          </Link>
        </div>

        {/* Title/Description */}
        {(item.title || item.description) && (
          <div className="text-sm">
            {item.title && (
              <span className="font-medium text-gray-900 dark:text-white mr-2">
                {item.title}
              </span>
            )}
            {item.description && (
              <span className="text-gray-600 dark:text-gray-400 line-clamp-2">
                {item.description}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Feed Client Component
 */
export default function FeedClient() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [feedType, setFeedType] = useState('following');
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  useEffect(() => {
    if (!authLoading) {
      loadFeed();
    }
  }, [feedType, authLoading, accessToken]);

  const loadFeed = async (loadMore = false) => {
    const currentOffset = loadMore ? offset : 0;
    setLoading(true);
    setError(null);

    const { media: newMedia, feed_type, error: fetchError } = await getFeed(accessToken, {
      type: feedType,
      limit,
      offset: currentOffset,
    });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (loadMore) {
      setMedia((prev) => [...prev, ...newMedia]);
    } else {
      setMedia(newMedia);
    }

    // If user requested following but got discover, they have no follows
    if (feedType === 'following' && feed_type === 'discover' && !loadMore) {
      setFeedType('discover');
    }

    setHasMore(newMedia.length === limit);
    setOffset(currentOffset + newMedia.length);
    setLoading(false);
  };

  const handleLikeToggle = async (mediaId, currentlyLiked) => {
    if (!accessToken) {
      return { error: { message: 'Please sign in to like photos' } };
    }

    return toggleMediaLike(accessToken, mediaId, currentlyLiked);
  };

  const handleLoadMore = () => {
    loadFeed(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Feed</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {user
              ? 'Photos and videos from park visitors'
              : 'Sign in to follow users and see their photos'}
          </p>
        </div>

        {/* Feed Type Tabs */}
        {user && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setFeedType('following')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                feedType === 'following'
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setFeedType('discover')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                feedType === 'discover'
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Discover
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => loadFeed()}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && media.length === 0 && (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden animate-pulse">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
                <div className="aspect-square bg-gray-200 dark:bg-gray-700" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && media.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {feedType === 'following' ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No photos yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Follow other users to see their photos here, or explore the discover feed.
                </p>
                <button
                  onClick={() => setFeedType('discover')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Explore Discover
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No photos to discover
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Be the first to share your park photos!
                </p>
                <Link
                  href="/parks"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Browse Parks
                </Link>
              </>
            )}
          </div>
        )}

        {/* Feed Items */}
        {media.length > 0 && (
          <div className="space-y-6">
            {media.map((item) => (
              <FeedItem
                key={item.media_id || item.id}
                item={item}
                onLikeToggle={handleLikeToggle}
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && media.length > 0 && (
          <div className="text-center mt-8">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="px-6 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}