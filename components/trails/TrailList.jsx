'use client';

import { useState, useEffect, useCallback } from 'react';
import TrailCard, { TrailCardSkeleton } from './TrailCard';

/**
 * TrailList component - displays a filterable list of trails
 *
 * @param {Object} props
 * @param {string} props.parkCode - Park code for fetching trails (deprecated, use parkId)
 * @param {string} props.parkId - Park ID for fetching trails and building URLs
 * @param {string} props.parkSource - Park source (nps, wikidata, local)
 * @param {Array} props.initialTrails - Pre-loaded trails (optional)
 * @param {boolean} props.showFilters - Show filter controls
 * @param {boolean} props.compact - Use compact card layout
 * @param {number} props.limit - Maximum trails to show
 * @param {Array} props.trails - Pre-loaded trails array (alternative to initialTrails)
 */
export default function TrailList({
  parkCode,
  parkId,
  parkSource,
  initialTrails,
  trails: trailsProp,
  showFilters = true,
  compact = false,
  limit = 50,
}) {
  // Support both initialTrails and trails props
  const providedTrails = trailsProp || initialTrails;
  const [trails, setTrails] = useState(providedTrails || []);
  const [loading, setLoading] = useState(!providedTrails);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  // Filter state
  const [difficulty, setDifficulty] = useState('');
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [sortBy, setSortBy] = useState('name');

  /**
   * Fetch trails from API
   */
  const fetchTrails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let url;

      if (parkCode) {
        // Fetch trails for a specific park
        url = `/api/parks/${parkCode}/trails?limit=${limit}`;
      } else if (parkId && parkSource) {
        // Fetch trails by park ID
        url = `/api/trails?parkId=${parkId}&parkSource=${parkSource}&limit=${limit}`;
      } else {
        // Fetch all trails
        url = `/api/trails?limit=${limit}`;
      }

      // Add filters
      if (difficulty) {
        url += `&difficulty=${difficulty}`;
      }
      if (minLength) {
        url += `&minLength=${parseFloat(minLength) * 1609.34}`; // Convert miles to meters
      }
      if (maxLength) {
        url += `&maxLength=${parseFloat(maxLength) * 1609.34}`; // Convert miles to meters
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch trails');
      }

      const data = await response.json();

      // Handle park-specific response format
      if (data.trails) {
        setTrails(data.trails);
        setSummary(data.summary || null);
      } else {
        setTrails(data);
      }
    } catch (err) {
      console.error('Error fetching trails:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [parkCode, parkId, parkSource, limit, difficulty, minLength, maxLength]);

  // Fetch trails on mount and when filters change
  useEffect(() => {
    if (!initialTrails) {
      fetchTrails();
    }
  }, [fetchTrails, initialTrails]);

  // Re-fetch when filters change (if we have initial trails, filter client-side)
  useEffect(() => {
    if (initialTrails) {
      let filtered = [...initialTrails];

      if (difficulty) {
        filtered = filtered.filter((t) => t.difficulty === difficulty);
      }
      if (minLength) {
        const minMeters = parseFloat(minLength) * 1609.34;
        filtered = filtered.filter((t) => t.length_meters >= minMeters);
      }
      if (maxLength) {
        const maxMeters = parseFloat(maxLength) * 1609.34;
        filtered = filtered.filter((t) => t.length_meters <= maxMeters);
      }

      setTrails(filtered);
    }
  }, [initialTrails, difficulty, minLength, maxLength]);

  /**
   * Sort trails
   */
  const sortedTrails = [...trails].sort((a, b) => {
    switch (sortBy) {
      case 'length':
        return (a.length_meters || 0) - (b.length_meters || 0);
      case 'length-desc':
        return (b.length_meters || 0) - (a.length_meters || 0);
      case 'difficulty':
        const diffOrder = { easy: 1, moderate: 2, hard: 3 };
        return (diffOrder[a.difficulty] || 0) - (diffOrder[b.difficulty] || 0);
      case 'name':
      default:
        return (a.name || '').localeCompare(b.name || '');
    }
  });

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setDifficulty('');
    setMinLength('');
    setMaxLength('');
    setSortBy('name');
  };

  const hasActiveFilters = difficulty || minLength || maxLength;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {summary && (
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <span className="font-medium">{summary.total} trails</span>
          {summary.byDifficulty && (
            <>
              <span className="text-green-600 dark:text-green-400">
                {summary.byDifficulty.easy} easy
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                {summary.byDifficulty.moderate} moderate
              </span>
              <span className="text-red-600 dark:text-red-400">
                {summary.byDifficulty.hard} hard
              </span>
            </>
          )}
          {summary.totalLengthMeters > 0 && (
            <span>
              {(summary.totalLengthMeters / 1609.34).toFixed(1)} mi total
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Difficulty filter */}
            <div className="flex-1 min-w-[150px]">
              <label
                htmlFor="difficulty"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Difficulty
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">All difficulties</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Min length filter */}
            <div className="flex-1 min-w-[120px]">
              <label
                htmlFor="minLength"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Min Length (mi)
              </label>
              <input
                type="number"
                id="minLength"
                value={minLength}
                onChange={(e) => setMinLength(e.target.value)}
                placeholder="0"
                min="0"
                step="0.5"
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Max length filter */}
            <div className="flex-1 min-w-[120px]">
              <label
                htmlFor="maxLength"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Max Length (mi)
              </label>
              <input
                type="number"
                id="maxLength"
                value={maxLength}
                onChange={(e) => setMaxLength(e.target.value)}
                placeholder="Any"
                min="0"
                step="0.5"
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Sort */}
            <div className="flex-1 min-w-[150px]">
              <label
                htmlFor="sortBy"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Sort by
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="name">Name</option>
                <option value="length">Length (short first)</option>
                <option value="length-desc">Length (long first)</option>
                <option value="difficulty">Difficulty</option>
              </select>
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-green-600 dark:text-green-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <TrailCardSkeleton key={i} compact={compact} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-8 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchTrails}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sortedTrails.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <svg
            className="w-12 h-12 mx-auto text-gray-400 mb-4"
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
          <p className="text-gray-600 dark:text-gray-400">
            {hasActiveFilters
              ? 'No trails match your filters'
              : 'No trails found for this park'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-green-600 dark:text-green-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Trail list */}
      {!loading && !error && sortedTrails.length > 0 && (
        <div className={compact ? 'space-y-2' : 'grid gap-4 md:grid-cols-2'}>
          {sortedTrails.map((trail) => (
            <TrailCard
              key={trail.id}
              trail={trail}
              parkId={parkId}
              parkCode={parkCode}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}