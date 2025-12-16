'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Difficulty colors for trail lines
 */
const DIFFICULTY_COLORS = {
  easy: '#16a34a', // green-600
  moderate: '#2563eb', // blue-600
  hard: '#dc2626', // red-600
  default: '#6b7280', // gray-500
};

/**
 * TrailMap component - displays trails on a MapLibre GL map
 *
 * @param {Object} props
 * @param {Array} props.trails - Array of trail objects with geometry
 * @param {Object} props.center - Map center {lat, lng}
 * @param {number} props.zoom - Initial zoom level
 * @param {Function} props.onTrailClick - Callback when a trail is clicked
 * @param {string} props.selectedTrailId - ID of currently selected trail
 * @param {string} props.className - Additional CSS classes
 */
export default function TrailMap({
  trails = [],
  center,
  zoom = 12,
  onTrailClick,
  selectedTrailId,
  className = '',
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [maplibregl, setMaplibregl] = useState(null);

  // Dynamically import maplibre-gl to avoid SSR issues
  useEffect(() => {
    import('maplibre-gl').then((module) => {
      setMaplibregl(module.default);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!maplibregl || !mapContainer.current || map.current) return;

    // Calculate center from trails if not provided
    let mapCenter = center;
    if (!mapCenter && trails.length > 0) {
      const firstTrail = trails.find((t) => t.geometry || t.geometry_geojson);
      if (firstTrail) {
        const geom =
          typeof firstTrail.geometry === 'string'
            ? JSON.parse(firstTrail.geometry)
            : firstTrail.geometry ||
              (firstTrail.geometry_geojson
                ? JSON.parse(firstTrail.geometry_geojson)
                : null);

        if (geom?.coordinates?.length > 0) {
          const [lng, lat] = geom.coordinates[0];
          mapCenter = { lat, lng };
        }
      }
    }

    // Default center (US center)
    if (!mapCenter) {
      mapCenter = { lat: 39.8283, lng: -98.5795 };
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [mapCenter.lng, mapCenter.lat],
      zoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [maplibregl, center, zoom, trails]);

  // Add trails to map
  useEffect(() => {
    if (!map.current || !mapLoaded || trails.length === 0) return;

    // Remove existing trail layers and sources
    ['trails-easy', 'trails-moderate', 'trails-hard', 'trails-default'].forEach((id) => {
      if (map.current.getLayer(id)) {
        map.current.removeLayer(id);
      }
    });
    if (map.current.getSource('trails')) {
      map.current.removeSource('trails');
    }

    // Convert trails to GeoJSON FeatureCollection
    const features = trails
      .map((trail) => {
        let geometry;

        if (trail.geometry) {
          geometry =
            typeof trail.geometry === 'string' ? JSON.parse(trail.geometry) : trail.geometry;
        } else if (trail.geometry_geojson) {
          geometry =
            typeof trail.geometry_geojson === 'string'
              ? JSON.parse(trail.geometry_geojson)
              : trail.geometry_geojson;
        }

        if (!geometry) return null;

        return {
          type: 'Feature',
          properties: {
            id: trail.id,
            name: trail.name || 'Unnamed Trail',
            difficulty: trail.difficulty || 'default',
            length_meters: trail.length_meters,
            slug: trail.slug,
          },
          geometry,
        };
      })
      .filter(Boolean);

    if (features.length === 0) return;

    const geojson = {
      type: 'FeatureCollection',
      features,
    };

    // Add source
    map.current.addSource('trails', {
      type: 'geojson',
      data: geojson,
    });

    // Add layers for each difficulty level
    Object.entries(DIFFICULTY_COLORS).forEach(([difficulty, color]) => {
      const layerId = `trails-${difficulty}`;

      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: 'trails',
        filter: ['==', ['get', 'difficulty'], difficulty],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': [
            'case',
            ['==', ['get', 'id'], selectedTrailId || ''],
            5,
            3,
          ],
          'line-opacity': [
            'case',
            ['==', ['get', 'id'], selectedTrailId || ''],
            1,
            0.8,
          ],
        },
      });

      // Add click handler
      map.current.on('click', layerId, (e) => {
        if (e.features.length > 0 && onTrailClick) {
          const feature = e.features[0];
          onTrailClick({
            id: feature.properties.id,
            name: feature.properties.name,
            difficulty: feature.properties.difficulty,
            length_meters: feature.properties.length_meters,
            slug: feature.properties.slug,
          });
        }
      });

      // Change cursor on hover
      map.current.on('mouseenter', layerId, () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', layerId, () => {
        map.current.getCanvas().style.cursor = '';
      });
    });

    // Fit bounds to show all trails
    if (features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();

      features.forEach((feature) => {
        if (feature.geometry.coordinates) {
          feature.geometry.coordinates.forEach((coord) => {
            bounds.extend(coord);
          });
        }
      });

      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
      });
    }
  }, [mapLoaded, trails, selectedTrailId, onTrailClick, maplibregl]);

  // Update selected trail styling
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    Object.keys(DIFFICULTY_COLORS).forEach((difficulty) => {
      const layerId = `trails-${difficulty}`;
      if (map.current.getLayer(layerId)) {
        map.current.setPaintProperty(layerId, 'line-width', [
          'case',
          ['==', ['get', 'id'], selectedTrailId || ''],
          5,
          3,
        ]);
        map.current.setPaintProperty(layerId, 'line-opacity', [
          'case',
          ['==', ['get', 'id'], selectedTrailId || ''],
          1,
          0.8,
        ]);
      }
    });
  }, [selectedTrailId, mapLoaded]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full min-h-[400px] rounded-lg" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Trail Difficulty
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: DIFFICULTY_COLORS.easy }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">Easy</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: DIFFICULTY_COLORS.moderate }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: DIFFICULTY_COLORS.hard }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">Hard</span>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading map...</p>
          </div>
        </div>
      )}

      {/* MapLibre GL CSS */}
      <style jsx global>{`
        @import 'maplibre-gl/dist/maplibre-gl.css';
      `}</style>
    </div>
  );
}

/**
 * TrailMapSkeleton - Loading placeholder for TrailMap
 */
export function TrailMapSkeleton({ className = '' }) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse min-h-[400px] ${className}`}
    >
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500">Loading map...</p>
      </div>
    </div>
  );
}