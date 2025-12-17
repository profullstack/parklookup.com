'use client';

import Link from 'next/link';

/**
 * Difficulty badge colors
 */
const DIFFICULTY_COLORS = {
  easy: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  moderate: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  hard: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
};

/**
 * Format distance in meters to a human-readable string
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance
 */
const formatDistance = (meters) => {
  if (!meters) return 'Unknown';

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }

  return `${Math.round(km)} km`;
};

/**
 * Format distance in meters to miles
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance in miles
 */
const formatMiles = (meters) => {
  if (!meters) return 'Unknown';

  const miles = meters / 1609.34;
  if (miles < 0.1) {
    return `${Math.round(meters * 3.281)} ft`;
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
};

/**
 * Format elevation gain
 * @param {number} meters - Elevation in meters
 * @returns {string} Formatted elevation
 */
const formatElevation = (meters) => {
  if (!meters) return null;

  const feet = Math.round(meters * 3.281);
  return `${feet.toLocaleString()} ft`;
};

/**
 * Trail type icons
 */
const TrailTypeIcon = ({ type }) => {
  switch (type) {
    case 'loop':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      );
    case 'out-and-back':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      );
  }
};

/**
 * TrailCard component - displays a trail preview card
 *
 * @param {Object} props
 * @param {Object} props.trail - Trail data object
 * @param {string} props.parkId - Park ID for building URLs (preferred)
 * @param {string} props.parkCode - Park code (fallback, deprecated)
 * @param {boolean} props.compact - Use compact layout
 * @param {boolean} props.showPark - Show park name
 */
export default function TrailCard({ trail, parkId, parkCode, compact = false, showPark = false }) {
  const {
    id,
    name,
    slug,
    difficulty,
    length_meters,
    elevation_gain_m,
    surface,
    trail_type,
    park_name,
    park_code,
    park_id,
  } = trail;

  const colors = DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS.easy;
  
  // Use park ID for URL (preferred), fall back to park_id from trail, then parkCode
  const effectiveParkId = parkId || park_id;
  const trailUrl = effectiveParkId
    ? `/park/${effectiveParkId}/trails/${id}`
    : `/trails/${id}`;

  if (compact) {
    return (
      <Link
        href={trailUrl}
        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {difficulty || 'Easy'}
          </span>
          <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
            {name || 'Unnamed Trail'}
          </span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatMiles(length_meters)}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={trailUrl}
      className={`block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border ${colors.border}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
            {name || 'Unnamed Trail'}
          </h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ml-2 flex-shrink-0`}
          >
            {difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : 'Easy'}
          </span>
        </div>

        {/* Park name if showing */}
        {showPark && (park_name || park_code) && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            📍 {park_name || park_code}
          </p>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
          {/* Distance */}
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <span>{formatMiles(length_meters)}</span>
          </div>

          {/* Elevation */}
          {elevation_gain_m && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              <span>{formatElevation(elevation_gain_m)}</span>
            </div>
          )}

          {/* Trail type */}
          {trail_type && (
            <div className="flex items-center gap-1">
              <TrailTypeIcon type={trail_type} />
              <span className="capitalize">{trail_type.replace(/-/g, ' ')}</span>
            </div>
          )}

          {/* Surface */}
          {surface && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
                />
              </svg>
              <span className="capitalize">{surface}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * TrailCardSkeleton - Loading placeholder for TrailCard
 */
export function TrailCardSkeleton({ compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-32 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="w-12 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="w-3/4 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="flex gap-4 mt-4">
          <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}