'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAnalytics } from '@/hooks/useAnalytics';

// Dynamically import the map component to avoid SSR issues with Leaflet
const ParksMap = dynamic(() => import('@/components/parks/ParkMap').then((mod) => mod.ParksMap), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-200 rounded-lg animate-pulse flex items-center justify-center">
      <span className="text-gray-500">Loading map...</span>
    </div>
  ),
});

/**
 * State detail page
 * Shows all parks in a specific state
 */
export default function StatePage() {
  const params = useParams();
  const { slug } = params;

  const [state, setState] = useState(null);
  const [parks, setParks] = useState([]);
  const [stateParks, setStateParks] = useState([]);
  const [counties, setCounties] = useState([]);
  const [localParksCount, setLocalParksCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useAnalytics();

  useEffect(() => {
    const fetchState = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/states/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('State not found');
          }
          throw new Error('Failed to fetch state');
        }

        const data = await response.json();
        setState(data.state);
        setParks(data.parks);
        setStateParks(data.stateParks || []);
        setCounties(data.counties || []);
        setLocalParksCount(data.localParksCount || 0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchState();
    }
  }, [slug]);

  // Get first image from park images array
  const getParkImage = (park) => {
    if (park.images && park.images.length > 0) {
      return park.images[0].url;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded-lg mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {error === 'State not found' ? 'State Not Found' : 'Error Loading State'}
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/states" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Back to States
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  // Combine all parks for the map
  const allParksForMap = [
    ...parks.map((p) => ({ ...p, type: 'national' })),
    ...stateParks.map((p) => ({ ...p, type: 'state' })),
  ].filter((p) => p.latitude && p.longitude);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                Home
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <Link href="/states" className="text-gray-500 hover:text-gray-700">
                States
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 font-medium">{state.name}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{state.name}</h1>
            <span className="bg-gray-100 text-gray-700 text-lg font-medium px-3 py-1 rounded">
              {state.code}
            </span>
          </div>
          <p className="text-gray-600">
            {parks.length + stateParks.length} park{parks.length + stateParks.length !== 1 ? 's' : ''} to
            explore
          </p>
        </div>

        {/* Map */}
        {allParksForMap.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Park Locations</h2>
            <div className="h-80 rounded-lg overflow-hidden shadow-sm">
              <ParksMap
                parks={allParksForMap}
                zoom={6}
              />
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            National Parks & Sites ({parks.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}
              aria-label="Grid view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}
              aria-label="List view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* National Parks */}
        {parks.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {parks.map((park) => (
                <Link
                  key={park.id}
                  href={`/parks/${park.park_code}`}
                  className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {getParkImage(park) ? (
                    <img
                      src={getParkImage(park)}
                      alt={park.full_name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <span className="text-white text-4xl">🏞️</span>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{park.full_name}</h3>
                    {park.designation && (
                      <p className="text-sm text-green-600 mb-2">{park.designation}</p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-2">{park.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm divide-y mb-12">
              {parks.map((park) => (
                <Link
                  key={park.id}
                  href={`/parks/${park.park_code}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  {getParkImage(park) ? (
                    <img
                      src={getParkImage(park)}
                      alt={park.full_name}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-2xl">🏞️</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">{park.full_name}</h3>
                    {park.designation && (
                      <p className="text-sm text-green-600 mb-1">{park.designation}</p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-1">{park.description}</p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg p-8 text-center mb-12">
            <p className="text-gray-600">No national parks found in {state.name}.</p>
          </div>
        )}

        {/* State Parks (if any) */}
        {stateParks.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">State Parks ({stateParks.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {stateParks.map((park) => (
                <div
                  key={park.id}
                  className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {park.images?.[0]?.url ? (
                    <img
                      src={park.images[0].url}
                      alt={park.name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <span className="text-white text-4xl">🌲</span>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{park.name}</h3>
                    {park.park_type && <p className="text-sm text-blue-600 mb-2">{park.park_type}</p>}
                    <p className="text-sm text-gray-600 line-clamp-2">{park.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Counties with Local Parks */}
        {counties.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                County & City Parks ({localParksCount.toLocaleString()})
              </h2>
              <Link
                href={`/parks/local/${slug}`}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                View All →
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-12">
              <p className="text-gray-600 mb-4">
                Browse local parks by county. Click on a county to see all parks in that area.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {counties.map((county) => (
                  <Link
                    key={county.id}
                    href={`/parks/county/${slug}/${county.slug}`}
                    className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors border border-gray-200"
                  >
                    <span className="font-medium text-gray-900 text-sm text-center line-clamp-1">
                      {county.name}
                    </span>
                    <span className="text-xs text-blue-600 mt-1">
                      {county.park_count} park{county.park_count !== 1 ? 's' : ''}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Back Link */}
        <div className="mt-12 text-center">
          <Link href="/states" className="text-green-600 hover:text-green-700 font-medium">
            ← Back to all states
          </Link>
        </div>
      </div>
    </div>
  );
}