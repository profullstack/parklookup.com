'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useAnalytics } from '@/hooks/useAnalytics';
import WeatherForecast from '@/components/weather/WeatherForecast';
import WeatherAlerts from '@/components/weather/WeatherAlerts';
import { ParkPlaceholder } from '@/components/ui/ParkPlaceholder';
import LocalParkUserPhotos from '@/components/parks/LocalParkUserPhotos';
import NearbyParks from '@/components/parks/NearbyParks';

// Dynamically import the map component to avoid SSR issues with Leaflet
const ParkMap = dynamic(() => import('@/components/parks/ParkMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  ),
});

/**
 * Tab configuration for local parks
 */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'photos', label: 'Photos' },
  { id: 'map', label: 'Map' },
  { id: 'weather', label: 'Weather' },
  { id: 'info', label: 'Info' },
];

/**
 * Park type labels
 */
const PARK_TYPE_LABELS = {
  county: 'County Park',
  city: 'City Park',
  regional: 'Regional Park',
  municipal: 'Municipal Park',
};

/**
 * Builds breadcrumb items for the park
 */
const buildBreadcrumbs = (park) => {
  const crumbs = [{ label: 'Parks', href: '/parks' }];

  if (park.state) {
    crumbs.push({
      label: park.state.name,
      href: `/states/${park.state.slug}`,
    });
  }

  if (park.park_type === 'county' && park.county) {
    crumbs.push({
      label: `${park.county.name} County`,
      href: `/parks/county/${park.state?.slug}/${park.county.slug}`,
    });
  } else if (park.park_type === 'city' && park.city) {
    crumbs.push({
      label: park.city.name,
      href: `/parks/city/${park.state?.slug}/${park.city.slug}`,
    });
  }

  crumbs.push({ label: park.name, href: null });

  return crumbs;
};

/**
 * LocalParkDetailClient Component
 *
 * Client component for local park detail page interactive elements.
 *
 * @param {Object} props
 * @param {Object} props.park - Park data object
 * @param {string} [props.activeTab='overview'] - Currently active tab
 */
export default function LocalParkDetailClient({ park, activeTab = 'overview' }) {
  const { trackPageView } = useAnalytics();

  const hasCoordinates = park.latitude && park.longitude;
  const breadcrumbs = buildBreadcrumbs(park);
  const primaryPhoto = park.primary_photo || park.photos?.[0];

  // Build the base URL for tab navigation
  const baseUrl = park.park_type === 'county' && park.county
    ? `/parks/county/${park.state?.slug}/${park.county.slug}/${park.slug}`
    : park.park_type === 'city' && park.city
    ? `/parks/city/${park.state?.slug}/${park.city.slug}/${park.slug}`
    : `/parks/local/${park.state?.slug}/${park.slug}`;

  // Track page view
  useEffect(() => {
    trackPageView(`local-park/${park.slug}/${activeTab}`);
  }, [trackPageView, park.slug, activeTab]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumbs */}
      <nav className="mb-4">
        <ol className="flex flex-wrap items-center text-sm text-gray-500 dark:text-gray-400">
          {breadcrumbs.map((crumb, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <svg
                  className="w-4 h-4 mx-2"
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
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-green-600 dark:hover:text-green-400"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-900 dark:text-white font-medium">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Hero Image */}
      <div className="relative aspect-video rounded-lg overflow-hidden mb-6">
        {primaryPhoto?.image_url ? (
          <>
            <Image
              src={primaryPhoto.image_url}
              alt={park.name}
              fill
              className="object-cover"
              priority
            />
            {primaryPhoto.attribution && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-3 py-1">
                Photo: {primaryPhoto.attribution}
                {primaryPhoto.license && ` (${primaryPhoto.license})`}
              </div>
            )}
          </>
        ) : (
          <ParkPlaceholder parkType={park.park_type} />
        )}
      </div>

      {/* Park Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mb-2">
              {PARK_TYPE_LABELS[park.park_type] || park.park_type}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {park.name}
            </h1>
            {park.managing_agency && (
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Managed by {park.managing_agency}
              </p>
            )}
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              park.access === 'Open'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : park.access === 'Restricted'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
            }`}
          >
            {park.access || 'Unknown'} Access
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 mb-6 -mx-4 px-4">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`${baseUrl}${tab.id === 'overview' ? '' : `/${tab.id}`}`}
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
          {park.description && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                About
              </h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {park.description}
              </p>
            </div>
          )}

          {/* Quick Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {park.state && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  State
                </p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {park.state.name}
                </p>
              </div>
            )}
            {park.county && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  County
                </p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {park.county.name}
                </p>
              </div>
            )}
            {park.city && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  City
                </p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {park.city.name}
                </p>
              </div>
            )}
          </div>

          {/* Weather Preview */}
          {hasCoordinates && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Weather
              </h2>
              <WeatherForecast
                latitude={parseFloat(park.latitude)}
                longitude={parseFloat(park.longitude)}
                parkName={park.name}
              />
            </div>
          )}

          {/* External Links */}
          <div className="flex flex-wrap gap-3">
            {park.website && (
              <a
                href={park.website}
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
            {park.wikidata_id && (
              <a
                href={`https://www.wikidata.org/wiki/${park.wikidata_id}`}
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Wikidata
              </a>
            )}
          </div>

          {/* Nearby Parks */}
          {hasCoordinates && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Nearby Parks
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Other parks in the area
              </p>
              <NearbyParks
                latitude={parseFloat(park.latitude)}
                longitude={parseFloat(park.longitude)}
                currentParkCode={null}
                radius={50}
                limit={6}
              />
            </div>
          )}
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <LocalParkUserPhotos
          localParkId={park.id}
          existingPhotos={park.photos || []}
        />
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
                parkName={park.name}
                address={park.address}
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

      {/* Weather Tab */}
      {activeTab === 'weather' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Weather & Alerts
          </h2>
          {hasCoordinates ? (
            <div className="space-y-6">
              <WeatherForecast
                latitude={parseFloat(park.latitude)}
                longitude={parseFloat(park.longitude)}
                parkName={park.name}
              />
              <WeatherAlerts
                latitude={parseFloat(park.latitude)}
                longitude={parseFloat(park.longitude)}
                parkName={park.name}
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
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                Location coordinates not available for weather data
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Contact Info */}
          {(park.phone || park.address) && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Contact Information
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm space-y-3">
                {park.phone && (
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3"
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
                      href={`tel:${park.phone}`}
                      className="text-green-600 hover:underline"
                    >
                      {park.phone}
                    </a>
                  </div>
                )}
                {park.address && (
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3 mt-0.5"
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
                    <span className="text-gray-700 dark:text-gray-300">
                      {park.address}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {park.amenities && park.amenities.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Amenities
              </h2>
              <div className="flex flex-wrap gap-2">
                {park.amenities.map((amenity, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {park.activities && park.activities.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Activities
              </h2>
              <div className="flex flex-wrap gap-2">
                {park.activities.map((activity, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm"
                  >
                    {activity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Data Source */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Data Source
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Park data sourced from the{' '}
                <a
                  href="https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-data-overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  USGS Protected Areas Database (PAD-US)
                </a>
                . Photos from{' '}
                <a
                  href="https://commons.wikimedia.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  Wikimedia Commons
                </a>
                .
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Last updated: {new Date(park.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}