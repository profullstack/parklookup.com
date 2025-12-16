'use client';

import { useState, useMemo } from 'react';
import BLMCard, { BLMCardSkeleton } from './BLMCard';

/**
 * US States for filter dropdown
 */
const US_STATES = [
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WY', name: 'Wyoming' },
];

/**
 * Sort options
 */
const SORT_OPTIONS = [
  { value: 'distance', label: 'Distance (nearest)' },
  { value: 'area-desc', label: 'Area (largest)' },
  { value: 'area-asc', label: 'Area (smallest)' },
  { value: 'name', label: 'Name (A-Z)' },
];

/**
 * BLMList component - displays a list of BLM lands with filtering
 *
 * @param {Object} props
 * @param {Array} props.blmLands - Array of BLM land objects
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.showFilters - Show filter controls
 * @param {boolean} props.compact - Use compact card layout
 * @param {boolean} props.showDistance - Show distance on cards
 * @param {string} props.emptyMessage - Message when no results
 */
export default function BLMList({
  blmLands = [],
  loading = false,
  showFilters = true,
  compact = false,
  showDistance = true,
  emptyMessage = 'No BLM lands found',
}) {
  const [stateFilter, setStateFilter] = useState('');
  const [sortBy, setSortBy] = useState('distance');

  // Filter and sort BLM lands
  const filteredAndSorted = useMemo(() => {
    let result = [...blmLands];

    // Apply state filter
    if (stateFilter) {
      result = result.filter((b) => {
        const state = b.state || b.state;
        return state === stateFilter;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          const distA = a.distanceMeters || a.distance_meters || Infinity;
          const distB = b.distanceMeters || b.distance_meters || Infinity;
          return distA - distB;
        case 'area-desc':
          const areaA = a.areaAcres || a.area_acres || 0;
          const areaB = b.areaAcres || b.area_acres || 0;
          return areaB - areaA;
        case 'area-asc':
          const areaA2 = a.areaAcres || a.area_acres || 0;
          const areaB2 = b.areaAcres || b.area_acres || 0;
          return areaA2 - areaB2;
        case 'name':
          const nameA = a.unitName || a.unit_name || '';
          const nameB = b.unitName || b.unit_name || '';
          return nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });

    return result;
  }, [blmLands, stateFilter, sortBy]);

  // Get unique states from the data for filter options
  const availableStates = useMemo(() => {
    const states = new Set();
    blmLands.forEach((b) => {
      const state = b.state || b.state;
      if (state) states.add(state);
    });
    return US_STATES.filter((s) => states.has(s.abbr));
  }, [blmLands]);

  if (loading) {
    return (
      <div className="space-y-4">
        {showFilters && (
          <div className="flex gap-4 mb-4">
            <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-40 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        )}
        <div className={compact ? 'space-y-2' : 'grid gap-4 md:grid-cols-2'}>
          {[1, 2, 3].map((i) => (
            <BLMCardSkeleton key={i} compact={compact} />
          ))}
        </div>
      </div>
    );
  }

  if (blmLands.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
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
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-gray-600 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (availableStates.length > 1 || blmLands.length > 3) && (
        <div className="flex flex-wrap gap-4 mb-4">
          {/* State filter */}
          {availableStates.length > 1 && (
            <div>
              <label htmlFor="state-filter" className="sr-only">
                Filter by state
              </label>
              <select
                id="state-filter"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">All States</option>
                {availableStates.map((state) => (
                  <option key={state.abbr} value={state.abbr}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          {blmLands.length > 3 && (
            <div>
              <label htmlFor="sort-by" className="sr-only">
                Sort by
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Results count */}
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            {filteredAndSorted.length} of {blmLands.length} BLM lands
          </div>
        </div>
      )}

      {/* List */}
      {filteredAndSorted.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400">
            No BLM lands match your filters
          </p>
          <button
            onClick={() => {
              setStateFilter('');
              setSortBy('distance');
            }}
            className="mt-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={compact ? 'space-y-2' : 'grid gap-4 md:grid-cols-2'}>
          {filteredAndSorted.map((blmLand) => (
            <BLMCard
              key={blmLand.id}
              blmLand={blmLand}
              compact={compact}
              showDistance={showDistance}
              showWarning={!compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * BLMListSkeleton - Loading placeholder for BLMList
 */
export function BLMListSkeleton({ count = 3, compact = false }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="w-40 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className={compact ? 'space-y-2' : 'grid gap-4 md:grid-cols-2'}>
        {Array.from({ length: count }).map((_, i) => (
          <BLMCardSkeleton key={i} compact={compact} />
        ))}
      </div>
    </div>
  );
}