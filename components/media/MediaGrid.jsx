'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getParkMedia, toggleMediaLike } from '@/lib/media/media-client';

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
 * Single Media Card Component
 */
function MediaCard({ media, onLikeToggle, currentUserId }) {
  const [isLiked, setIsLiked] = useState(media.user_has_liked || false);
  const [likesCount, setLikesCount] = useState(media.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);

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
    
    const result = await onLikeToggle(media.id || media.media_id, isLiked);
    
    if (result.error) {
      // Revert on error
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
    }
    
    setIsLiking(false);
  };

  const mediaId = media.id || media.media_id;
  const imageUrl = media.url || media.thumbnail_url;
  const isVideo = media.media_type === 'video';

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Media */}
      <Link href={`/media/${mediaId}`} className="block">
        <div className="relative aspect-square">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={media.title || 'User photo'}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          {/* Video indicator */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 rounded-full p-2">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
          
          {/* Duration for videos */}
          {isVideo && media.duration && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
              {Math.floor(media.duration / 60)}:{(media.duration % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-3">
        {/* User info */}
        <div className="flex items-center gap-2 mb-2">
          {media.profiles?.avatar_url || media.user_avatar_url ? (
            <Image
              src={media.profiles?.avatar_url || media.user_avatar_url}
              alt={media.profiles?.display_name || media.user_display_name || 'User'}
              width={24}
              height={24}
              className="rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
          <Link 
            href={`/users/${media.user_id}`}
            className="text-sm font-medium text-gray-900 dark:text-white hover:underline truncate"
          >
            {media.profiles?.display_name || media.user_display_name || 'Anonymous'}
          </Link>
        </div>

        {/* Title */}
        {media.title && (
          <p className="text-sm text-gray-700 dark:text-gray-300 truncate mb-2">
            {media.title}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            {/* Like button */}
            <button
              onClick={handleLikeClick}
              disabled={!currentUserId || isLiking}
              className={`flex items-center gap-1 transition-colors ${
                isLiked ? 'text-red-500' : 'hover:text-red-500'
              } ${!currentUserId ? 'cursor-default' : ''}`}
            >
              <svg
                className="w-5 h-5"
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
              <span>{likesCount}</span>
            </button>

            {/* Comments */}
            <Link href={`/media/${mediaId}`} className="flex items-center gap-1 hover:text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span>{media.comments_count || 0}</span>
            </Link>
          </div>

          {/* Time */}
          <span className="text-xs">
            {formatRelativeTime(media.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Media Grid Component
 * Displays a grid of user-contributed photos and videos for a park
 */
export default function MediaGrid({ parkCode, initialMedia = [], showUploadPrompt = true }) {
  const { user, accessToken } = useAuth();
  const [media, setMedia] = useState(initialMedia);
  const [loading, setLoading] = useState(initialMedia.length === 0);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;

  useEffect(() => {
    if (initialMedia.length === 0) {
      loadMedia();
    }
  }, [parkCode]);

  const loadMedia = async (loadMore = false) => {
    if (!parkCode) return;

    const currentOffset = loadMore ? offset : 0;
    setLoading(true);
    setError(null);

    const { media: newMedia, error: fetchError } = await getParkMedia(parkCode, {
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

    setHasMore(newMedia.length === limit);
    setOffset(currentOffset + newMedia.length);
    setLoading(false);
  };

  const handleLikeToggle = async (mediaId, currentlyLiked) => {
    if (!accessToken) {
      return { error: { message: 'Please sign in to like photos' } };
    }

    const { toggleMediaLike } = await import('@/lib/media/media-client');
    return toggleMediaLike(accessToken, mediaId, currentlyLiked);
  };

  const handleLoadMore = () => {
    loadMedia(true);
  };

  const handleMediaUploaded = (newMedia) => {
    setMedia((prev) => [newMedia, ...prev]);
  };

  if (loading && media.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse">
            <div className="aspect-square" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={() => loadMedia()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No photos yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Be the first to share your experience at this park!
        </p>
        {showUploadPrompt && user && (
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Use the upload form above to share your photos and videos.
          </p>
        )}
        {showUploadPrompt && !user && (
          <a
            href="/signin"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Sign in to share photos
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {media.map((item) => (
          <MediaCard
            key={item.id || item.media_id}
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
    </div>
  );
}

export { MediaCard };