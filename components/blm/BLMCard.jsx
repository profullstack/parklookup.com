'use client';

import Link from 'next/link';

/**
 * BLM land color scheme - tan/orange to match BLM branding
 */
const BLM_COLORS = {
  bg: 'bg-amber-50 dark:bg-amber-900/20',
  text: 'text-amber-700 dark:text-amber-400',
  border: 'border-amber-200 dark:border-amber-800',
  accent: 'bg-amber-100 dark:bg-amber-900/30',
};

/**
 * Format area in acres to a human-readable string
 * @param {number} acres - Area in acres
 * @returns {string} Formatted area
 */
const formatArea = (acres) => {
  if (!acres || acres <= 0) return 'Unknown';

  if (acres >= 1000000) {
    return `${(acres / 1000000).toFixed(2)}M acres`;
  }

  if (acres >= 1000) {
    return `${(acres / 1000).toFixed(1)}K acres`;
  }

  return `${Math.round(acres).toLocaleString()} acres`;
};

/**
 * Format distance in meters to miles
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance in miles
 */
const formatDistance = (meters) => {
  if (!meters || meters <= 0) return null;

  const miles = meters / 1609.344;

  if (miles < 0.1) {
    return `${Math.round(meters)} m`;
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
};

/**
 * BLM Land Icon
 */
const BLMLandIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

/**
 * Warning Icon for dispersed camping notice
 */
const WarningIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

/**
 * BLMCard component - displays a BLM land preview card
 *
 * @param {Object} props
 * @param {Object} props.blmLand - BLM land data object
 * @param {boolean} props.compact - Use compact layout
 * @param {boolean} props.showDistance - Show distance from reference point
 * @param {boolean} props.showWarning - Show dispersed camping warning
 */
export default function BLMCard({
  blmLand,
  compact = false,
  showDistance = true,
  showWarning = true,
}) {
  const {
    id,
    unitName,
    unit_name,
    state,
    areaAcres,
    area_acres,
    distanceMeters,
    distance_meters,
    distanceMiles,
  } = blmLand;

  // Normalize field names (API may return camelCase or snake_case)
  const name = unitName || unit_name || 'BLM Land';
  const area = areaAcres || area_acres;
  const distance = distanceMeters || distance_meters;
  const miles = distanceMiles || (distance ? formatDistance(distance) : null);

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${BLM_COLORS.border}`}>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BLM_COLORS.accent} ${BLM_COLORS.text}`}>
            BLM
          </span>
          <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
            {name}
          </span>
          {state && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {state}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {showDistance && miles && <span>{miles}</span>}
          {area && <span>{formatArea(area)}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={`block bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${BLM_COLORS.border}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`${BLM_COLORS.text}`}>
              <BLMLandIcon />
            </span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
              {name}
            </h3>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BLM_COLORS.accent} ${BLM_COLORS.text} ml-2 flex-shrink-0`}>
            BLM Land
          </span>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
          {/* State */}
          {state && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <span>{state}</span>
            </div>
          )}

          {/* Area */}
          {area && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
                />
              </svg>
              <span>{formatArea(area)}</span>
            </div>
          )}

          {/* Distance */}
          {showDistance && miles && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>{miles} away</span>
            </div>
          )}
        </div>

        {/* Warning notice */}
        {showWarning && (
          <div className={`flex items-start gap-2 p-2 rounded ${BLM_COLORS.bg} text-xs ${BLM_COLORS.text}`}>
            <WarningIcon />
            <div>
              <p className="font-medium">No developed facilities</p>
              <p className="opacity-80">Dispersed camping may be allowed. Check local regulations.</p>
            </div>
          </div>
        )}

        {/* External link */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <a
            href="https://www.blm.gov/programs/recreation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            Learn more at BLM.gov
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * BLMCardSkeleton - Loading placeholder for BLMCard
 */
export function BLMCardSkeleton({ compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-amber-200 dark:border-amber-800 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-5 bg-amber-100 dark:bg-amber-900/30 rounded" />
          <div className="w-32 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-amber-200 dark:border-amber-800 animate-pulse">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-amber-100 dark:bg-amber-900/30 rounded" />
            <div className="w-48 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="w-20 h-5 bg-amber-100 dark:bg-amber-900/30 rounded-full" />
        </div>
        <div className="flex gap-4 mt-4">
          <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="mt-3 w-full h-16 bg-amber-50 dark:bg-amber-900/20 rounded" />
      </div>
    </div>
  );
}