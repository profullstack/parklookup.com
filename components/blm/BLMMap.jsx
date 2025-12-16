'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * BLM land color scheme for map
 */
const BLM_MAP_COLORS = {
  fill: 'rgba(217, 119, 6, 0.2)', // amber-600 with transparency
  stroke: 'rgba(217, 119, 6, 0.8)', // amber-600
  fillHover: 'rgba(217, 119, 6, 0.4)',
  strokeHover: 'rgba(180, 83, 9, 1)', // amber-700
};

/**
 * BLMMap component - displays BLM lands on a MapLibre GL map
 *
 * @param {Object} props
 * @param {Array} props.blmLands - Array of BLM land objects with geojson
 * @param {Object} props.center - Map center {lat, lng}
 * @param {number} props.zoom - Initial zoom level
 * @param {Function} props.onBLMClick - Callback when a BLM land is clicked
 * @param {string} props.selectedBLMId - ID of currently selected BLM land
 * @param {boolean} props.showLegend - Show map legend
 * @param {string} props.className - Additional CSS classes
 */
export default function BLMMap({
  blmLands = [],
  center,
  zoom = 10,
  onBLMClick,
  selectedBLMId,
  showLegend = true,
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

    // Calculate center from BLM lands if not provided
    let mapCenter = center;
    if (!mapCenter && blmLands.length > 0) {
      const firstBLM = blmLands.find((b) => b.geojson || b.geometry_geojson);
      if (firstBLM) {
        const geom = firstBLM.geojson || 
          (firstBLM.geometry_geojson ? JSON.parse(firstBLM.geometry_geojson) : null);
        
        if (geom) {
          // Get centroid from first polygon
          const coords = geom.type === 'MultiPolygon' 
            ? geom.coordinates[0][0] 
            : geom.coordinates[0];
          if (coords && coords.length > 0) {
            // Simple centroid calculation
            let sumLng = 0, sumLat = 0;
            coords.forEach(([lng, lat]) => {
              sumLng += lng;
              sumLat += lat;
            });
            mapCenter = {
              lat: sumLat / coords.length,
              lng: sumLng / coords.length,
            };
          }
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
  }, [maplibregl, center, zoom, blmLands]);

  // Add BLM lands to map
  useEffect(() => {
    if (!map.current || !mapLoaded || blmLands.length === 0) return;

    // Remove existing BLM layers and sources
    if (map.current.getLayer('blm-fill')) {
      map.current.removeLayer('blm-fill');
    }
    if (map.current.getLayer('blm-outline')) {
      map.current.removeLayer('blm-outline');
    }
    if (map.current.getSource('blm-lands')) {
      map.current.removeSource('blm-lands');
    }

    // Convert BLM lands to GeoJSON FeatureCollection
    const features = blmLands
      .map((blm) => {
        let geometry = blm.geojson;
        
        if (!geometry && blm.geometry_geojson) {
          geometry = typeof blm.geometry_geojson === 'string'
            ? JSON.parse(blm.geometry_geojson)
            : blm.geometry_geojson;
        }

        if (!geometry) return null;

        return {
          type: 'Feature',
          properties: {
            id: blm.id,
            name: blm.unitName || blm.unit_name || 'BLM Land',
            state: blm.state,
            area_acres: blm.areaAcres || blm.area_acres,
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

    // Add fill layer
    map.current.addLayer({
      id: 'blm-fill',
      type: 'fill',
      source: 'blm-lands',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'id'], selectedBLMId || ''],
          BLM_MAP_COLORS.fillHover,
          BLM_MAP_COLORS.fill,
        ],
        'fill-opacity': 0.6,
      },
    });

    // Add outline layer
    map.current.addLayer({
      id: 'blm-outline',
      type: 'line',
      source: 'blm-lands',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'id'], selectedBLMId || ''],
          BLM_MAP_COLORS.strokeHover,
          BLM_MAP_COLORS.stroke,
        ],
        'line-width': [
          'case',
          ['==', ['get', 'id'], selectedBLMId || ''],
          3,
          1.5,
        ],
      },
    });

    // Add click handler
    map.current.on('click', 'blm-fill', (e) => {
      if (e.features.length > 0 && onBLMClick) {
        const feature = e.features[0];
        onBLMClick({
          id: feature.properties.id,
          name: feature.properties.name,
          state: feature.properties.state,
          area_acres: feature.properties.area_acres,
        });
      }
    });

    // Add hover effects
    map.current.on('mouseenter', 'blm-fill', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'blm-fill', () => {
      map.current.getCanvas().style.cursor = '';
    });

    // Add popup on hover
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.current.on('mousemove', 'blm-fill', (e) => {
      if (e.features.length > 0) {
        const feature = e.features[0];
        const name = feature.properties.name;
        const state = feature.properties.state;
        const area = feature.properties.area_acres;
        
        let areaText = '';
        if (area) {
          if (area >= 1000) {
            areaText = `${(area / 1000).toFixed(1)}K acres`;
          } else {
            areaText = `${Math.round(area).toLocaleString()} acres`;
          }
        }

        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-2">
              <div class="font-semibold text-amber-700">${name}</div>
              ${state ? `<div class="text-sm text-gray-600">${state}</div>` : ''}
              ${areaText ? `<div class="text-sm text-gray-500">${areaText}</div>` : ''}
            </div>
          `)
          .addTo(map.current);
      }
    });

    map.current.on('mouseleave', 'blm-fill', () => {
      popup.remove();
    });

    // Fit bounds to show all BLM lands
    if (features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();

      features.forEach((feature) => {
        const addCoords = (coords) => {
          if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            coords.forEach((coord) => bounds.extend(coord));
          } else {
            coords.forEach((c) => addCoords(c));
          }
        };

        if (feature.geometry.coordinates) {
          addCoords(feature.geometry.coordinates);
        }
      });

      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 12,
      });
    }
  }, [mapLoaded, blmLands, selectedBLMId, onBLMClick, maplibregl]);

  // Update selected BLM styling
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer('blm-fill')) {
      map.current.setPaintProperty('blm-fill', 'fill-color', [
        'case',
        ['==', ['get', 'id'], selectedBLMId || ''],
        BLM_MAP_COLORS.fillHover,
        BLM_MAP_COLORS.fill,
      ]);
    }

    if (map.current.getLayer('blm-outline')) {
      map.current.setPaintProperty('blm-outline', 'line-color', [
        'case',
        ['==', ['get', 'id'], selectedBLMId || ''],
        BLM_MAP_COLORS.strokeHover,
        BLM_MAP_COLORS.stroke,
      ]);
      map.current.setPaintProperty('blm-outline', 'line-width', [
        'case',
        ['==', ['get', 'id'], selectedBLMId || ''],
        3,
        1.5,
      ]);
    }
  }, [selectedBLMId, mapLoaded]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full min-h-[400px] rounded-lg" />

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            BLM Land
          </p>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-4 rounded border"
              style={{
                backgroundColor: BLM_MAP_COLORS.fill,
                borderColor: BLM_MAP_COLORS.stroke,
              }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Bureau of Land Management
            </span>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading map...</p>
          </div>
        </div>
      )}

      {/* MapLibre GL CSS */}
      <style jsx global>{`
        @import 'maplibre-gl/dist/maplibre-gl.css';
        
        .maplibregl-popup-content {
          padding: 0;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}

/**
 * BLMMapSkeleton - Loading placeholder for BLMMap
 */
export function BLMMapSkeleton({ className = '' }) {
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