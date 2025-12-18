'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import BLMList from './BLMList';
import StartTrackingButton from '@/components/tracking/StartTrackingButton';

// Dynamically import the map component to avoid SSR issues
const BLMMap = dynamic(() => import('./BLMMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  ),
});

/**
 * ParkBLMSection component
 * Displays BLM lands near a park with map and list
 *
 * @param {Object} props
 * @param {Object} props.park - Park data object
 * @param {boolean} props.hasCoordinates - Whether park has coordinates
 */
export default function ParkBLMSection({ park, hasCoordinates }) {
  const [blmLands, setBLMLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBLMLands = async () => {
      try {
        setLoading(true);
        // Use park_code for NPS parks, otherwise use park id
        const identifier = park.park_code || park.id;
        const response = await fetch(`/api/parks/${identifier}/blm`);

        if (!response.ok) {
          throw new Error('Failed to fetch BLM lands');
        }

        const data = await response.json();
        setBLMLands(data.blmLands || []);
      } catch (err) {
        console.error('Error fetching BLM lands:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBLMLands();
  }, [park.park_code, park.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-gray-100 dark:bg-gray-800 rounded-lg">
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-gray-600 dark:text-gray-400">
          Unable to load BLM lands: {error}
        </p>
      </div>
    );
  }

  if (blmLands.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-100 dark:bg-gray-800 rounded-lg">
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
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          No BLM lands found near this park
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          BLM land data may not be available for this area
        </p>
      </div>
    );
  }

  const centerLat = hasCoordinates ? parseFloat(park.latitude) : 39.8283;
  const centerLng = hasCoordinates ? parseFloat(park.longitude) : -98.5795;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            BLM Land Near {park.full_name || park.name}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {blmLands.length} BLM land{blmLands.length !== 1 ? 's' : ''} found within
            50km
          </p>
        </div>
        <StartTrackingButton
          parkCode={park.park_code}
          parkId={park.source === 'nps' ? park.id : null}
          localParkId={park.source === 'local' ? park.id : null}
          parkName={park.full_name || park.name}
          variant="primary"
          size="md"
        />
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-medium text-amber-800 dark:text-amber-300">
              About BLM Land
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Bureau of Land Management (BLM) lands are public lands that often
              allow dispersed camping, hiking, and other recreational activities.
              Rules vary by location - always check local regulations before
              visiting.
            </p>
            <a
              href="https://www.blm.gov/programs/recreation"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 hover:underline mt-2"
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

      {/* BLM Map */}
      {blmLands.some((b) => b.geojson || b.geometry_geojson) && (
        <div className="rounded-lg overflow-hidden shadow-md">
          <BLMMap
            blmLands={blmLands}
            center={{ lat: centerLat, lng: centerLng }}
            zoom={hasCoordinates ? 9 : 4}
          />
        </div>
      )}

      {/* BLM List */}
      <BLMList
        blmLands={blmLands}
        showFilters={blmLands.length > 3}
        showDistance={true}
      />
    </div>
  );
}