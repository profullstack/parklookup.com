'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getActivityColor, getActivityIcon } from '@/lib/tracking/activity-detection';
import { formatDistance, formatDuration, formatSpeed } from '@/lib/tracking/track-stats';

/**
 * Component to handle map bounds updates
 */
function MapBoundsUpdater({ points, followUser, currentPosition }) {
  const map = useMap();

  useEffect(() => {
    if (followUser && currentPosition) {
      map.setView([currentPosition.latitude, currentPosition.longitude], map.getZoom(), {
        animate: true,
      });
    } else if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points, followUser, currentPosition]);

  return null;
}

/**
 * Live Track Map Component
 * Displays the track route on a map during and after tracking
 *
 * @param {Object} props
 * @param {Array} props.points - Array of GPS points with latitude, longitude, altitude, speed
 * @param {Object} [props.currentPosition] - Current user position (for live tracking)
 * @param {string} [props.activityType] - Activity type for styling
 * @param {Object} [props.stats] - Track statistics
 * @param {boolean} [props.isLive] - Whether this is a live tracking session
 * @param {boolean} [props.showStats] - Whether to show stats overlay
 * @param {boolean} [props.followUser] - Whether to follow user position
 * @param {string} [props.className] - Additional CSS classes
 * @param {Object} [props.geometry] - GeoJSON geometry (for completed tracks)
 * @param {Array} [props.media] - Media items with geolocation
 */
export default function LiveTrackMap({
  points = [],
  currentPosition,
  activityType = 'walking',
  stats,
  isLive = false,
  showStats = true,
  followUser = true,
  className = '',
  geometry,
  media = [],
}) {
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);

  // Convert points to coordinates for polyline
  const coordinates = useMemo(() => {
    if (geometry?.coordinates) {
      // Use GeoJSON geometry if available (for completed tracks)
      return geometry.coordinates.map((coord) => [coord[1], coord[0]]); // [lat, lng]
    }
    return points.map((p) => [p.latitude, p.longitude]);
  }, [points, geometry]);

  // Get track color based on activity
  const trackColor = useMemo(() => getActivityColor(activityType), [activityType]);

  // Calculate center point
  const center = useMemo(() => {
    if (currentPosition) {
      return [currentPosition.latitude, currentPosition.longitude];
    }
    if (coordinates.length > 0) {
      const midIndex = Math.floor(coordinates.length / 2);
      return coordinates[midIndex];
    }
    return [37.7749, -122.4194]; // Default to San Francisco
  }, [coordinates, currentPosition]);

  // Start and end points
  const startPoint = coordinates.length > 0 ? coordinates[0] : null;
  const endPoint = coordinates.length > 1 ? coordinates[coordinates.length - 1] : null;

  // Media markers with geolocation
  const geotaggedMedia = useMemo(() => {
    return media.filter((m) => m.latitude && m.longitude);
  }, [media]);

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden">
        <MapContainer
          center={center}
          zoom={15}
          scrollWheelZoom={true}
          className="w-full h-full z-0"
          ref={mapRef}
          whenReady={() => setMapReady(true)}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Track polyline */}
          {coordinates.length > 1 && (
            <Polyline
              positions={coordinates}
              pathOptions={{
                color: trackColor,
                weight: 4,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Start marker */}
          {startPoint && (
            <CircleMarker
              center={startPoint}
              radius={8}
              pathOptions={{
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-center">
                  <span className="font-semibold">Start</span>
                  {stats?.started_at && (
                    <p className="text-xs text-gray-500">
                      {new Date(stats.started_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* End marker (only for completed tracks) */}
          {endPoint && !isLive && (
            <CircleMarker
              center={endPoint}
              radius={8}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-center">
                  <span className="font-semibold">End</span>
                  {stats?.ended_at && (
                    <p className="text-xs text-gray-500">
                      {new Date(stats.ended_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* Current position marker (for live tracking) */}
          {isLive && currentPosition && (
            <CircleMarker
              center={[currentPosition.latitude, currentPosition.longitude]}
              radius={10}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.8,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-center">
                  <span className="font-semibold">Current Position</span>
                  {currentPosition.speed && (
                    <p className="text-xs text-gray-500">
                      {formatSpeed(currentPosition.speed)}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* Accuracy circle (for live tracking) */}
          {isLive && currentPosition?.accuracy && currentPosition.accuracy < 100 && (
            <CircleMarker
              center={[currentPosition.latitude, currentPosition.longitude]}
              radius={Math.min(currentPosition.accuracy / 10, 30)}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
          )}

          {/* Media markers */}
          {geotaggedMedia.map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.latitude, item.longitude]}
              radius={6}
              pathOptions={{
                color: '#8b5cf6',
                fillColor: '#8b5cf6',
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-center max-w-[200px]">
                  {item.thumbnail_url && (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title || 'Track photo'}
                      className="w-full h-auto rounded mb-2"
                    />
                  )}
                  {item.title && <p className="font-semibold text-sm">{item.title}</p>}
                  {item.captured_at && (
                    <p className="text-xs text-gray-500">
                      {new Date(item.captured_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Map bounds updater */}
          {mapReady && (
            <MapBoundsUpdater
              points={points}
              followUser={followUser && isLive}
              currentPosition={currentPosition}
            />
          )}
        </MapContainer>
      </div>

      {/* Stats Overlay */}
      {showStats && stats && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-[1000]">
          <div className="flex items-center justify-between gap-4">
            {/* Activity Icon */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getActivityIcon(activityType)}</span>
              <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
                {activityType}
              </span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              {/* Distance */}
              {stats.distance_meters !== undefined && (
                <div className="text-center">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {formatDistance(stats.distance_meters)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                </div>
              )}

              {/* Duration */}
              {stats.duration_seconds !== undefined && (
                <div className="text-center">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {formatDuration(stats.duration_seconds)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                </div>
              )}

              {/* Elevation Gain */}
              {stats.elevation_gain_m !== undefined && stats.elevation_gain_m > 0 && (
                <div className="text-center">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {Math.round(stats.elevation_gain_m)} m
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Elevation</p>
                </div>
              )}

              {/* Current Speed (live only) */}
              {isLive && currentPosition?.speed !== undefined && (
                <div className="text-center">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {formatSpeed(currentPosition.speed)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Speed</p>
                </div>
              )}
            </div>

            {/* Live indicator */}
            {isLive && (
              <div className="flex items-center gap-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-xs font-medium text-red-600 dark:text-red-400">LIVE</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {coordinates.length === 0 && !isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-gray-800/80 z-[1000]">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-400 mb-2"
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
            <p className="text-gray-500 dark:text-gray-400">No track data available</p>
          </div>
        </div>
      )}

      {/* Waiting for GPS (live tracking) */}
      {isLive && coordinates.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-gray-800/80 z-[1000]">
          <div className="text-center">
            <div className="animate-pulse">
              <svg
                className="w-12 h-12 mx-auto text-blue-500 mb-2"
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
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Acquiring GPS signal...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Please ensure location services are enabled
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
