'use client';

import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom park marker icon
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
 * InteractiveParksMap component - displays parks on a map with user location support
 * @param {Object} props
 * @param {Array} props.parks - Array of park objects
 * @param {Object} props.userLocation - User's location {lat, lng}
 * @param {boolean} props.loading - Loading state
 */
export default function InteractiveParksMap({ parks = [], userLocation = null, loading = false }) {
  const mapRef = useRef(null);

  // Default center (US center)
  const defaultCenter = [39.8283, -98.5795];
  const defaultZoom = 4;

  // Filter parks with valid coordinates
  const validParks = useMemo(() => {
    return parks.filter(
      (p) =>
        p.latitude &&
        p.longitude &&
        !isNaN(parseFloat(p.latitude)) &&
        !isNaN(parseFloat(p.longitude))
    );
  }, [parks]);

  // Filter parks within 100 miles of user location
  const nearbyParks = useMemo(() => {
    if (!userLocation) return validParks;

    return validParks.filter((park) => {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        parseFloat(park.latitude),
        parseFloat(park.longitude)
      );
      return distance <= RADIUS_MILES;
    });
  }, [validParks, userLocation]);

  // Parks to display (nearby if user location set, otherwise all)
  const displayParks = userLocation ? nearbyParks : validParks;

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
          const distance = userLocation
            ? calculateDistance(
                userLocation.lat,
                userLocation.lng,
                parseFloat(park.latitude),
                parseFloat(park.longitude)
              ).toFixed(1)
            : null;

          return (
            <Marker
              key={park.id || park.park_code}
              position={[parseFloat(park.latitude), parseFloat(park.longitude)]}
              icon={ParkIcon}
            >
              <Popup>
                <div className="text-center min-w-[150px]">
                  <strong className="text-green-700">{park.full_name || park.name}</strong>
                  {park.states && (
                    <>
                      <br />
                      <span className="text-sm text-gray-600">{park.states}</span>
                    </>
                  )}
                  {distance && (
                    <>
                      <br />
                      <span className="text-sm text-blue-600">{distance} miles away</span>
                    </>
                  )}
                  <br />
                  <a
                    href={`/parks/${park.park_code}`}
                    className="text-sm text-green-600 hover:underline font-medium"
                  >
                    View Details →
                  </a>
                </div>
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