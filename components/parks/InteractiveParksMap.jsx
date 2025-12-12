'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// State park marker icon (purple for state parks)
const StateParkIcon = L.divIcon({
  className: 'custom-state-park-marker',
  html: `
    <div style="
      background-color: #7c3aed;
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// Custom park marker icon (green for National Parks)
const ParkIcon = L.divIcon({
  className: 'custom-park-marker',
  html: `
    <div style="
      background-color: #16a34a;
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// County park marker icon (orange for county parks)
const CountyParkIcon = L.divIcon({
  className: 'custom-county-park-marker',
  html: `
    <div style="
      background-color: #ea580c;
      width: 20px;
      height: 20px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20],
});

// City park marker icon (teal for city parks)
const CityParkIcon = L.divIcon({
  className: 'custom-city-park-marker',
  html: `
    <div style="
      background-color: #0d9488;
      width: 20px;
      height: 20px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20],
});

// User location marker icon
const UserIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `
    <div style="
      background-color: #2563eb;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.5);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

// 100 miles in meters
const RADIUS_MILES = 100;
const RADIUS_METERS = RADIUS_MILES * 1609.34;

/**
 * Component to handle map view changes when user location is set
 */
function MapController({ userLocation, parks }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      // Zoom to user location with appropriate zoom level for 100 mile radius
      // At zoom level 7, roughly 100 miles is visible
      map.setView([userLocation.lat, userLocation.lng], 7, {
        animate: true,
        duration: 1,
      });
    }
  }, [userLocation, map]);

  return null;
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Custom hook to fetch address for a park
 */
function useAddressLookup() {
  const [addressCache, setAddressCache] = useState({});
  const [loadingAddresses, setLoadingAddresses] = useState({});

  const fetchAddress = useCallback(async (parkId, lat, lng) => {
    // Return cached address if available
    if (addressCache[parkId]) {
      return addressCache[parkId];
    }

    // Don't fetch if already loading
    if (loadingAddresses[parkId]) {
      return null;
    }

    setLoadingAddresses((prev) => ({ ...prev, [parkId]: true }));

    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }
      const data = await response.json();

      const address = data.found ? data.shortAddress || data.formattedAddress : null;

      setAddressCache((prev) => ({ ...prev, [parkId]: address }));
      return address;
    } catch (error) {
      console.error('Error fetching address:', error);
      setAddressCache((prev) => ({ ...prev, [parkId]: null }));
      return null;
    } finally {
      setLoadingAddresses((prev) => ({ ...prev, [parkId]: false }));
    }
  }, [addressCache, loadingAddresses]);

  return { addressCache, loadingAddresses, fetchAddress };
}

/**
 * Determine park type from park object
 * @param {Object} park - Park object
 * @returns {string} Park type: 'national', 'state', 'county', or 'city'
 */
function getParkType(park) {
  // Local parks have park_type field
  if (park.park_type === 'county') return 'county';
  if (park.park_type === 'city') return 'city';
  
  // State parks from wikidata or with State Park designation
  if (park.source === 'wikidata' || park.designation === 'State Park') return 'state';
  
  // Default to national park
  return 'national';
}

/**
 * Get the appropriate icon for a park type
 * @param {string} parkType - Park type
 * @returns {L.DivIcon} Leaflet icon
 */
function getParkIcon(parkType) {
  switch (parkType) {
    case 'county':
      return CountyParkIcon;
    case 'city':
      return CityParkIcon;
    case 'state':
      return StateParkIcon;
    default:
      return ParkIcon;
  }
}

/**
 * Get the URL for a park detail page
 * @param {Object} park - Park object
 * @returns {string} URL path
 */
function getParkUrl(park) {
  // Local parks have different URL structure
  if (park.park_type === 'county' && park.state && park.county && park.slug) {
    return `/parks/county/${park.state.toLowerCase()}/${encodeURIComponent(park.county.toLowerCase().replace(/\s+/g, '-'))}/${park.slug}`;
  }
  if (park.park_type === 'city' && park.state && park.city && park.slug) {
    return `/parks/city/${park.state.toLowerCase()}/${encodeURIComponent(park.city.toLowerCase().replace(/\s+/g, '-'))}/${park.slug}`;
  }
  
  // National and state parks use park_code
  return `/parks/${park.park_code}`;
}

/**
 * InteractiveParksMap component - displays parks on a map with user location support
 * @param {Object} props
 * @param {Array} props.parks - Array of park objects (national and state parks)
 * @param {Array} props.localParks - Array of local park objects (county and city parks)
 * @param {Object} props.userLocation - User's location {lat, lng}
 * @param {boolean} props.loading - Loading state
 */
export default function InteractiveParksMap({ parks = [], localParks = [], userLocation = null, loading = false }) {
  const mapRef = useRef(null);
  const { addressCache, loadingAddresses, fetchAddress } = useAddressLookup();

  // Default center (US center)
  const defaultCenter = [39.8283, -98.5795];
  const defaultZoom = 4;

  // Combine and filter parks with valid coordinates
  const allParks = useMemo(() => {
    const combined = [
      ...parks.map(p => ({ ...p, _source: 'parks' })),
      ...localParks.map(p => ({ ...p, _source: 'local' }))
    ];
    
    return combined.filter(
      (p) =>
        p.latitude &&
        p.longitude &&
        !isNaN(parseFloat(p.latitude)) &&
        !isNaN(parseFloat(p.longitude))
    );
  }, [parks, localParks]);

  // Filter parks within 100 miles of user location
  const nearbyParks = useMemo(() => {
    if (!userLocation) {return allParks;}

    return allParks.filter((park) => {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        parseFloat(park.latitude),
        parseFloat(park.longitude)
      );
      return distance <= RADIUS_MILES;
    });
  }, [allParks, userLocation]);

  // Parks to display (nearby if user location set, otherwise all)
  const displayParks = userLocation ? nearbyParks : allParks;

  if (loading) {
    return (
      <div className="h-[calc(100vh-300px)] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading parks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-300px)] rounded-lg overflow-hidden shadow-lg">
      <MapContainer
        center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter}
        zoom={userLocation ? 7 : defaultZoom}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map controller for handling view changes */}
        <MapController userLocation={userLocation} parks={displayParks} />

        {/* User location marker and radius circle */}
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={UserIcon}>
              <Popup>
                <div className="text-center">
                  <strong className="text-blue-700">Your Location</strong>
                  <br />
                  <span className="text-sm text-gray-600">
                    {nearbyParks.length} parks within {RADIUS_MILES} miles
                  </span>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={RADIUS_METERS}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#2563eb',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          </>
        )}

        {/* Park markers */}
        {displayParks.map((park) => {
          const parkId = park.id || park.park_code;
          const lat = parseFloat(park.latitude);
          const lng = parseFloat(park.longitude);
          const parkType = getParkType(park);

          const distance = userLocation
            ? calculateDistance(
                userLocation.lat,
                userLocation.lng,
                lat,
                lng
              ).toFixed(1)
            : null;

          return (
            <Marker
              key={`${park._source || 'park'}-${parkId}`}
              position={[lat, lng]}
              icon={getParkIcon(parkType)}
              eventHandlers={{
                popupopen: () => {
                  // Fetch address when popup opens
                  fetchAddress(parkId, lat, lng);
                },
              }}
            >
              <Popup>
                <ParkPopupContent
                  park={park}
                  distance={distance}
                  address={addressCache[parkId]}
                  isLoading={loadingAddresses[parkId]}
                  parkType={parkType}
                />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Info overlay */}
      {userLocation && nearbyParks.length === 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg shadow-lg z-[1000]">
          <p className="text-sm">
            No parks found within {RADIUS_MILES} miles of your location. Try zooming out to see more
            parks.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Get color classes for park type
 * @param {string} parkType - Park type
 * @returns {Object} Color classes
 */
function getParkColors(parkType) {
  switch (parkType) {
    case 'county':
      return {
        text: 'text-orange-700',
        link: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-700',
        label: 'County Park'
      };
    case 'city':
      return {
        text: 'text-teal-700',
        link: 'text-teal-600',
        badge: 'bg-teal-100 text-teal-700',
        label: 'City Park'
      };
    case 'state':
      return {
        text: 'text-purple-700',
        link: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-700',
        label: 'State Park'
      };
    default:
      return {
        text: 'text-green-700',
        link: 'text-green-600',
        badge: 'bg-green-100 text-green-700',
        label: 'National Park'
      };
  }
}

/**
 * Park popup content component
 */
function ParkPopupContent({ park, distance, address, isLoading, parkType }) {
  const colors = getParkColors(parkType);
  const parkUrl = getParkUrl(park);

  return (
    <div className="text-center min-w-[180px]">
      <strong className={colors.text}>{park.full_name || park.name}</strong>

      {/* Park type badge */}
      <br />
      <span className={`inline-block px-2 py-0.5 text-xs ${colors.badge} rounded-full mt-1`}>
        {colors.label}
      </span>

      {/* Managing agency for local parks */}
      {park.managing_agency && (
        <>
          <br />
          <span className="text-xs text-gray-500">{park.managing_agency}</span>
        </>
      )}

      {/* Address */}
      {isLoading ? (
        <>
          <br />
          <span className="text-xs text-gray-400 italic">Loading address...</span>
        </>
      ) : address ? (
        <>
          <br />
          <span className="text-sm text-gray-600">📍 {address}</span>
        </>
      ) : park.county && park.state ? (
        <>
          <br />
          <span className="text-sm text-gray-600">{park.county}, {park.state}</span>
        </>
      ) : park.states ? (
        <>
          <br />
          <span className="text-sm text-gray-600">{park.states}</span>
        </>
      ) : null}

      {/* Distance */}
      {distance && (
        <>
          <br />
          <span className="text-sm text-blue-600">{distance} miles away</span>
        </>
      )}

      {/* View details link */}
      <br />
      <a
        href={parkUrl}
        className={`text-sm ${colors.link} hover:underline font-medium`}
      >
        View Details →
      </a>
    </div>
  );
}