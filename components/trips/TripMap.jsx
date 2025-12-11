/**
 * TripMap Component
 * Interactive map showing all trip stops with markers and route
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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

/**
 * Create custom numbered marker icon
 * @param {number} number - Day number
 * @returns {Object} Leaflet icon
 */
const createNumberedIcon = (number) => {
  if (typeof window === 'undefined') {return null;}
  
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
  if (typeof window === 'undefined') {return null;}
  
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
 * Get waypoint coordinates from stops (for routing API)
 * @param {Array} stops - Trip stops
 * @param {Object} origin - Origin coordinates
 * @returns {Array} Array of {lat, lng} coordinates
 */
const getWaypoints = (stops, origin) => {
  const waypoints = [];
  
  if (origin?.lat && origin?.lng) {
    waypoints.push({ lat: origin.lat, lng: origin.lng });
  }
  
  // Sort stops by day number
  const sortedStops = [...stops].sort((a, b) => a.dayNumber - b.dayNumber);
  
  sortedStops.forEach(stop => {
    if (stop.park?.latitude && stop.park?.longitude) {
      waypoints.push({ lat: stop.park.latitude, lng: stop.park.longitude });
    }
  });
  
  return waypoints;
};

/**
 * Get straight-line route coordinates (fallback)
 * @param {Array} stops - Trip stops
 * @param {Object} origin - Origin coordinates
 * @returns {Array} Array of [lat, lng] coordinates
 */
const getStraightLineCoordinates = (stops, origin) => {
  const waypoints = getWaypoints(stops, origin);
  return waypoints.map(wp => [wp.lat, wp.lng]);
};

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
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [routeError, setRouteError] = useState(null);
  const mapRef = useRef(null);

  // Fetch route from OSRM API
  const fetchRoute = useCallback(async (waypoints) => {
    if (waypoints.length < 2) {
      setRouteCoordinates([]);
      return;
    }

    setRouteLoading(true);
    setRouteError(null);

    try {
      // Format waypoints for API: lng,lat;lng,lat;...
      const waypointsStr = waypoints
        .map(wp => `${wp.lng},${wp.lat}`)
        .join(';');

      const response = await fetch(`/api/route?waypoints=${waypointsStr}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch route');
      }

      const data = await response.json();
      
      if (data.success && data.route?.coordinates) {
        setRouteCoordinates(data.route.coordinates);
        setRouteInfo(data.route.summary);
      } else {
        // Fallback to straight lines
        setRouteCoordinates(waypoints.map(wp => [wp.lat, wp.lng]));
      }
    } catch (error) {
      console.warn('Route fetch failed, using straight lines:', error);
      setRouteError(error.message);
      // Fallback to straight lines
      setRouteCoordinates(waypoints.map(wp => [wp.lat, wp.lng]));
    } finally {
      setRouteLoading(false);
    }
  }, []);

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

  // Fetch route when stops or origin change
  useEffect(() => {
    if (!isClient) {return;}
    
    const waypoints = getWaypoints(stops, origin);
    if (waypoints.length >= 2) {
      fetchRoute(waypoints);
    } else {
      setRouteCoordinates([]);
    }
  }, [stops, origin, isClient, fetchRoute]);

  // Force map re-render when stops change
  useEffect(() => {
    if (isClient) {
      setMapKey(prev => prev + 1);
    }
  }, [stops, origin, isClient]);

  // Invalidate map size after render
  useEffect(() => {
    if (!isClient) {return;}
    
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
  const sortedStops = [...stops].sort((a, b) => a.dayNumber - b.dayNumber);
  
  // Use fetched route or fallback to straight lines
  const displayRoute = routeCoordinates.length > 0
    ? routeCoordinates
    : getStraightLineCoordinates(stops, origin);

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

        {/* Route line - solid for actual route, dashed for straight line fallback */}
        {displayRoute.length > 1 && (
          <Polyline
            positions={displayRoute}
            color="#059669"
            weight={4}
            opacity={0.8}
            dashArray={routeCoordinates.length > 0 ? undefined : "10, 10"}
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
          if (!stop.park?.latitude || !stop.park?.longitude) {return null;}
          
          const icon = icons.numbered[stop.dayNumber];
          if (!icon) {return null;}

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

      {/* Legend and Route Info */}
      <div className="bg-white p-3 border-t">
        <div className="flex flex-wrap items-center justify-between gap-4">
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
              <div
                className="w-8 h-1 bg-green-600 rounded"
                style={{
                  borderStyle: routeCoordinates.length > 0 ? 'solid' : 'dashed',
                  borderWidth: routeCoordinates.length > 0 ? 0 : '2px',
                  borderColor: '#059669',
                  height: routeCoordinates.length > 0 ? '4px' : '0',
                }}
              />
              <span className="text-gray-600">
                {routeCoordinates.length > 0 ? 'Driving route' : 'Route (approx)'}
              </span>
            </div>
          </div>
          
          {/* Route summary */}
          {routeInfo && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span>🚗</span>
                <span>{routeInfo.distanceMiles} mi</span>
              </span>
              <span className="flex items-center gap-1">
                <span>⏱️</span>
                <span>{routeInfo.durationHours} hrs</span>
              </span>
            </div>
          )}
          
          {/* Loading indicator */}
          {routeLoading && (
            <span className="text-sm text-gray-500 animate-pulse">
              Loading route...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}