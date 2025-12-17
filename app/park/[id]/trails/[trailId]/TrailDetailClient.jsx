'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAnalytics } from '@/hooks/useAnalytics';

// Dynamically import the map component to avoid SSR issues
const TrailMap = dynamic(() => import('@/components/trails/TrailMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  ),
});

/**
 * Difficulty badge colors
 */
const DIFFICULTY_COLORS = {
  easy: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
  },
  moderate: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  hard: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
  },
};

/**
 * Format distance in meters to miles
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
 */
const formatElevation = (meters) => {
  if (!meters) return null;
  const feet = Math.round(meters * 3.281);
  return `${feet.toLocaleString()} ft`;
};

/**
 * Trail type display names
 */
const TRAIL_TYPE_NAMES = {
  loop: 'Loop',
  'out-and-back': 'Out & Back',
  'point-to-point': 'Point to Point',
};

/**
 * Surface type display names
 */
const SURFACE_NAMES = {
  paved: 'Paved',
  gravel: 'Gravel',
  dirt: 'Dirt/Natural',
  rock: 'Rocky',
  mixed: 'Mixed Surface',
};

/**
 * TrailDetailClient - Client component for trail detail page
 */
export default function TrailDetailClient({ trail, park, hasCoordinates }) {
  const { trackPageView } = useAnalytics();

  // Track page view
  useEffect(() => {
    trackPageView(`trail/${trail.id}`);
  }, [trackPageView, trail.id]);

  const colors = DIFFICULTY_COLORS[trail.difficulty] || DIFFICULTY_COLORS.easy;

  // Parse geometry for the map
  let trailGeometry = null;
  if (trail.geometry) {
    try {
      trailGeometry = typeof trail.geometry === 'string' 
        ? JSON.parse(trail.geometry) 
        : trail.geometry;
    } catch (e) {
      console.warn('Failed to parse trail geometry:', e);
    }
  }

  // Prepare trail for map component
  const trailForMap = trailGeometry ? [{
    ...trail,
    geojson: trailGeometry,
  }] : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Difficulty */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Difficulty
          </p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
            {trail.difficulty ? trail.difficulty.charAt(0).toUpperCase() + trail.difficulty.slice(1) : 'Easy'}
          </span>
        </div>

        {/* Length */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Length
          </p>
          <p className="text-gray-900 dark:text-white font-medium">
            {formatMiles(trail.length_meters)}
          </p>
        </div>

        {/* Elevation Gain */}
        {trail.elevation_gain_m && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Elevation Gain
            </p>
            <p className="text-gray-900 dark:text-white font-medium">
              {formatElevation(trail.elevation_gain_m)}
            </p>
          </div>
        )}

        {/* Trail Type */}
        {trail.trail_type && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Type
            </p>
            <p className="text-gray-900 dark:text-white font-medium">
              {TRAIL_TYPE_NAMES[trail.trail_type] || trail.trail_type}
            </p>
          </div>
        )}
      </div>

      {/* Trail Map */}
      {trailForMap.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Trail Map
          </h2>
          <div className="rounded-lg overflow-hidden shadow-md h-[400px]">
            <TrailMap
              trails={trailForMap}
              center={hasCoordinates ? { lat: parseFloat(park.latitude), lng: parseFloat(park.longitude) } : null}
              zoom={14}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* Description */}
      {trail.description && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            About This Trail
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            {trail.description}
          </p>
        </div>
      )}

      {/* Trail Details */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
          Trail Details
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm divide-y divide-gray-200 dark:divide-gray-700">
          {/* Surface */}
          {trail.surface && (
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-600 dark:text-gray-400">Surface</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {SURFACE_NAMES[trail.surface] || trail.surface}
              </span>
            </div>
          )}

          {/* SAC Scale */}
          {trail.sac_scale && (
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-600 dark:text-gray-400">SAC Hiking Scale</span>
              <span className="text-gray-900 dark:text-white font-medium capitalize">
                {trail.sac_scale.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Trail Visibility */}
          {trail.trail_visibility && (
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-600 dark:text-gray-400">Trail Visibility</span>
              <span className="text-gray-900 dark:text-white font-medium capitalize">
                {trail.trail_visibility.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Data Source */}
          <div className="flex justify-between items-center p-4">
            <span className="text-gray-600 dark:text-gray-400">Data Source</span>
            <span className="text-gray-900 dark:text-white font-medium uppercase">
              {trail.source || 'OSM'}
            </span>
          </div>
        </div>
      </div>

      {/* Park Link */}
      {park && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Park Information
          </h2>
          <Link
            href={`/park/${park.id}`}
            className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {park.full_name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {park.designation || 'Park'} • {park.states}
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      )}

      {/* OSM Attribution */}
      {trail.source === 'osm' && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          Trail data from{' '}
          <a
            href="https://www.openstreetmap.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:underline"
          >
            OpenStreetMap
          </a>
          {trail.source_id && (
            <>
              {' • '}
              <a
                href={`https://www.openstreetmap.org/${trail.source_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:underline"
              >
                View on OSM
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
