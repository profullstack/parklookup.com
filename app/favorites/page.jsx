'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ParkCard } from '@/components/parks/ParkCard';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';

/**
 * Format distance for display
 */
const formatDistance = (meters) => {
  if (!meters) return 'N/A';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  const miles = km * 0.621371;
  return `${miles.toFixed(1)} mi`;
};

/**
 * Format duration for display
 */
const formatDuration = (seconds) => {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Track Card Component
 */
function TrackCard({ track }) {
  const activityIcons = {
    walking: '🚶',
    hiking: '🥾',
    biking: '🚴',
    driving: '🚗',
  };

  return (
    <Link
      href={`/tracks/${track.track_id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{activityIcons[track.activity_type] || '📍'}</span>
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {track.title || `${track.activity_type} track`}
          </h3>
        </div>
        
        {track.park_name && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate">
            📍 {track.park_name}
          </p>
        )}
        
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>{formatDistance(track.distance_meters)}</span>
          <span>{formatDuration(track.duration_seconds)}</span>
          {track.elevation_gain_m > 0 && (
            <span>↑ {Math.round(track.elevation_gain_m)}m</span>
          )}
        </div>
        
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {track.likes_count || 0}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {track.comments_count || 0}
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Favorites page - displays user's saved parks and liked tracks
 * Requires authentication
 */
export default function FavoritesPage() {
  const router = useRouter();
  const { trackPageView } = useAnalytics();
  const { user, session, loading: authLoading, isAuthenticated } = useAuth();

  const [favorites, setFavorites] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('parks');

  // Track page view
  useEffect(() => {
    trackPageView('favorites');
  }, [trackPageView]);

  // Handle authentication redirect
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {return;}

    // Redirect to sign in if not authenticated
    if (!isAuthenticated) {
      router.push('/signin?redirect=/favorites');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch favorites and liked tracks when authenticated
  useEffect(() => {
    const fetchData = async () => {
      // Wait for auth to finish loading
      if (authLoading) {return;}

      // Don't fetch if not authenticated
      if (!isAuthenticated || !session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        // Fetch favorites and liked tracks in parallel
        const [favoritesRes, likedTracksRes] = await Promise.all([
          fetch('/api/favorites', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
          fetch('/api/favorites/tracks', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
        ]);

        if (!favoritesRes.ok) {
          throw new Error('Failed to fetch favorites');
        }

        const favoritesData = await favoritesRes.json();
        setFavorites(favoritesData.favorites || []);

        // Liked tracks might not exist yet, so handle gracefully
        if (likedTracksRes.ok) {
          const likedTracksData = await likedTracksRes.json();
          setLikedTracks(likedTracksData.tracks || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, isAuthenticated, session]);

  // Loading state (show while auth is loading or favorites are loading)
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
                >
                  <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                  <div className="p-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto text-red-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const hasAnyFavorites = favorites.length > 0 || likedTracks.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-green-700 dark:bg-green-800 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            My Favorites
          </h1>
          {user && (
            <p className="text-green-100 mt-2">
              Welcome back, {user.email?.split('@')[0]}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        {hasAnyFavorites && (
          <div role="tablist" className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              id="parks-tab"
              role="tab"
              aria-selected={activeTab === 'parks'}
              aria-controls="parks-panel"
              onClick={() => setActiveTab('parks')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'parks'
                  ? 'text-green-600 border-green-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Parks ({favorites.length})
            </button>
            <button
              id="tracks-tab"
              role="tab"
              aria-selected={activeTab === 'tracks'}
              aria-controls="tracks-panel"
              onClick={() => setActiveTab('tracks')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'tracks'
                  ? 'text-green-600 border-green-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Liked Tracks ({likedTracks.length})
            </button>
          </div>
        )}

        {/* Empty state - no favorites at all */}
        {!hasAnyFavorites && (
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
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No favorites yet
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Start exploring parks and save your favorites, or like tracks in the feed!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/search"
                className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Explore Parks
              </Link>
              <Link
                href="/feed"
                className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                Browse Feed
              </Link>
            </div>
          </div>
        )}

        {/* Parks Tab Panel */}
        {activeTab === 'parks' && (
          <div id="parks-panel" role="tabpanel" aria-labelledby="parks-tab">
            {favorites.length > 0 ? (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You have {favorites.length} favorite park
                  {favorites.length !== 1 ? 's' : ''}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favorites.map((favorite) => (
                    <ParkCard key={favorite.id} park={favorite.park} />
                  ))}
                </div>
              </>
            ) : hasAnyFavorites ? (
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
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No favorite parks yet
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Explore parks and click the heart icon to save them here.
                </p>
                <Link
                  href="/search"
                  className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  Explore Parks
                </Link>
              </div>
            ) : null}
          </div>
        )}

        {/* Tracks Tab Panel */}
        {activeTab === 'tracks' && (
          <div id="tracks-panel" role="tabpanel" aria-labelledby="tracks-tab">
            {likedTracks.length > 0 ? (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You have liked {likedTracks.length} track
                  {likedTracks.length !== 1 ? 's' : ''}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {likedTracks.map((track) => (
                    <TrackCard key={track.track_id} track={track} />
                  ))}
                </div>
              </>
            ) : hasAnyFavorites ? (
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
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No liked tracks yet
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Browse the feed and like tracks to save them here.
                </p>
                <Link
                  href="/feed"
                  className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  Browse Feed
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}