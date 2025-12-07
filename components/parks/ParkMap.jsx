'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: '/images/marker-icon.png',
  iconRetinaUrl: '/images/marker-icon-2x.png',
  shadowUrl: '/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom park marker icon
const ParkIcon = L.divIcon({
  className: 'custom-park-marker',
  html: `
    <div style="
      background-color: #16a34a;
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg 
        style="transform: rotate(45deg); width: 16px; height: 16px; color: white;"
        fill="currentColor" 
        viewBox="0 0 24 24"
      >
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

/**
 * Custom hook to fetch address for coordinates
 */
function useAddressLookup(latitude, longitude) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAddress = useCallback(async () => {
    if (!latitude || !longitude || address !== null) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }
      const data = await response.json();
      
      if (data.found) {
        // Use the best available address format:
        // 1. formattedAddress if it has street info
        // 2. address.label (full address from HERE API)
        // 3. shortAddress as fallback
        const formattedAddr = data.formattedAddress;
        const label = data.address?.label;
        const shortAddr = data.shortAddress;
        
        // If formattedAddress has a newline, it has street info - use it
        // Otherwise prefer the label which is more descriptive
        if (formattedAddr && formattedAddr.includes('\n')) {
          setAddress(formattedAddr);
        } else if (label) {
          setAddress(label);
        } else {
          setAddress(formattedAddr || shortAddr);
        }
      } else {
        setAddress(null);
      }
    } catch (err) {
      console.error('Error fetching address:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, address]);

  return { address, loading, error, fetchAddress };
}

/**
 * ParkMap component - displays a Leaflet map with park location
 * @param {Object} props
 * @param {number} props.latitude - Park latitude
 * @param {number} props.longitude - Park longitude
 * @param {string} props.parkName - Name of the park
 * @param {number} [props.zoom=10] - Initial zoom level
 * @param {string} [props.className] - Additional CSS classes
 */
export default function ParkMap({
  latitude,
  longitude,
  parkName,
  zoom = 10,
  className = '',
}) {
  const mapRef = useRef(null);
  const { address, loading, fetchAddress } = useAddressLookup(latitude, longitude);

  // Set default icon for all markers
  useEffect(() => {
    L.Marker.prototype.options.icon = DefaultIcon;
  }, []);

  // Fetch address on mount
  useEffect(() => {
    if (latitude && longitude) {
      fetchAddress();
    }
  }, [latitude, longitude, fetchAddress]);

  if (!latitude || !longitude) {
    return (
      <div className={`h-64 md:h-96 bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          Location data not available
        </p>
      </div>
    );
  }

  const position = [latitude, longitude];

  return (
    <div className={`h-64 md:h-96 ${className}`}>
      {/* Address display above map */}
      <div className="bg-white dark:bg-gray-800 rounded-t-lg p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            {loading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">Loading address...</p>
            ) : address ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{address}</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            )}
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          >
            Get Directions →
          </a>
        </div>
      </div>
      
      <MapContainer
        center={position}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-[calc(100%-52px)] w-full rounded-b-lg z-0"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={ParkIcon}>
          <Popup>
            <div className="text-center min-w-[180px]">
              <strong className="text-green-700">{parkName}</strong>
              {address && (
                <>
                  <br />
                  <span className="text-sm text-gray-600 whitespace-pre-line">📍 {address}</span>
                </>
              )}
              <br />
              <span className="text-xs text-gray-500">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
              <br />
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Get Directions
              </a>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

/**
 * ParksMap component - displays multiple parks on a map
 * @param {Object} props
 * @param {Array} props.parks - Array of park objects with latitude, longitude, and name
 * @param {number} [props.zoom=4] - Initial zoom level
 * @param {string} [props.className] - Additional CSS classes
 */
export function ParksMap({ parks = [], zoom = 4, className = '' }) {
  const mapRef = useRef(null);

  // Calculate center from parks or default to US center
  const center = parks.length > 0
    ? [
        parks.reduce((sum, p) => sum + (parseFloat(p.latitude) || 0), 0) / parks.length,
        parks.reduce((sum, p) => sum + (parseFloat(p.longitude) || 0), 0) / parks.length,
      ]
    : [39.8283, -98.5795]; // Center of US

  // Filter parks with valid coordinates
  const validParks = parks.filter(
    (p) => p.latitude && p.longitude && !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude))
  );

  if (validParks.length === 0) {
    return (
      <div className={`h-64 md:h-96 bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          No parks with location data to display
        </p>
      </div>
    );
  }

  return (
    <div className={`h-64 md:h-96 ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full rounded-lg z-0"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validParks.map((park) => (
          <Marker
            key={park.id || park.park_code}
            position={[parseFloat(park.latitude), parseFloat(park.longitude)]}
            icon={ParkIcon}
          >
            <Popup>
              <div className="text-center">
                <strong className="text-green-700">
                  {park.full_name || park.name}
                </strong>
                {park.states && (
                  <>
                    <br />
                    <span className="text-sm text-gray-600">{park.states}</span>
                  </>
                )}
                <br />
                <a
                  href={`/parks/${park.park_code}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Details
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}