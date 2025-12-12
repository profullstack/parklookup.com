'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapWithNoSSR = dynamic(
  () => import('@/components/parks/InteractiveParksMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-200px)] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    ),
  }
);

/**
 * Map page - displays all parks on an interactive map
 */
export default function MapPage() {
  const [parks, setParks] = useState([]);
  const [localParks, setLocalParks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showLocalParks, setShowLocalParks] = useState(true);

  // Fetch all parks (national, state, and local)
  useEffect(() => {
    async function fetchAllParks() {
      try {
        // Fetch national and state parks
        const parksResponse = await fetch('/api/parks?limit=500');
        if (!parksResponse.ok) {
          throw new Error('Failed to fetch parks');
        }
        const parksData = await parksResponse.json();
        setParks(parksData.parks || []);

        // Fetch local parks (county and city)
        try {
          const localResponse = await fetch('/api/local-parks?limit=1000');
          if (localResponse.ok) {
            const localData = await localResponse.json();
            setLocalParks(localData.parks || []);
          }
        } catch (localErr) {
          // Local parks are optional, don't fail if they can't be loaded
          console.warn('Could not load local parks:', localErr.message);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAllParks();
  }, []);

  // Handle location lookup
  const handleFindMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (err) => {
        setLocationError(
          err.code === 1
            ? 'Location access denied. Please enable location services.'
            : 'Unable to retrieve your location. Please try again.'
        );
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-green-700 dark:bg-green-800 text-white py-6">
        <div className="container mx-auto px-4">
          <nav className="mb-4">
            <Link href="/" className="text-green-200 hover:text-white transition-colors">
              ← Back to Home
            </Link>
          </nav>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Park Map</h1>
              <p className="text-green-100">
                {loading ? 'Loading parks...' : `${parks.length + (showLocalParks ? localParks.length : 0)} parks to explore`}
              </p>
            </div>

            {/* Find My Location Button */}
            <button
              onClick={handleFindMyLocation}
              disabled={locationLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-green-700 font-medium rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {locationLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Finding location...
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
                  Find My Location
                </>
              )}
            </button>
          </div>

          {/* Location Error */}
          {locationError && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-400 rounded-lg text-red-100">
              {locationError}
            </div>
          )}

          {/* User Location Info */}
          {userLocation && (
            <div className="mt-4 p-3 bg-green-600/50 border border-green-400 rounded-lg">
              <p className="text-green-100">
                📍 Showing parks within 100 miles of your location
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="container mx-auto px-4 py-6">
        {error ? (
          <div className="h-[calc(100vh-300px)] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <MapWithNoSSR
            parks={parks}
            localParks={showLocalParks ? localParks : []}
            userLocation={userLocation}
            loading={loading}
          />
        )}
      </div>

      {/* Legend and Controls */}
      <div className="container mx-auto px-4 pb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-3">
            <h3 className="font-semibold text-gray-800 dark:text-white">Map Legend</h3>
            
            {/* Toggle for local parks */}
            {localParks.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocalParks}
                  onChange={(e) => setShowLocalParks(e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Show Local Parks ({localParks.length})
                </span>
              </label>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">National Park</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-600 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">State Park</span>
            </div>
            {showLocalParks && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-600 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">County Park</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-teal-600 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">City Park</span>
                </div>
              </>
            )}
            {userLocation && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Your Location</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Click on a park marker to see its address and details.
          </p>
        </div>
      </div>
    </div>
  );
}