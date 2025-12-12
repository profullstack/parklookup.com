'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

/**
 * Park type configuration with icons and colors
 */
const PARK_TYPE_CONFIG = {
  'National Park': {
    icon: '🏞️',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  'National Monument': {
    icon: '🗿',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  'National Historic Site': {
    icon: '🏛️',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  'National Recreation Area': {
    icon: '🎿',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
  'National Seashore': {
    icon: '🏖️',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  },
  'National Memorial': {
    icon: '🎖️',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  'State Park': {
    icon: '🌲',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  default: {
    icon: '🌳',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

/**
 * Get park type configuration
 */
function getParkTypeConfig(designation) {
  if (!designation) {
    return PARK_TYPE_CONFIG.default;
  }

  // Check for exact match first
  if (PARK_TYPE_CONFIG[designation]) {
    return PARK_TYPE_CONFIG[designation];
  }

  // Check for partial matches
  const lowerDesignation = designation.toLowerCase();
  if (lowerDesignation.includes('national park')) {
    return PARK_TYPE_CONFIG['National Park'];
  }
  if (lowerDesignation.includes('monument')) {
    return PARK_TYPE_CONFIG['National Monument'];
  }
  if (lowerDesignation.includes('historic')) {
    return PARK_TYPE_CONFIG['National Historic Site'];
  }
  if (lowerDesignation.includes('recreation')) {
    return PARK_TYPE_CONFIG['National Recreation Area'];
  }
  if (lowerDesignation.includes('seashore') || lowerDesignation.includes('lakeshore')) {
    return PARK_TYPE_CONFIG['National Seashore'];
  }
  if (lowerDesignation.includes('memorial')) {
    return PARK_TYPE_CONFIG['National Memorial'];
  }
  if (lowerDesignation.includes('state')) {
    return PARK_TYPE_CONFIG['State Park'];
  }

  return PARK_TYPE_CONFIG.default;
}

/**
 * Format distance for display
 */
function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${Math.round(distanceKm)} km`;
}

/**
 * Single park card component
 */
function NearbyParkCard({ park }) {
  const config = getParkTypeConfig(park.designation);
  const imageUrl = park.images?.[0]?.url || park.image_url;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/park/${park.id}`}>
        {/* Thumbnail */}
        <div className="relative h-32 bg-gray-200 dark:bg-gray-700">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={park.full_name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full text-4xl">
              {config.icon}
            </div>
          )}
          {/* Distance badge */}
          {park.distance !== undefined && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatDistance(park.distance)}
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Park type badge */}
          {park.designation && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color} mb-2`}
            >
              {config.icon} {park.designation}
            </span>
          )}

          {/* Title */}
          <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2 hover:text-green-600 dark:hover:text-green-400 transition-colors">
            {park.full_name}
          </h4>

          {/* Location */}
          {park.states && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              📍 {park.states}
            </p>
          )}

          {/* Description preview */}
          {park.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              {park.description}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}

/**
 * NearbyParks component - displays nearby parks for a given park
 * @param {Object} props
 * @param {number} props.latitude - Latitude of the current park
 * @param {number} props.longitude - Longitude of the current park
 * @param {string} props.currentParkCode - Park code of the current park (to exclude from results)
 * @param {number} [props.radius=100] - Search radius in kilometers
 * @param {number} [props.limit=6] - Maximum number of parks to display
 */
export default function NearbyParks({
  latitude,
  longitude,
  currentParkCode,
  radius = 100,
  limit = 6,
}) {
  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNearbyParks = async () => {
      if (!latitude || !longitude) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `/api/parks/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}&limit=${limit + 1}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch nearby parks');
        }

        const data = await response.json();

        // Filter out the current park and limit results
        const filteredParks = (data.parks || [])
          .filter((park) => park.park_code !== currentParkCode)
          .slice(0, limit);

        setParks(filteredParks);
      } catch (err) {
        console.error('Error fetching nearby parks:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyParks();
  }, [latitude, longitude, currentParkCode, radius, limit]);

  // Loading state
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Unable to load nearby parks</p>
      </div>
    );
  }

  // No coordinates available
  if (!latitude || !longitude) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Location coordinates not available for this park</p>
      </div>
    );
  }

  // No parks found
  if (parks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No nearby parks found within {radius} km</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {parks.map((park) => (
          <NearbyParkCard key={park.id || park.park_code} park={park} />
        ))}
      </div>
    </div>
  );
}

/**
 * Compact version for sidebar or smaller spaces
 */
export function NearbyParksCompact({
  latitude,
  longitude,
  currentParkCode,
  radius = 100,
  limit = 5,
}) {
  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNearbyParks = async () => {
      if (!latitude || !longitude) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/parks/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}&limit=${limit + 1}`
        );

        if (response.ok) {
          const data = await response.json();
          const filteredParks = (data.parks || [])
            .filter((park) => park.park_code !== currentParkCode)
            .slice(0, limit);
          setParks(filteredParks);
        }
      } catch (err) {
        console.error('Error fetching nearby parks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyParks();
  }, [latitude, longitude, currentParkCode, radius, limit]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (parks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {parks.map((park) => {
        const config = getParkTypeConfig(park.designation);
        return (
          <Link
            key={park.id || park.park_code}
            href={`/park/${park.id}`}
            className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg">{config.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate hover:text-green-600 dark:hover:text-green-400">
                {park.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {park.states}
                {park.distance !== undefined && ` • ${formatDistance(park.distance)}`}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}