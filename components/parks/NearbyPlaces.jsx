'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

/**
 * Category icons and labels
 */
const CATEGORY_CONFIG = {
  dining: {
    label: 'Dining',
    icon: '🍽️',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  entertainment: {
    label: 'Entertainment',
    icon: '🎭',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  bars: {
    label: 'Bars & Nightlife',
    icon: '🍺',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  lodging: {
    label: 'Lodging',
    icon: '🏨',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  shopping: {
    label: 'Shopping',
    icon: '🛍️',
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  },
  attractions: {
    label: 'Attractions',
    icon: '🎡',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

/**
 * Single place card component
 */
function PlaceCard({ place }) {
  const config = CATEGORY_CONFIG[place.category] || CATEGORY_CONFIG.attractions;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Clickable link wrapper for thumbnail and title */}
      <Link href={`/places/${place.data_cid}`}>
        {/* Thumbnail */}
        {place.thumbnail && (
          <div className="relative h-32 bg-gray-200 dark:bg-gray-700">
            <Image
              src={place.thumbnail}
              alt={place.title}
              fill
              className="object-cover"
              unoptimized // External images from Google
            />
          </div>
        )}

        <div className="p-4 pb-2">
          {/* Category badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color} mb-2`}
          >
            {config.icon} {config.label}
          </span>

          {/* Title */}
          <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1 hover:text-green-600 dark:hover:text-green-400 transition-colors">
            {place.title}
          </h4>

          {/* Rating */}
          {place.rating && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-yellow-500">★</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {place.rating}
                {place.reviews_count && (
                  <span className="text-gray-400 dark:text-gray-500">
                    {' '}
                    ({place.reviews_count.toLocaleString()})
                  </span>
                )}
              </span>
              {place.price_level && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  {place.price_level}
                </span>
              )}
            </div>
          )}

          {/* Address */}
          {place.address && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              📍 {place.address}
            </p>
          )}
        </div>
      </Link>

      {/* Actions - outside the link */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <Link
            href={`/places/${place.data_cid}`}
            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            View Details
          </Link>
          {place.phone && (
            <a
              href={`tel:${place.phone}`}
              className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              📞 Call
            </a>
          )}
          {place.latitude && place.longitude && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              🗺️ Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Category section component
 */
function CategorySection({ category, places }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.attractions;

  if (!places || places.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span>{config.icon}</span>
        <span>{config.label}</span>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({places.length})
        </span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {places.map((place) => (
          <PlaceCard key={place.id || place.data_cid} place={place} />
        ))}
      </div>
    </div>
  );
}

/**
 * NearbyPlaces component - displays nearby places for a park
 * @param {Object} props
 * @param {string} props.parkCode - Park code to fetch nearby places for
 */
export default function NearbyPlaces({ parkCode }) {
  const [places, setPlaces] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const fetchPlaces = async () => {
      if (!parkCode) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/parks/${parkCode}/nearby-places`);

        if (!response.ok) {
          if (response.status === 404) {
            setPlaces({ places: [], byCategory: {} });
            return;
          }
          throw new Error('Failed to fetch nearby places');
        }

        const data = await response.json();
        setPlaces(data);
      } catch (err) {
        console.error('Error fetching nearby places:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, [parkCode]);

  // Loading state
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Unable to load nearby places</p>
      </div>
    );
  }

  // No places found
  if (!places || places.total === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No nearby places found for this park yet.</p>
      </div>
    );
  }

  const categories = Object.keys(places.byCategory || {});

  return (
    <div>
      {/* Category filter tabs */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All ({places.total})
          </button>
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const count = places.byCategory[cat]?.length || 0;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {config?.icon} {config?.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Places by category */}
      {activeCategory === 'all' ? (
        categories.map((cat) => (
          <CategorySection key={cat} category={cat} places={places.byCategory[cat]} />
        ))
      ) : (
        <CategorySection category={activeCategory} places={places.byCategory[activeCategory]} />
      )}
    </div>
  );
}

/**
 * Compact version for sidebar or smaller spaces
 */
export function NearbyPlacesCompact({ parkCode, limit = 5 }) {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaces = async () => {
      if (!parkCode) return;

      try {
        const response = await fetch(`/api/parks/${parkCode}/nearby-places?limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          setPlaces(data.places || []);
        }
      } catch (err) {
        console.error('Error fetching nearby places:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, [parkCode, limit]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (places.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {places.map((place) => {
        const config = CATEGORY_CONFIG[place.category];
        return (
          <Link
            key={place.id || place.data_cid}
            href={`/places/${place.data_cid}`}
            className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg">{config?.icon || '📍'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate hover:text-green-600 dark:hover:text-green-400">
                {place.title}
              </p>
              {place.rating && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ★ {place.rating} {place.price_level && `• ${place.price_level}`}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}