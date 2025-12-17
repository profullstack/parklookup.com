'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { FavoriteButton } from '@/components/parks/FavoriteButton';
import { useAnalytics } from '@/hooks/useAnalytics';
import WeatherForecast from '@/components/weather/WeatherForecast';
import WeatherAlerts from '@/components/weather/WeatherAlerts';
import { ProductCarousel } from '@/components/products/ProductCard';
import NearbyPlaces from '@/components/parks/NearbyPlaces';
import NearbyParks from '@/components/parks/NearbyParks';
import ParkReviews from '@/components/parks/ParkReviews';
import UserPhotos from '@/components/parks/UserPhotos';
import TrailList from '@/components/trails/TrailList';
import ParkBLMSection from '@/components/blm/ParkBLMSection';
import StartTrackingButton from '@/components/tracking/StartTrackingButton';

// Dynamically import the map components to avoid SSR issues
const ParkMap = dynamic(() => import('@/components/parks/ParkMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  ),
});

const TrailMap = dynamic(() => import('@/components/trails/TrailMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  ),
});

/**
 * Park Trails Section Component
 * Displays trail map and list for a park
 */
function ParkTrailsSection({ park, hasCoordinates }) {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrails = async () => {
      try {
        setLoading(true);
        // Use park_code for NPS parks, otherwise use park id
        const identifier = park.park_code || park.id;
        const response = await fetch(`/api/parks/${identifier}/trails?includeGeometry=true`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch trails');
        }
        
        const data = await response.json();
        setTrails(data.trails || []);
      } catch (err) {
        console.error('Error fetching trails:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrails();
  }, [park.park_code, park.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
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
          Unable to load trails: {error}
        </p>
      </div>
    );
  }

  if (trails.length === 0) {
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
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          No trails found for this park
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Trail data may not be available yet for this location
        </p>
      </div>
    );
  }

  // Filter trails that have valid geometry for the map
  const trailsWithGeometry = trails.filter((trail) => {
    if (!trail.geojson && !trail.geometry && !trail.geometry_geojson) return false;
    
    // Parse geometry to check for valid coordinates
    let geom = trail.geojson || trail.geometry || trail.geometry_geojson;
    if (typeof geom === 'string') {
      try {
        geom = JSON.parse(geom);
      } catch {
        return false;
      }
    }
    
    // Check if geometry has valid coordinates
    if (!geom?.coordinates || !Array.isArray(geom.coordinates)) return false;
    
    // Check for at least one valid coordinate
    const hasValidCoord = geom.coordinates.some((coord) =>
      Array.isArray(coord) &&
      coord.length >= 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      isFinite(coord[0]) &&
      isFinite(coord[1])
    );
    
    return hasValidCoord;
  });

  const centerLat = hasCoordinates ? parseFloat(park.latitude) : 39.8283;
  const centerLng = hasCoordinates ? parseFloat(park.longitude) : -98.5795;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Trails in {park.full_name || park.name}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {trails.length} trail{trails.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Trail Map - pass array of trails, not GeoJSON */}
      {trailsWithGeometry.length > 0 && (
        <div className="rounded-lg overflow-hidden shadow-md">
          <TrailMap
            trails={trailsWithGeometry}
            center={{ lat: centerLat, lng: centerLng }}
            zoom={hasCoordinates ? 11 : 4}
            showBLMToggle={true}
            parkCode={park.park_code || park.id}
          />
        </div>
      )}

      {/* Trail List */}
      <TrailList
        trails={trails}
        parkId={park.id}
        parkCode={park.park_code}
        showFilters={trails.length > 3}
      />
    </div>
  );
}

/**
 * Tab configuration
 */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'trails', label: 'Trails' },
  { id: 'blm', label: 'BLM Land' },
  { id: 'photos', label: 'Photos' },
  { id: 'map', label: 'Map' },
  { id: 'weather', label: 'Weather Events' },
  { id: 'activities', label: 'Activities' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'info', label: 'Info' },
];

/**
 * Client component for park detail page interactive elements
 */
export default function ParkDetailClient({
  park,
  activeTab,
  products,
  hasCoordinates,
  images,
  activities,
  entranceFees,
  operatingHours,
}) {
  const { trackParkView, trackPageView } = useAnalytics();

  // Track page view and park view
  useEffect(() => {
    trackPageView(`park/${park.park_code}/${activeTab}`);
    trackParkView(park);
  }, [trackPageView, trackParkView, park, activeTab]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Favorite button - positioned absolutely in hero on mobile, inline on desktop */}
      <div className="fixed top-4 right-4 z-10 md:hidden">
        <FavoriteButton parkId={park.id} parkCode={park.park_code} />
      </div>
      <div className="hidden md:block absolute top-4 right-4">
        <FavoriteButton parkId={park.id} parkCode={park.park_code} />
      </div>

      {/* Tabs - using Links for SSR-friendly navigation */}
      {/* Use /park/:id URL pattern for all parks */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 mb-6 -mx-4 px-4">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/park/${park.id}${tab.id === 'overview' ? '' : `/${tab.id}`}`}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">About</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{park.description}</p>
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {park.states && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Location
                </p>
                <p className="text-gray-900 dark:text-white font-medium">{park.states}</p>
              </div>
            )}
            {park.designation && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Type
                </p>
                <p className="text-gray-900 dark:text-white font-medium">{park.designation}</p>
              </div>
            )}
            {park.area && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Area
                </p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {Math.round(park.area).toLocaleString()} {park.area_unit || 'acres'}
                </p>
              </div>
            )}
            {park.inception && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Established
                </p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {new Date(park.inception).getFullYear()}
                </p>
              </div>
            )}
          </div>

          {/* Recommended Gear */}
          {products.length > 0 && (
            <div>
              <ProductCarousel
                products={products}
                loading={false}
                title="Gear Up for Your Visit"
              />
            </div>
          )}

          {/* Weather */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Weather</h2>
            {park.weather_info && (
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                {park.weather_info}
              </p>
            )}
            {hasCoordinates && (
              <div className="mt-4">
                <WeatherForecast
                  latitude={parseFloat(park.latitude)}
                  longitude={parseFloat(park.longitude)}
                  parkName={park.full_name}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Start Tracking Button - for pro users */}
            <StartTrackingButton
              parkCode={park.park_code}
              parkId={park.id}
              parkName={park.full_name || park.name}
              variant="primary"
            />
            
            {park.url && (
              <a
                href={park.url}
                target="_blank"
                rel="noopener noreferrer"
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Official Website
              </a>
            )}
            {park.directions_url && (
              <a
                href={park.directions_url}
                target="_blank"
                rel="noopener noreferrer"
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
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Directions
              </a>
            )}
          </div>
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Map & Location
          </h2>
          {hasCoordinates ? (
            <div className="rounded-lg overflow-hidden shadow-md">
              <ParkMap
                latitude={parseFloat(park.latitude)}
                longitude={parseFloat(park.longitude)}
                parkName={park.full_name}
                address={park.physical_address}
              />
            </div>
          ) : (
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
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                Map coordinates not available for this park
              </p>
            </div>
          )}
        </div>
      )}

      {/* Weather Events Tab */}
      {activeTab === 'weather' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Weather Events & Alerts
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Active weather alerts and warnings from the National Weather Service for this park
            area.
          </p>
          {hasCoordinates ? (
            <WeatherAlerts
              latitude={parseFloat(park.latitude)}
              longitude={parseFloat(park.longitude)}
              parkName={park.full_name}
            />
          ) : (
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
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                Location coordinates not available for weather alerts
              </p>
            </div>
          )}
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="space-y-8">
          {/* Park Activities */}
          {activities.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Park Activities
              </h2>
              <div className="flex flex-wrap gap-2">
                {activities.map((activity, index) => {
                  const activityName = activity.name || activity;
                  const activitySlug = activityName.toLowerCase().replace(/\s+/g, '-');
                  return (
                    <Link
                      key={index}
                      href={`/activities/${encodeURIComponent(activitySlug)}`}
                      className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      {activityName}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nearby Places */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Nearby Places
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Restaurants, entertainment, lodging, and more near the park
            </p>
            <NearbyPlaces parkCode={park.park_code} />
          </div>

          {/* Nearby Parks */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Nearby Parks
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Other national and state parks in the area
            </p>
            <NearbyParks
              latitude={parseFloat(park.latitude)}
              longitude={parseFloat(park.longitude)}
              currentParkCode={park.park_code}
              radius={150}
              limit={6}
            />
          </div>
        </div>
      )}

      {/* Trails Tab */}
      {activeTab === 'trails' && (
        <ParkTrailsSection park={park} hasCoordinates={hasCoordinates} />
      )}

      {/* BLM Land Tab */}
      {activeTab === 'blm' && (
        <ParkBLMSection park={park} hasCoordinates={hasCoordinates} />
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <UserPhotos parkCode={park.park_code} />
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Reviews & Ratings
          </h2>
          <ParkReviews parkCode={park.park_code} />
        </div>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Entrance Fees */}
          {entranceFees.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Entrance Fees
              </h2>
              <div className="space-y-3">
                {entranceFees.map((fee, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{fee.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {fee.description}
                        </p>
                      </div>
                      <span className="text-green-600 font-semibold">${fee.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operating Hours */}
          {operatingHours.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Operating Hours
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                {operatingHours.map((hours, index) => (
                  <div key={index}>
                    <p className="font-medium text-gray-900 dark:text-white mb-2">{hours.name}</p>
                    {hours.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {hours.description}
                      </p>
                    )}
                    {hours.standardHours && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(hours.standardHours).map(([day, time]) => (
                          <div key={day} className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400 capitalize">
                              {day}
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {time || 'Closed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact Info */}
          {(park.contacts?.phoneNumbers?.length > 0 ||
            park.contacts?.emailAddresses?.length > 0) && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Contact
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm space-y-2">
                {park.contacts?.phoneNumbers?.map((phone, index) => (
                  <div key={index} className="flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <a
                      href={`tel:${phone.phoneNumber}`}
                      className="text-green-600 hover:underline"
                    >
                      {phone.phoneNumber}
                    </a>
                    {phone.type && (
                      <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                        ({phone.type})
                      </span>
                    )}
                  </div>
                ))}
                {park.contacts?.emailAddresses?.map((email, index) => (
                  <div key={index} className="flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <a
                      href={`mailto:${email.emailAddress}`}
                      className="text-green-600 hover:underline"
                    >
                      {email.emailAddress}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Gallery - shown on all tabs except trails when there are images */}
      {images.length > 0 && activeTab !== 'trails' && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Photos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* For parks with multiple images, skip the first one (shown in hero) */}
            {/* For parks with only 1 image, show it in the gallery too */}
            {(images.length > 1 ? images.slice(1, 7) : images).map((image, index) => (
              <div key={index} className="relative aspect-video rounded-lg overflow-hidden">
                <Image
                  src={image.url}
                  alt={image.altText || `${park.full_name} photo ${index + (images.length > 1 ? 2 : 1)}`}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}