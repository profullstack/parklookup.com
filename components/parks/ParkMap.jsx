'use client';

import { useEffect, useRef } from 'react';
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

  // Set default icon for all markers
  useEffect(() => {
    L.Marker.prototype.options.icon = DefaultIcon;
  }, []);

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
      <MapContainer
        center={position}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full rounded-lg z-0"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={ParkIcon}>
          <Popup>
            <div className="text-center">
              <strong className="text-green-700">{parkName}</strong>
              <br />
              <span className="text-sm text-gray-600">
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