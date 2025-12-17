'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAnalytics } from '@/hooks/useAnalytics';
import StartTrackingButton from '@/components/tracking/StartTrackingButton';

// Dynamically import the map component to avoid SSR issues
const TrailMap = dynamic(() => import('@/components/trails/TrailMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  ),
});

/**
 * Difficulty badge component
 */
function DifficultyBadge({ difficulty }) {
  const colors = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    moderate: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    hard: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const labels = {
    easy: 'Easy',
    moderate: 'Moderate',
    hard: 'Hard',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[difficulty] || colors.moderate}`}>
      {labels[difficulty] || difficulty}
    </span>
  );
}

/**
 * Trail detail client component
 */
export default function TrailDetailClient({ trail, park, lengthMiles, elevationFeet }) {
  const { trackPageView } = useAnalytics();

  // Track page view
  useEffect(() => {
    trackPageView(`trail/${trail.slug}`);
  }, [trackPageView, trail.slug]);

  // Prepare GeoJSON for the map
  const trailGeoJSON = trail.geojson ? {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        id: trail.id,
        name: trail.name,
        difficulty: trail.difficulty,
        length_meters: trail.length_meters,
        surface: trail.surface,
      },
      geometry: trail.geojson,
    }],
  } : null;

  // Calculate map center from trail geometry or park coordinates
  let mapCenter = [-98.5795, 39.8283]; // Default US center
  let mapZoom = 4;

  if (trail.geojson?.coordinates?.length > 0) {
    const coords = trail.geojson.coordinates;
    const midIndex = Math.floor(coords.length / 2);
    mapCenter = coords[midIndex] || coords[0];
    mapZoom = 13;
  } else if (park.latitude && park.longitude) {
    mapCenter = [parseFloat(park.longitude), parseFloat(park.latitude)];
    mapZoom = 12;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <li>
            <Link href="/parks" className="hover:text-green-600 transition-colors">
              Parks
            </Link>
          </li>
          <li>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li>
            <Link 
              href={`/park/${park.id}`} 
              className="hover:text-green-600 transition-colors"
            >
              {park.full_name || park.name}
            </Link>
          </li>
          <li>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li>
            <Link 
              href={`/park/${park.id}/trails`} 
              className="hover:text-green-600 transition-colors"
            >
              Trails
            </Link>
          </li>
          <li>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li className="text-gray-900 dark:text-white font-medium">
            {trail.name || `Trail ${trail.source_id}`}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {trail.name || `Trail ${trail.source_id}`}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              in{' '}
              <Link 
                href={`/park/${park.id}`}
                className="text-green-600 hover:underline"
              >
                {park.full_name || park.name}
              </Link>
              {park.states && `, ${park.states}`}
            </p>
          </div>
          {trail.difficulty && (
            <DifficultyBadge difficulty={trail.difficulty} />
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {lengthMiles && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Length
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {lengthMiles} mi
              </p>
            </div>
          )}
          {elevationFeet && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Elevation Gain
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {elevationFeet.toLocaleString()} ft
              </p>
            </div>
          )}
          {trail.surface && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Surface
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
                {trail.surface}
              </p>
            </div>
          )}
          {trail.source && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Data Source
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white uppercase">
                {trail.source}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Trail Map */}
      {trailGeoJSON && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Trail Map
          </h2>
          <div className="rounded-lg overflow-hidden shadow-md">
            <TrailMap
              trails={trailGeoJSON}
              center={mapCenter}
              zoom={mapZoom}
              height="400px"
            />
          </div>
        </div>
      )}

      {/* Description */}
      {trail.description && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            About This Trail
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            {trail.description}
          </p>
        </div>
      )}

      {/* Trail Details */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Trail Details
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <dl className="divide-y divide-gray-200 dark:divide-gray-700">
            {trail.difficulty && (
              <div className="px-4 py-3 flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Difficulty</dt>
                <dd className="text-gray-900 dark:text-white font-medium capitalize">
                  {trail.difficulty}
                </dd>
              </div>
            )}
            {lengthMiles && (
              <div className="px-4 py-3 flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Distance</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {lengthMiles} miles ({(trail.length_meters / 1000).toFixed(2)} km)
                </dd>
              </div>
            )}
            {elevationFeet && (
              <div className="px-4 py-3 flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Elevation Gain</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {elevationFeet.toLocaleString()} ft ({trail.elevation_gain_m} m)
                </dd>
              </div>
            )}
            {trail.surface && (
              <div className="px-4 py-3 flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Surface Type</dt>
                <dd className="text-gray-900 dark:text-white font-medium capitalize">
                  {trail.surface}
                </dd>
              </div>
            )}
            <div className="px-4 py-3 flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Data Source</dt>
              <dd className="text-gray-900 dark:text-white font-medium uppercase">
                {trail.source}
              </dd>
            </div>
            {trail.source_id && (
              <div className="px-4 py-3 flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Source ID</dt>
                <dd className="text-gray-900 dark:text-white font-medium font-mono text-sm">
                  {trail.source_id}
                </dd>
              </div>
            )}
            {trail.is_user_submitted && (
              <div className="px-4 py-3 flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Submitted By</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  Community Member
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Start Tracking Button - for pro users */}
        <StartTrackingButton
          trailId={trail.id}
          trailName={trail.name || `Trail ${trail.source_id}`}
          parkCode={park.park_code}
          parkId={park.id}
          parkName={park.full_name || park.name}
          variant="primary"
        />
        
        <Link
          href={`/park/${park.id}/trails`}
          className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          All Trails in {park.name || park.full_name}
        </Link>
        <Link
          href={`/park/${park.id}`}
          className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Park Overview
        </Link>
      </div>

      {/* Data Attribution */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Trail data sourced from{' '}
          {trail.source === 'osm' ? (
            <a 
              href="https://www.openstreetmap.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:underline"
            >
              OpenStreetMap
            </a>
          ) : trail.source === 'usfs' ? (
            <a 
              href="https://www.fs.usda.gov" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:underline"
            >
              US Forest Service
            </a>
          ) : trail.source === 'usgs' ? (
            <a 
              href="https://www.usgs.gov" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:underline"
            >
              US Geological Survey
            </a>
          ) : (
            trail.source
          )}
          . Last updated: {new Date(trail.updated_at).toLocaleDateString()}.
        </p>
      </div>
    </div>
  );
}