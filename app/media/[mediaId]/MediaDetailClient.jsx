'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toggleMediaLike, deleteMedia } from '@/lib/media/media-client';
import MediaComments from '@/components/media/MediaComments';

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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

/**
 * Media Detail Client Component
 */
export default function MediaDetailClient({ media }) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(media.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOwner = user?.id === media.user_id;
  const isVideo = media.media_type === 'video';

  // Check if user has liked this media
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!accessToken) return;

      try {
        const response = await fetch(`/api/media/${media.id}/likes`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await response.json();
        setIsLiked(data.user_has_liked);
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    checkLikeStatus();
  }, [media.id, accessToken]);

  const handleLikeToggle = async () => {
    if (!accessToken || isLiking) return;

    setIsLiking(true);
    const previousLiked = isLiked;
    const previousCount = likesCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    const result = await toggleMediaLike(accessToken, media.id, isLiked);

    if (result.error) {
      // Revert on error
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
    }

    setIsLiking(false);
  };

  const handleDelete = async () => {
    if (!accessToken || isDeleting) return;

    setIsDeleting(true);
    const { error } = await deleteMedia(accessToken, media.id);

    if (error) {
      alert(`Failed to delete: ${error.message}`);
      setIsDeleting(false);
      return;
    }

    // Redirect to park page (use park_code directly or from nps_parks for backward compatibility)
    // Use park ID for the unified /park/:id URL pattern
    const parkId = media.park_id || media.nps_parks?.id;
    router.push(parkId ? `/park/${parkId}/photos` : '/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Back button */}
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Media */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-lg overflow-hidden">
              {isVideo ? (
                <video
                  src={media.url}
                  poster={media.thumbnail_url}
                  controls
                  className="w-full max-h-[70vh] object-contain"
                  playsInline
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="relative" style={{ paddingBottom: media.height && media.width ? `${(media.height / media.width) * 100}%` : '75%' }}>
                  <Image
                    src={media.url}
                    alt={media.title || 'User photo'}
                    fill
                    className="object-contain"
                    priority
                    sizes="(max-width: 1024px) 100vw, 66vw"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-6">
                {/* Like button */}
                <button
                  onClick={handleLikeToggle}
                  disabled={!user || isLiking}
                  className={`flex items-center gap-2 transition-colors ${
                    isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400 hover:text-red-500'
                  } ${!user ? 'cursor-default' : ''}`}
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

                {/* Comments count */}
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span className="font-medium">{media.comments_count}</span>
                </div>
              </div>

              {/* Owner actions */}
              {isOwner && (
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="mt-6">
              <MediaComments mediaId={media.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm sticky top-6">
              {/* User info */}
              <div className="flex items-center gap-3 mb-4">
                <Link href={`/users/${media.profiles?.username || media.user_id}`}>
                  {media.profiles?.avatar_url ? (
                    <Image
                      src={media.profiles.avatar_url}
                      alt={media.profiles.display_name || 'User'}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                  )}
                </Link>
                <div>
                  <Link
                    href={`/users/${media.profiles?.username || media.user_id}`}
                    className="font-medium text-gray-900 dark:text-white hover:underline"
                  >
                    {media.profiles?.display_name || 'Anonymous'}
                  </Link>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(media.created_at)}
                  </p>
                </div>
              </div>

              {/* Title and description */}
              {media.title && (
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {media.title}
                </h1>
              )}
              {media.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-wrap">
                  {media.description}
                </p>
              )}

              {/* Park link */}
              {(media.park || media.nps_parks) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Taken at</p>
                  <Link
                    href={`/park/${media.park?.id || media.nps_parks?.id}`}
                    className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    {media.park?.full_name || media.nps_parks?.full_name}
                  </Link>
                </div>
              )}

              {/* Media info */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Details</p>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    Type: {isVideo ? 'Video' : 'Photo'}
                  </p>
                  {media.width && media.height && (
                    <p className="text-gray-600 dark:text-gray-400">
                      Size: {media.width} × {media.height}
                    </p>
                  )}
                  {isVideo && media.duration && (
                    <p className="text-gray-600 dark:text-gray-400">
                      Duration: {Math.floor(media.duration / 60)}:{(media.duration % 60).toString().padStart(2, '0')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete this {isVideo ? 'video' : 'photo'}?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This action cannot be undone. All comments and likes will also be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}