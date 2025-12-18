'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Component to auto-fit map bounds to track
 * This is a separate component because useMap hook must be used
 * inside a MapContainer and cannot be dynamically imported.
 */
export default function MapBoundsUpdater({ points, followUser, currentPosition }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (followUser && currentPosition) {
      // Center on current position when following
      map.setView([currentPosition.latitude, currentPosition.longitude], map.getZoom());
    } else if (points.length > 1) {
      // Fit bounds to all points
      const bounds = points.map((p) => [p.latitude, p.longitude]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (points.length === 1) {
      // Center on single point
      map.setView([points[0].latitude, points[0].longitude], 15);
    }
  }, [map, points, followUser, currentPosition]);

  return null;
}
