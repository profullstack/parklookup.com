/**
 * TripMap Component
 * Interactive map showing all trip stops with markers and route
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import('react-leaflet').then(mod => mod.Polyline),
  { ssr: false }
);
const useMap = dynamic(
  () => import('react-leaflet').then(mod => mod.useMap),
  { ssr: false }
);

/**
 * Create custom numbered marker icon
 * @param {number} number - Day number
 * @returns {Object} Leaflet icon
 */
const createNumberedIcon = (number) => {
  if (typeof window === 'undefined') return null;
  
  const L = require('leaflet');
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white;
      ">${number}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

/**
 * Create origin marker icon
 * @returns {Object} Leaflet icon
 */
const createOriginIcon = () => {
  if (typeof window === 'undefined') return null;
  
  const L = require('leaflet');
  
  return L.divIcon({
    className: 'origin-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">📍</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

/**
 * Calculate map bounds from stops
 * @param {Array} stops - Trip stops
 * @param {Object} origin - Origin coordinates
 * @returns {Array} Bounds array [[minLat, minLng], [maxLat, maxLng]]
 */
const calculateBounds = (stops, origin) => {
  const points = [];
  
  if (origin?.lat && origin?.lng) {
    points.push([origin.lat, origin.lng]);
  }
  
  stops.forEach(stop => {
    if (stop.park?.latitude && stop.park?.longitude) {
      points.push([stop.park.latitude, stop.park.longitude]);
    }
  });
  
  if (points.length === 0) {
    // Default to US center
    return [[25, -125], [50, -65]];
  }
  
  if (points.length === 1) {
    // Single point - create bounds around it
    const [lat, lng] = points[0];
    return [[lat - 1, lng - 1], [lat + 1, lng + 1]];
  }
  
  const lats = points.map(p => p[0]);
  const lngs = points.map(p => p[1]);
  
  const padding = 0.5; // Add some padding
  return [
    [Math.min(...lats) - padding, Math.min(...lngs) - padding],
    [Math.max(...lats) + padding, Math.max(...lngs) + padding],
  ];
};

/**
 * Get route coordinates from stops
 * @param {Array} stops - Trip stops
 * @param {Object} origin - Origin coordinates
 * @returns {Array} Array of [lat, lng] coordinates
 */
const getRouteCoordinates = (stops, origin) => {
  const coords = [];
  
  if (origin?.lat && origin?.lng) {
    coords.push([origin.lat, origin.lng]);
  }
  
  // Sort stops by day number
  const sortedStops = [...stops].sort((a, b) => a.dayNumber - b.dayNumber);
  
  sortedStops.forEach(stop => {
    if (stop.park?.latitude && stop.park?.longitude) {
      coords.push([stop.park.latitude, stop.park.longitude]);
    }
  });
  
  return coords;
};

/**
 * Map bounds fitter component
 * Fits the map to the given bounds after mount
 */
function MapBoundsFitter({ bounds }) {
  const [mapReady, setMapReady] = useState(false);
  
  useEffect(() => {
    // Delay to ensure map is fully rendered
    const timer = setTimeout(() => setMapReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mapReady || typeof window === 'undefined') return;
    
    // Get the map instance from the parent context
    const mapContainer = document.querySelector('.leaflet-container');
    if (mapContainer && mapContainer._leaflet_map) {
      const map = mapContainer._leaflet_map;
      if (bounds && bounds.length === 2) {
        try {
          map.fitBounds(bounds, { padding: [50, 50] });
          map.invalidateSize();
        } catch (e) {
          console.warn('Failed to fit bounds:', e);
        }
      }
    }
  }, [bounds, mapReady]);

  return null;
}

/**
 * TripMap component
 * @param {Object} props - Component props
 * @param {Array} props.stops - Trip stops with park data
 * @param {Object} props.origin - Origin coordinates {lat, lng}
 * @param {string} props.originName - Origin display name
 * @param {string} props.className - Additional CSS classes
 */
export default function TripMap({ stops = [], origin, originName, className = '' }) {
  const [isClient, setIsClient] = useState(false);
  const [icons, setIcons] = useState({ origin: null, numbered: {} });
  const [mapKey, setMapKey] = useState(0);
  const mapRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
    
    // Create icons on client side
    if (typeof window !== 'undefined') {
      const originIcon = createOriginIcon();
      const numberedIcons = {};
      
      stops.forEach(stop => {
        numberedIcons[stop.dayNumber] = createNumberedIcon(stop.dayNumber);
      });
      
      setIcons({ origin: originIcon, numbered: numberedIcons });
    }
  }, [stops]);

  // Force map re-render when stops change
  useEffect(() => {
    if (isClient) {
      setMapKey(prev => prev + 1);
    }
  }, [stops, origin, isClient]);

  // Invalidate map size after render
  useEffect(() => {
    if (!isClient) return;
    
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
      // Also try to find the map via DOM
      const mapContainer = document.querySelector('.leaflet-container');
      if (mapContainer?._leaflet_map) {
        mapContainer._leaflet_map.invalidateSize();
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [isClient, mapKey]);

  // Don't render on server
  if (!isClient) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`} style={{ minHeight: '400px' }}>
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  const bounds = calculateBounds(stops, origin);
  const routeCoords = getRouteCoordinates(stops, origin);
  const sortedStops = [...stops].sort((a, b) => a.dayNumber - b.dayNumber);

  // Calculate center from bounds for initial view
  const center = bounds.length === 2
    ? [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
    : [39.8283, -98.5795]; // US center

  return (
    <div className={`rounded-lg overflow-hidden shadow-md ${className}`}>
      <MapContainer
        key={mapKey}
        center={center}
        zoom={6}
        bounds={bounds}
        scrollWheelZoom={true}
        style={{ height: '400px', width: '100%' }}
        className="z-0"
        whenReady={(map) => {
          mapRef.current = map.target;
          // Fit bounds after map is ready
          setTimeout(() => {
            if (bounds && bounds.length === 2) {
              map.target.fitBounds(bounds, { padding: [50, 50] });
            }
            map.target.invalidateSize();
          }, 100);
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route line */}
        {routeCoords.length > 1 && (
          <Polyline
            positions={routeCoords}
            color="#059669"
            weight={3}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}

        {/* Origin marker */}
        {origin?.lat && origin?.lng && icons.origin && (
          <Marker
            position={[origin.lat, origin.lng]}
            icon={icons.origin}
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold">Starting Point</p>
                <p className="text-sm text-gray-600">{originName || 'Your location'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Stop markers */}
        {sortedStops.map(stop => {
          if (!stop.park?.latitude || !stop.park?.longitude) return null;
          
          const icon = icons.numbered[stop.dayNumber];
          if (!icon) return null;

          return (
            <Marker
              key={stop.id || stop.dayNumber}
              position={[stop.park.latitude, stop.park.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <p className="font-semibold text-green-700">Day {stop.dayNumber}</p>
                  <p className="font-medium">{stop.park.name}</p>
                  {stop.park.designation && (
                    <p className="text-xs text-gray-500">{stop.park.designation}</p>
                  )}
                  {stop.highlights && (
                    <p className="text-sm text-gray-600 mt-1">{stop.highlights}</p>
                  )}
                  {stop.activities && stop.activities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {stop.activities.slice(0, 3).map((activity, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded"
                        >
                          {activity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="bg-white p-3 border-t">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span className="text-gray-600">Start</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-600" />
            <span className="text-gray-600">Park stops</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-600" style={{ borderStyle: 'dashed' }} />
            <span className="text-gray-600">Route</span>
          </div>
        </div>
      </div>
    </div>
  );
}