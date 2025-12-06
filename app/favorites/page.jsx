'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ParkCard } from '@/components/parks/ParkCard';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';

/**
 * Favorites page - displays user's saved parks
 * Requires authentication
 */
export default function FavoritesPage() {
  const router = useRouter();
  const { trackPageView } = useAnalytics();
  const { user, session, loading: authLoading, isAuthenticated } = useAuth();

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track page view
  useEffect(() => {
    trackPageView('favorites');
  }, [trackPageView]);

  // Handle authentication redirect
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // Redirect to sign in if not authenticated
    if (!isAuthenticated) {
      router.push('/signin?redirect=/favorites');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch favorites when authenticated
  useEffect(() => {
    const fetchFavorites = async () => {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Don't fetch if not authenticated
      if (!isAuthenticated || !session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        // Fetch favorites with authorization header
        const favoritesRes = await fetch('/api/favorites', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!favoritesRes.ok) {
          throw new Error('Failed to fetch favorites');
        }

        const favoritesData = await favoritesRes.json();
        setFavorites(favoritesData.favorites || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [authLoading, isAuthenticated, session]);

  // Handle removing a favorite
  const handleRemoveFavorite = async (parkId) => {
    try {
      const response = await fetch(`/api/favorites/${parkId}`, {
        method: 'DELETE',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (!response.ok) {
        throw new Error('Failed to remove favorite');
      }

      // Update local state
      setFavorites((prev) => prev.filter((f) => f.park_id !== parkId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-green-700 dark:bg-green-800 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            My Favorite Parks
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
        {/* Empty state */}
        {favorites.length === 0 && (
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
              Start exploring parks and save your favorites!
            </p>
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
          </div>
        )}

        {/* Favorites grid */}
        {favorites.length > 0 && (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You have {favorites.length} favorite park
              {favorites.length !== 1 ? 's' : ''}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((favorite) => (
                <div key={favorite.id} className="relative">
                  <ParkCard park={favorite.park} />
                  <button
                    onClick={() => handleRemoveFavorite(favorite.park_id)}
                    className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                    title="Remove from favorites"
                  >
                    <svg
                      className="w-5 h-5 text-red-500 group-hover:text-red-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}