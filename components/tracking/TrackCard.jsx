'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { getActivityIcon, getActivityColor } from '@/lib/tracking/activity-detection';
import { formatDistance, formatDuration, formatSpeed, formatElevation } from '@/lib/tracking/track-stats';

/**
 * Track Card Component
 * Displays a track summary with mini map preview
 *
 * @param {Object} props
 * @param {Object} props.track - Track data
 * @param {boolean} [props.showUser] - Whether to show user info
 * @param {boolean} [props.showActions] - Whether to show like/comment actions
 * @param {function} [props.onLike] - Like handler
 * @param {function} [props.onComment] - Comment handler
 * @param {function} [props.onShare] - Share handler
 * @param {string} [props.className] - Additional CSS classes
 */
export default function TrackCard({
  track,
  showUser = true,
  showActions = true,
  onLike,
  onComment,
  onShare,
  className = '',
}) {
  const [isLiked, setIsLiked] = useState(track.user_liked || false);
  const [likesCount, setLikesCount] = useState(track.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  // Format date
  const formattedDate = useMemo(() => {
    const date = new Date(track.shared_at || track.created_at);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, [track.shared_at, track.created_at]);

  // Generate mini map preview from geometry
  const mapPreview = useMemo(() => {
    if (!track.geometry?.coordinates || track.geometry.coordinates.length < 2) {
      return null;
    }

    const coords = track.geometry.coordinates;
    const minLng = Math.min(...coords.map((c) => c[0]));
    const maxLng = Math.max(...coords.map((c) => c[0]));
    const minLat = Math.min(...coords.map((c) => c[1]));
    const maxLat = Math.max(...coords.map((c) => c[1]));

    // Calculate SVG viewBox
    const padding = 0.1;
    const width = maxLng - minLng || 0.001;
    const height = maxLat - minLat || 0.001;

    // Convert coordinates to SVG path
    const pathPoints = coords.map((c) => {
      const x = ((c[0] - minLng) / width) * 100;
      const y = 100 - ((c[1] - minLat) / height) * 100; // Flip Y axis
      return `${x},${y}`;
    });

    return {
      viewBox: `${-padding * 100} ${-padding * 100} ${100 + padding * 200} ${100 + padding * 200}`,
      path: `M ${pathPoints.join(' L ')}`,
      startPoint: pathPoints[0],
      endPoint: pathPoints[pathPoints.length - 1],
    };
  }, [track.geometry]);

  // Handle like
  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLiking) return;

    setIsLiking(true);
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount((prev) => (newIsLiked ? prev + 1 : prev - 1));

    try {
      if (onLike) {
        await onLike(track.id, newIsLiked);
      }
    } catch (error) {
      // Revert on error
      setIsLiked(!newIsLiked);
      setLikesCount((prev) => (newIsLiked ? prev - 1 : prev + 1));
    } finally {
      setIsLiking(false);
    }
  };

  // Handle comment click
  const handleComment = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onComment) {
      onComment(track.id);
    }
  };

  // Handle share click
  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (navigator.share) {
      try {
        await navigator.share({
          title: track.title || 'Track',
          text: `Check out this ${track.activity_type} track!`,
          url: `/tracks/${track.id}`,
        });
      } catch (error) {
        // User cancelled or error
      }
    } else if (onShare) {
      onShare(track.id);
    }
  };

  const trackColor = getActivityColor(track.activity_type);

  return (
    <Link href={`/tracks/${track.id}`} className={`block ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        {/* User Header */}
        {showUser && track.user_display_name && (
          <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
            {track.user_avatar_url ? (
              <img
                src={track.user_avatar_url}
                alt={track.user_display_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  {track.user_display_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {track.user_display_name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formattedDate}
                {track.park_name && (
                  <>
                    {' • '}
                    <span className="text-green-600 dark:text-green-400">{track.park_name}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Map Preview */}
        <div className="relative aspect-video bg-gray-100 dark:bg-gray-700">
          {mapPreview ? (
            <svg
              viewBox={mapPreview.viewBox}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Track path */}
              <path
                d={mapPreview.path}
                fill="none"
                stroke={trackColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Start point */}
              <circle
                cx={mapPreview.startPoint.split(',')[0]}
                cy={mapPreview.startPoint.split(',')[1]}
                r="4"
                fill="#22c55e"
              />
              {/* End point */}
              <circle
                cx={mapPreview.endPoint.split(',')[0]}
                cy={mapPreview.endPoint.split(',')[1]}
                r="4"
                fill="#ef4444"
              />
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">{getActivityIcon(track.activity_type)}</span>
            </div>
          )}

          {/* Activity Badge */}
          <div
            className="absolute top-2 left-2 px-2 py-1 rounded-full text-white text-xs font-medium flex items-center gap-1"
            style={{ backgroundColor: trackColor }}
          >
            <span>{getActivityIcon(track.activity_type)}</span>
            <span className="capitalize">{track.activity_type}</span>
          </div>

          {/* Media count badge */}
          {track.media_count > 0 && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded-full text-white text-xs font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {track.media_count}
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="p-4">
          {/* Title */}
          {track.title && (
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1">
              {track.title}
            </h3>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            {/* Distance */}
            {track.distance_meters !== undefined && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span>{formatDistance(track.distance_meters)}</span>
              </div>
            )}

            {/* Duration */}
            {track.duration_seconds !== undefined && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{formatDuration(track.duration_seconds)}</span>
              </div>
            )}

            {/* Elevation */}
            {track.elevation_gain_m !== undefined && track.elevation_gain_m > 0 && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
                <span>{formatElevation(track.elevation_gain_m)}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {track.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {track.description}
            </p>
          )}

          {/* Trail name */}
          {track.trail_name && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              📍 {track.trail_name}
            </p>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4">
            {/* Like Button */}
            <button
              onClick={handleLike}
              disabled={isLiking}
              className={`flex items-center gap-1 text-sm transition-colors ${
                isLiked
                  ? 'text-red-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-red-500'
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
              onClick={handleComment}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span>{track.comments_count || 0}</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-green-500 transition-colors ml-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              <span>Share</span>
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}
