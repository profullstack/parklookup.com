'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchBar } from '@/components/parks/SearchBar';
import { ParkCard } from '@/components/parks/ParkCard';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Search content component - uses useSearchParams
 */
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { trackSearch, trackPageView } = useAnalytics();

  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const query = searchParams.get('q') || '';
  const state = searchParams.get('state') || '';
  const limit = 20;

  // Track page view on mount
  useEffect(() => {
    trackPageView('search');
  }, [trackPageView]);

  // Fetch parks based on search parameters
  const fetchParks = useCallback(
    async (pageNum = 1, append = false) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (state) params.set('state', state);
        params.set('limit', limit.toString());
        params.set('offset', ((pageNum - 1) * limit).toString());

        const response = await fetch(`/api/parks/search?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch parks');
        }

        const data = await response.json();

        if (append) {
          setParks((prev) => [...prev, ...data.parks]);
        } else {
          setParks(data.parks);
        }

        setTotalCount(data.total);
        setHasMore(data.parks.length === limit);
        setPage(pageNum);

        // Track search analytics
        if (query || state) {
          trackSearch(query || state, data.total);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [query, state, trackSearch]
  );

  // Fetch parks when search params change
  useEffect(() => {
    fetchParks(1, false);
  }, [fetchParks]);

  // Handle search submission
  const handleSearch = (searchQuery, searchState) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (searchState) params.set('state', searchState);
    router.push(`/search?${params.toString()}`);
  };

  // Load more parks
  const loadMore = () => {
    if (!loading && hasMore) {
      fetchParks(page + 1, true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Search Header */}
      <div className="bg-green-700 dark:bg-green-800 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Search National Parks
          </h1>
          <SearchBar
            initialQuery={query}
            initialState={state}
            onSearch={handleSearch}
          />
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Results Count */}
        {!loading && parks.length > 0 && (
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Found {totalCount} park{totalCount !== 1 ? 's' : ''}
            {query && ` matching "${query}"`}
            {state && ` in ${state}`}
          </p>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => fetchParks(1, false)}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && parks.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                <div className="p-4">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && parks.length === 0 && !error && (
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No parks found
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}

        {/* Parks Grid */}
        {parks.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parks.map((park) => (
                <ParkCard key={park.id || park.park_code} park={park} />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
                >
                  {loading ? 'Loading...' : 'Load More Parks'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Search page for finding national parks
 * Supports query parameters for search term and state filter
 */
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="bg-green-700 dark:bg-green-800 py-8 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="h-8 bg-green-600 rounded w-48 mb-4 animate-pulse" />
              <div className="h-12 bg-green-600 rounded animate-pulse" />
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden animate-pulse"
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
      }
    >
      <SearchContent />
    </Suspense>
  );
}