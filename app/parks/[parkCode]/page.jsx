'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { FavoriteButton } from '@/components/parks/FavoriteButton';
import { useAnalytics } from '@/hooks/useAnalytics';
import WeatherForecast from '@/components/weather/WeatherForecast';
import WeatherAlerts from '@/components/weather/WeatherAlerts';
import { ProductCarousel } from '@/components/products/ProductCard';
import NearbyPlaces from '@/components/parks/NearbyPlaces';
import ParkReviews from '@/components/parks/ParkReviews';

// Dynamically import the map component to avoid SSR issues with Leaflet
const ParkMap = dynamic(() => import('@/components/parks/ParkMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  ),
});

/**
 * Park detail page - shows full information about a specific park
 */
export default function ParkDetailPage() {
  const params = useParams();
  const { parkCode } = params;
  const { trackParkView, trackPageView } = useAnalytics();

  const [park, setPark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Track page view
  useEffect(() => {
    trackPageView(`park/${parkCode}`);
  }, [trackPageView, parkCode]);

  // Fetch park details
  useEffect(() => {
    const fetchPark = async () => {
      try {
        const response = await fetch(`/api/parks/${parkCode}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Park not found');
          }
          throw new Error('Failed to fetch park details');
        }

        const data = await response.json();
        setPark(data.park);

        // Track park view for analytics
        trackParkView(data.park);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (parkCode) {
      fetchPark();
    }
  }, [parkCode, trackParkView]);

  // Fetch recommended products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const response = await fetch('/api/products?limit=5&random=true');
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse">
          <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700" />
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8" />
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error === 'Park not found' ? 'Park Not Found' : 'Error'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Link
            href="/search"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (!park) {
    return null;
  }

  const hasCoordinates = park.latitude && park.longitude;
  const images = park.images || [];
  const activities = park.activities || [];
  const entranceFees = park.entrance_fees || [];
  const operatingHours = park.operating_hours || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Image */}
      <div className="relative h-64 md:h-96 bg-gray-800">
        {images.length > 0 ? (
          <Image
            src={images[0].url}
            alt={images[0].altText || park.full_name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-green-800">
            <svg
              className="w-24 h-24 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Back button */}
        <Link
          href="/search"
          className="absolute top-4 left-4 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
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
        </Link>

        {/* Favorite button */}
        <div className="absolute top-4 right-4">
          <FavoriteButton parkId={park.id} parkCode={park.park_code} />
        </div>

        {/* Park name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">{park.full_name}</h1>
            <p className="text-white/90 text-sm md:text-base">
              {park.states} • {park.designation || 'National Park'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 mb-6 -mx-4 px-4">
          {['overview', 'map', 'weather', 'activities', 'reviews', 'info'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'weather' ? 'Weather Events' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
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
              {park.wikidata?.area && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Area
                  </p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {Math.round(park.wikidata.area).toLocaleString()} acres
                  </p>
                </div>
              )}
              {park.wikidata?.inception && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Established
                  </p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {new Date(park.wikidata.inception).getFullYear()}
                  </p>
                </div>
              )}
            </div>

            {/* Recommended Gear */}
            <div>
              <ProductCarousel
                products={products}
                loading={productsLoading}
                title="Gear Up for Your Visit"
              />
            </div>

            {/* Weather */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Weather</h2>
              {park.weather_info && (
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  {park.weather_info}
                </p>
              )}
              {/* 7-Day Forecast from NWS API */}
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

            {/* External Links */}
            <div className="flex flex-wrap gap-3">
              {park.url && (
                <a
                  href={park.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
              <NearbyPlaces parkCode={parkCode} />
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Reviews & Ratings
            </h2>
            <ParkReviews parkCode={parkCode} />
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

        {/* Image Gallery */}
        {images.length > 1 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.slice(1, 7).map((image, index) => (
                <div key={index} className="relative aspect-video rounded-lg overflow-hidden">
                  <Image
                    src={image.url}
                    alt={image.altText || `${park.full_name} photo ${index + 2}`}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
