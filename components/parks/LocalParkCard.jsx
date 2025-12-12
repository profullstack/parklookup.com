'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ParkPlaceholder } from '@/components/ui/ParkPlaceholder';

/**
 * Park type badge colors
 */
const PARK_TYPE_COLORS = {
  county: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  city: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  regional: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  municipal: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

/**
 * Access badge colors
 */
const ACCESS_COLORS = {
  Open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Restricted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

/**
 * Formats park type for display
 */
const formatParkType = (type) => {
  const labels = {
    county: 'County Park',
    city: 'City Park',
    regional: 'Regional Park',
    municipal: 'Municipal Park',
  };
  return labels[type] || type;
};

/**
 * Builds the URL for a local park detail page
 * All parks now use the same simple URL structure: /park/[id]
 */
const buildParkUrl = (park) => {
  return `/park/${park.id}`;
};

/**
 * LocalParkCard Component
 *
 * Displays a card for a local (county/city) park with image, name, type, and location.
 *
 * @param {Object} props
 * @param {Object} props.park - Park data object
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showDistance] - Whether to show distance (if available)
 */
export function LocalParkCard({ park, className = '', showDistance = false }) {
  const parkUrl = buildParkUrl(park);
  const parkTypeColor = PARK_TYPE_COLORS[park.park_type] || PARK_TYPE_COLORS.municipal;
  const accessColor = ACCESS_COLORS[park.access] || ACCESS_COLORS.Unknown;

  // Build location string
  const locationParts = [];
  if (park.city?.name) locationParts.push(park.city.name);
  else if (park.county?.name) locationParts.push(`${park.county.name} County`);
  if (park.state?.name || park.state?.code) {
    locationParts.push(park.state.name || park.state.code);
  }
  const locationString = locationParts.join(', ');

  return (
    <Link
      href={parkUrl}
      className={`group block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden ${className}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-700">
        {park.primary_photo_url ? (
          <Image
            src={park.primary_photo_url}
            alt={park.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <ParkPlaceholder parkType={park.park_type} />
        )}

        {/* Park type badge */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${parkTypeColor}`}>
            {formatParkType(park.park_type)}
          </span>
        </div>

        {/* Distance badge (if available) */}
        {showDistance && park.distance_miles !== undefined && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300">
              {park.distance_miles.toFixed(1)} mi
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Park name */}
        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors line-clamp-2">
          {park.name}
        </h3>

        {/* Location */}
        {locationString && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
            {locationString}
          </p>
        )}

        {/* Managing agency */}
        {park.managing_agency && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
            {park.managing_agency}
          </p>
        )}

        {/* Footer with access badge */}
        <div className="mt-3 flex items-center justify-between">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${accessColor}`}>
            {park.access || 'Unknown'} Access
          </span>

          {/* Arrow icon */}
          <svg
            className="w-4 h-4 text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/**
 * LocalParkCardSkeleton Component
 *
 * Loading skeleton for LocalParkCard
 */
export function LocalParkCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700" />

      {/* Content skeleton */}
      <div className="p-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="mt-2 h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="mt-3 flex items-center justify-between">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * LocalParkGrid Component
 *
 * Grid layout for displaying multiple LocalParkCards
 *
 * @param {Object} props
 * @param {Array} props.parks - Array of park objects
 * @param {boolean} [props.loading] - Whether to show loading skeletons
 * @param {number} [props.skeletonCount] - Number of skeletons to show when loading
 * @param {boolean} [props.showDistance] - Whether to show distance on cards
 */
export function LocalParkGrid({
  parks = [],
  loading = false,
  skeletonCount = 6,
  showDistance = false,
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <LocalParkCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (parks.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
        <p className="mt-4 text-gray-500 dark:text-gray-400">No parks found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {parks.map((park) => (
        <LocalParkCard key={park.id} park={park} showDistance={showDistance} />
      ))}
    </div>
  );
}

export default LocalParkCard;