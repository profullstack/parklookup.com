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
 * BLM land styling colors
 */
const BLM_COLORS = {
  fill: 'rgba(217, 119, 6, 0.2)', // amber-600 with transparency
  stroke: 'rgba(217, 119, 6, 0.8)', // amber-600
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
 * @param {boolean} props.showBLMToggle - Whether to show BLM land layer toggle
 * @param {string} props.parkCode - Park code for fetching nearby BLM lands
 */
export default function TrailMap({
  trails = [],
  center,
  zoom = 12,
  onTrailClick,
  selectedTrailId,
  className = '',
  showBLMToggle = false,
  parkCode = null,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [maplibregl, setMaplibregl] = useState(null);
  const [showBLMLands, setShowBLMLands] = useState(false);
  const [blmLands, setBLMLands] = useState([]);
  const [loadingBLM, setLoadingBLM] = useState(false);

  // Dynamically import maplibre-gl to avoid SSR issues
  useEffect(() => {
    import('maplibre-gl').then((module) => {
      setMaplibregl(module.default);
    });
  }, []);

  /**
   * Validate that a coordinate is a valid number
   */
  const isValidCoord = (coord) => {
    return Array.isArray(coord) &&
           coord.length >= 2 &&
           typeof coord[0] === 'number' &&
           typeof coord[1] === 'number' &&
           !isNaN(coord[0]) &&
           !isNaN(coord[1]) &&
           isFinite(coord[0]) &&
           isFinite(coord[1]);
  };

  // Initialize map
  useEffect(() => {
    if (!maplibregl || !mapContainer.current || map.current) return;

    // Calculate center from trails if not provided
    let mapCenter = center;
    if (!mapCenter && trails.length > 0) {
      const firstTrail = trails.find((t) => t.geometry || t.geometry_geojson || t.geojson);
      if (firstTrail) {
        let geom = null;
        try {
          if (firstTrail.geometry) {
            geom = typeof firstTrail.geometry === 'string'
              ? JSON.parse(firstTrail.geometry)
              : firstTrail.geometry;
          } else if (firstTrail.geometry_geojson) {
            geom = typeof firstTrail.geometry_geojson === 'string'
              ? JSON.parse(firstTrail.geometry_geojson)
              : firstTrail.geometry_geojson;
          } else if (firstTrail.geojson) {
            geom = typeof firstTrail.geojson === 'string'
              ? JSON.parse(firstTrail.geojson)
              : firstTrail.geojson;
          }
        } catch (e) {
          console.warn('Failed to parse trail geometry:', e);
        }

        if (geom?.coordinates?.length > 0) {
          const firstCoord = geom.coordinates[0];
          if (isValidCoord(firstCoord)) {
            const [lng, lat] = firstCoord;
            mapCenter = { lat, lng };
          }
        }
      }
    }

    // Default center (US center) - validate before using
    if (!mapCenter || isNaN(mapCenter.lat) || isNaN(mapCenter.lng)) {
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
        let geometry = null;

        try {
          if (trail.geometry) {
            geometry =
              typeof trail.geometry === 'string' ? JSON.parse(trail.geometry) : trail.geometry;
          } else if (trail.geometry_geojson) {
            geometry =
              typeof trail.geometry_geojson === 'string'
                ? JSON.parse(trail.geometry_geojson)
                : trail.geometry_geojson;
          } else if (trail.geojson) {
            geometry =
              typeof trail.geojson === 'string' ? JSON.parse(trail.geojson) : trail.geojson;
          }
        } catch (e) {
          console.warn('Failed to parse trail geometry:', e);
          return null;
        }

        if (!geometry || !geometry.coordinates) return null;

        // Validate that geometry has valid coordinates
        const hasValidCoords = geometry.coordinates.some((coord) => isValidCoord(coord));
        if (!hasValidCoords) {
          console.warn('Trail has no valid coordinates:', trail.name || trail.id);
          return null;
        }

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
      let hasValidBounds = false;

      features.forEach((feature) => {
        if (feature.geometry?.coordinates) {
          feature.geometry.coordinates.forEach((coord) => {
            // Validate coordinate before extending bounds
            if (isValidCoord(coord)) {
              bounds.extend(coord);
              hasValidBounds = true;
            }
          });
        }
      });

      // Only fit bounds if we have valid coordinates
      if (hasValidBounds && !bounds.isEmpty()) {
        try {
          map.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 14,
          });
        } catch (e) {
          console.warn('Failed to fit bounds:', e);
        }
      }
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

  // Fetch BLM lands when toggle is enabled
  useEffect(() => {
    if (!showBLMLands || !parkCode || blmLands.length > 0) return;

    const fetchBLMLands = async () => {
      setLoadingBLM(true);
      try {
        const response = await fetch(`/api/parks/${parkCode}/blm?limit=50`);
        if (response.ok) {
          const data = await response.json();
          setBLMLands(data.blmLands || []);
        }
      } catch (error) {
        console.error('Error fetching BLM lands:', error);
      } finally {
        setLoadingBLM(false);
      }
    };

    fetchBLMLands();
  }, [showBLMLands, parkCode, blmLands.length]);

  // Add/remove BLM land layer
  useEffect(() => {
    if (!map.current || !mapLoaded || !maplibregl) return;

    // Remove existing BLM layers
    if (map.current.getLayer('blm-lands-fill')) {
      map.current.removeLayer('blm-lands-fill');
    }
    if (map.current.getLayer('blm-lands-outline')) {
      map.current.removeLayer('blm-lands-outline');
    }
    if (map.current.getSource('blm-lands')) {
      map.current.removeSource('blm-lands');
    }

    if (!showBLMLands || blmLands.length === 0) return;

    // Convert BLM lands to GeoJSON
    const features = blmLands
      .map((land) => {
        let geometry = null;
        
        // Handle different geometry formats
        if (land.geojson) {
          geometry = typeof land.geojson === 'string' ? JSON.parse(land.geojson) : land.geojson;
        } else if (land.geometry) {
          geometry = typeof land.geometry === 'string' ? JSON.parse(land.geometry) : land.geometry;
        }

        if (!geometry) return null;

        return {
          type: 'Feature',
          properties: {
            id: land.id,
            name: land.unit_name || land.unitName || 'BLM Land',
            state: land.state,
            area_acres: land.area_acres || land.areaAcres,
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
    map.current.addSource('blm-lands', {
      type: 'geojson',
      data: geojson,
    });

    // Add fill layer (below trails)
    map.current.addLayer(
      {
        id: 'blm-lands-fill',
        type: 'fill',
        source: 'blm-lands',
        paint: {
          'fill-color': BLM_COLORS.fill,
          'fill-opacity': 0.6,
        },
      },
      'trails-easy' // Insert below trail layers
    );

    // Add outline layer
    map.current.addLayer(
      {
        id: 'blm-lands-outline',
        type: 'line',
        source: 'blm-lands',
        paint: {
          'line-color': BLM_COLORS.stroke,
          'line-width': 2,
        },
      },
      'trails-easy' // Insert below trail layers
    );

    // Add hover popup for BLM lands
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.current.on('mouseenter', 'blm-lands-fill', (e) => {
      map.current.getCanvas().style.cursor = 'pointer';
      
      if (e.features.length > 0) {
        const feature = e.features[0];
        const name = feature.properties.name;
        const state = feature.properties.state;
        const area = feature.properties.area_acres;
        
        let html = `<div class="p-2"><strong class="text-amber-700">${name}</strong>`;
        if (state) html += `<br><span class="text-gray-600">${state}</span>`;
        if (area) html += `<br><span class="text-gray-500 text-sm">${Math.round(area).toLocaleString()} acres</span>`;
        html += `<br><span class="text-xs text-gray-400">Bureau of Land Management</span></div>`;
        
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map.current);
      }
    });

    map.current.on('mouseleave', 'blm-lands-fill', () => {
      map.current.getCanvas().style.cursor = '';
      popup.remove();
    });
  }, [mapLoaded, showBLMLands, blmLands, maplibregl]);

  // Toggle BLM lands visibility
  const handleBLMToggle = useCallback(() => {
    setShowBLMLands((prev) => !prev);
  }, []);

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

        {/* BLM Land Legend (when visible) */}
        {showBLMToggle && showBLMLands && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-3 rounded border"
                style={{
                  backgroundColor: BLM_COLORS.fill,
                  borderColor: BLM_COLORS.stroke,
                }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">BLM Land</span>
            </div>
          </>
        )}
      </div>

      {/* BLM Toggle Button */}
      {showBLMToggle && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <button
            onClick={handleBLMToggle}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              showBLMLands
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            disabled={loadingBLM}
          >
            {loadingBLM ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600" />
            ) : (
              <svg
                className="w-4 h-4"
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
            )}
            <span>BLM Land</span>
            {showBLMLands && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      )}

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