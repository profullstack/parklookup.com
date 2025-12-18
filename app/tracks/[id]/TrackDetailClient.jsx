'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { getActivityIcon, getActivityColor } from '@/lib/tracking/activity-detection';

// Dynamically import LiveTrackMap to avoid SSR issues with Leaflet
const LiveTrackMap = dynamic(() => import('@/components/tracking/LiveTrackMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading map...</p>
      </div>
    </div>
  ),
});
import { formatDistance, formatDuration, formatSpeed, formatElevation } from '@/lib/tracking/track-stats';
import {
  likeTrack,
  unlikeTrack,
  shareTrack,
  unshareTrack,
  deleteTrack,
  getTrackComments,
  addTrackComment,
} from '@/lib/tracking/tracking-client';

/**
 * Track Detail Client Component
 * Displays full track details with map, stats, media, and social features
 */
export default function TrackDetailClient({ track, points, media }) {
  const { user, accessToken } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(track.likes_count || 0);
  const [isShared, setIsShared] = useState(track.is_public);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(track.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const isOwner = user?.id === track.user_id;

  // Format dates
  const formattedDate = useMemo(() => {
    const date = new Date(track.created_at);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [track.created_at]);

  const formattedTime = useMemo(() => {
    if (!track.started_at) return null;
    const start = new Date(track.started_at);
    const end = track.ended_at ? new Date(track.ended_at) : null;
    return {
      start: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      end: end?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  }, [track.started_at, track.ended_at]);

  // Handle like
  const handleLike = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount((prev) => (newIsLiked ? prev + 1 : prev - 1));

    try {
      if (newIsLiked) {
        await likeTrack(accessToken, track.id);
      } else {
        await unlikeTrack(accessToken, track.id);
      }
    } catch (error) {
      setIsLiked(!newIsLiked);
      setLikesCount((prev) => (newIsLiked ? prev - 1 : prev + 1));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, track.id, isLiked]);

  // Handle share/unshare
  const handleShare = useCallback(async () => {
    if (!accessToken || !isOwner) return;

    setIsLoading(true);
    try {
      if (isShared) {
        await unshareTrack(accessToken, track.id);
        setIsShared(false);
      } else {
        await shareTrack(accessToken, track.id);
        setIsShared(true);
      }
    } catch (error) {
      console.error('Failed to update share status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, track.id, isOwner, isShared]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!accessToken || !isOwner) return;
    if (!confirm('Are you sure you want to delete this track? This cannot be undone.')) return;

    setIsLoading(true);
    try {
      await deleteTrack(accessToken, track.id);
      window.location.href = '/tracks';
    } catch (error) {
      console.error('Failed to delete track:', error);
      alert('Failed to delete track');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, track.id, isOwner]);

  // Load comments
  const loadComments = useCallback(async () => {
    if (!showComments) {
      setShowComments(true);
      try {
        const result = await getTrackComments(accessToken, track.id);
        if (result.comments) {
          setComments(result.comments);
        }
      } catch (error) {
        console.error('Failed to load comments:', error);
      }
    } else {
      setShowComments(false);
    }
  }, [accessToken, track.id, showComments]);

  // Add comment
  const handleAddComment = useCallback(async () => {
    if (!accessToken || !newComment.trim()) return;

    setIsLoading(true);
    try {
      const result = await addTrackComment(accessToken, track.id, newComment.trim());
      if (result.comment) {
        setComments((prev) => [result.comment, ...prev]);
        setCommentsCount((prev) => prev + 1);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, track.id, newComment]);

  // Native share
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: track.title || 'Track',
          text: `Check out this ${track.activity_type} track!`,
          url: window.location.href,
        });
      } catch (error) {
        // User cancelled
      }
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  }, [track.title, track.activity_type]);

  const trackColor = getActivityColor(track.activity_type);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Map Section - z-0 to ensure header dropdown (z-50) appears above */}
      <div className="h-[50vh] relative z-0">
        <LiveTrackMap
          points={points}
          geometry={track.geometry}
          activityType={track.activity_type}
          stats={track}
          media={media}
          showStats={false}
          isLive={false}
          className="h-full"
        />

        {/* Back Button */}
        <Link
          href="/tracks"
          className="absolute top-4 left-4 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Share Button */}
        <button
          onClick={handleNativeShare}
          className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 py-6 -mt-8 relative z-10">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Activity Badge */}
                <div
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm font-medium mb-3"
                  style={{ backgroundColor: trackColor }}
                >
                  <span>{getActivityIcon(track.activity_type)}</span>
                  <span className="capitalize">{track.activity_type}</span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {track.title || `${track.activity_type} Track`}
                </h1>

                {/* Date and Time */}
                <p className="text-gray-600 dark:text-gray-400">
                  {formattedDate}
                  {formattedTime && (
                    <span className="ml-2">
                      {formattedTime.start}
                      {formattedTime.end && ` - ${formattedTime.end}`}
                    </span>
                  )}
                </p>

                {/* Location */}
                {(track.nps_parks || track.local_parks || track.trails) && (
                  <p className="text-green-600 dark:text-green-400 mt-1">
                    📍{' '}
                    {track.trails?.name ||
                      track.nps_parks?.full_name ||
                      track.local_parks?.name}
                  </p>
                )}
              </div>

              {/* User Avatar */}
              {track.profiles && (
                <Link
                  href={`/users/${track.profiles.username || track.profiles.id}`}
                  className="flex-shrink-0"
                >
                  {track.profiles.avatar_url ? (
                    <img
                      src={track.profiles.avatar_url}
                      alt={track.profiles.display_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-500 dark:text-gray-400 font-medium text-lg">
                        {track.profiles.display_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </Link>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 dark:bg-gray-900/50">
            {/* Distance */}
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {track.distance_meters ? formatDistance(track.distance_meters) : '-'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Distance</p>
            </div>

            {/* Duration */}
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {track.duration_seconds ? formatDuration(track.duration_seconds) : '-'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
            </div>

            {/* Elevation Gain */}
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {track.elevation_gain_m ? formatElevation(track.elevation_gain_m) : '-'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Elevation Gain</p>
            </div>

            {/* Avg Speed */}
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {track.avg_speed_mps ? formatSpeed(track.avg_speed_mps) : '-'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Speed</p>
            </div>
          </div>

          {/* Description */}
          {track.description && (
            <div className="p-6 border-t border-gray-100 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300">{track.description}</p>
            </div>
          )}

          {/* Media Gallery */}
          {media.length > 0 && (
            <div className="p-6 border-t border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Photos & Videos ({media.length})
              </h2>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {media.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedMedia(item)}
                    className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={item.thumbnail_url || item.url}
                      alt={item.title || 'Track media'}
                      className="w-full h-full object-cover"
                    />
                    {item.media_type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/50 rounded-full p-2">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              {/* Like Button */}
              <button
                onClick={handleLike}
                disabled={!user || isLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isLiked
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
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

              {/* Comment Button */}
              <button
                onClick={loadComments}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span>{commentsCount}</span>
              </button>

              {/* Owner Actions */}
              {isOwner && (
                <>
                  {/* Share/Unshare Button */}
                  <button
                    onClick={handleShare}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isShared
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <span>{isShared ? 'Public' : 'Private'}</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors ml-auto"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Comments Section */}
          {showComments && (
            <div className="p-6 border-t border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Comments
              </h2>

              {/* Add Comment */}
              {user && (
                <div className="flex gap-3 mb-6">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isLoading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    Post
                  </button>
                </div>
              )}

              {/* Comments List */}
              {comments.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => {
                    // Support both API formats: camelCase (user) and snake_case (profiles)
                    const userProfile = comment.user || comment.profiles;
                    const displayName = userProfile?.displayName || userProfile?.display_name;
                    const avatarUrl = userProfile?.avatarUrl || userProfile?.avatar_url;
                    const createdAt = comment.createdAt || comment.created_at;
                    
                    return (
                      <div key={comment.id} className="flex gap-3">
                        <div className="flex-shrink-0">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName || 'User'}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                {displayName?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {displayName || 'Anonymous'}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {createdAt ? new Date(createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">{comment.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Lightbox */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <button
            onClick={() => setSelectedMedia(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {selectedMedia.media_type === 'video' ? (
              <video
                src={selectedMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] rounded-lg"
              />
            ) : (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.title || 'Track media'}
                className="max-w-full max-h-[90vh] rounded-lg"
              />
            )}
            {selectedMedia.title && (
              <p className="text-white text-center mt-4">{selectedMedia.title}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
