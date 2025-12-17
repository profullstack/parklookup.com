'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProStatus } from '@/hooks/useProStatus';
import { getTracks, deleteTrack } from '@/lib/tracking/tracking-client';
import TrackCard from '@/components/tracking/TrackCard';
import Link from 'next/link';

/**
 * My Tracks Page
 * Displays user's recorded tracks with filtering and sorting
 */
export default function MyTracksPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const { isPro, loading: proLoading } = useProStatus();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, completed, shared
  const [activityFilter, setActivityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });

  // Fetch tracks
  const fetchTracks = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const options = {
        limit: pagination.limit,
        offset: pagination.offset,
        sortBy,
        sortOrder,
      };

      if (filter !== 'all') {
        options.status = filter;
      }

      if (activityFilter !== 'all') {
        options.activityType = activityFilter;
      }

      const result = await getTracks(accessToken, options);

      if (result.error) {
        setError(result.error.message || 'Failed to load tracks');
      } else {
        setTracks(result.tracks || []);
        if (result.pagination) {
          setPagination((prev) => ({ ...prev, total: result.pagination.total }));
        }
      }
    } catch (err) {
      setError('Failed to load tracks');
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter, activityFilter, sortBy, sortOrder, pagination.limit, pagination.offset]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // Handle delete track
  const handleDelete = async (trackId) => {
    if (!confirm('Are you sure you want to delete this track?')) return;

    try {
      const result = await deleteTrack(accessToken, trackId);
      if (result.error) {
        alert(result.error.message || 'Failed to delete track');
      } else {
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
      }
    } catch (err) {
      alert('Failed to delete track');
    }
  };

  // Handle pagination
  const handleNextPage = () => {
    setPagination((prev) => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  };

  const handlePrevPage = () => {
    setPagination((prev) => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  // Show loading state while checking auth and pro status
  const isInitialLoading = authLoading || proLoading;

  // Show loading spinner while checking auth/pro status
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not signed in (only check after auth loading is complete)
  if (!user) {
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
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">My Tracks</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Sign in to view and manage your recorded tracks
            </p>
            <Link
              href="/signin"
              className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not pro user
  if (user && !isPro) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Pro Feature
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Track recording is a Pro feature. Upgrade to record your hikes, bike rides, and
              drives with GPS tracking.
            </p>
            <Link
              href="/payments"
              className="inline-flex items-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Tracks</h1>
          <Link
            href="/parks"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Track
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="shared">Shared</option>
                <option value="recording">Recording</option>
              </select>
            </div>

            {/* Activity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Activity
              </label>
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                <option value="walking">Walking</option>
                <option value="hiking">Hiking</option>
                <option value="biking">Biking</option>
                <option value="driving">Driving</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sort By
              </label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="distance_meters-desc">Longest Distance</option>
                <option value="duration_seconds-desc">Longest Duration</option>
                <option value="elevation_gain_m-desc">Most Elevation</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading tracks...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchTracks}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Tracks List */}
        {!loading && !error && (
          <>
            {tracks.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
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
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No tracks yet
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Start recording your first track at a park or trail
                </p>
                <Link
                  href="/parks"
                  className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Explore Parks
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {tracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    showUser={false}
                    showActions={false}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {pagination.offset + 1} -{' '}
                  {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
                  {pagination.total}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
