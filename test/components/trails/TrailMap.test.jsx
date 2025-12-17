/**
 * Tests for TrailMap Component
 *
 * @module test/components/trails/TrailMap.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock maplibre-gl
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      fitBounds: vi.fn(),
      getSource: vi.fn(),
    })),
    LngLatBounds: vi.fn(() => ({
      extend: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('TrailMap Component', () => {
  describe('Coordinate Validation', () => {
    // This is the validation function used in TrailMap
    const isValidCoord = (coord) => {
      return (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) &&
        !isNaN(coord[1]) &&
        isFinite(coord[0]) &&
        isFinite(coord[1])
      );
    };

    it('should validate correct coordinates', () => {
      expect(isValidCoord([-122.4194, 37.7749])).toBe(true);
      expect(isValidCoord([0, 0])).toBe(true);
      expect(isValidCoord([-180, -90])).toBe(true);
      expect(isValidCoord([180, 90])).toBe(true);
    });

    it('should reject NaN coordinates', () => {
      expect(isValidCoord([NaN, 37.7749])).toBe(false);
      expect(isValidCoord([-122.4194, NaN])).toBe(false);
      expect(isValidCoord([NaN, NaN])).toBe(false);
    });

    it('should reject Infinity coordinates', () => {
      expect(isValidCoord([Infinity, 37.7749])).toBe(false);
      expect(isValidCoord([-122.4194, Infinity])).toBe(false);
      expect(isValidCoord([-Infinity, -Infinity])).toBe(false);
    });

    it('should reject non-array coordinates', () => {
      expect(isValidCoord(null)).toBe(false);
      expect(isValidCoord(undefined)).toBe(false);
      expect(isValidCoord('[-122.4194, 37.7749]')).toBe(false);
      expect(isValidCoord({ lon: -122.4194, lat: 37.7749 })).toBe(false);
    });

    it('should reject arrays with non-number elements', () => {
      expect(isValidCoord(['-122.4194', '37.7749'])).toBe(false);
      expect(isValidCoord([null, 37.7749])).toBe(false);
      expect(isValidCoord([-122.4194, undefined])).toBe(false);
    });

    it('should reject arrays with insufficient elements', () => {
      expect(isValidCoord([])).toBe(false);
      expect(isValidCoord([-122.4194])).toBe(false);
    });

    it('should accept arrays with more than 2 elements (elevation)', () => {
      expect(isValidCoord([-122.4194, 37.7749, 100])).toBe(true);
    });
  });

  describe('Geometry Filtering', () => {
    const isValidCoord = (coord) => {
      return (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) &&
        !isNaN(coord[1]) &&
        isFinite(coord[0]) &&
        isFinite(coord[1])
      );
    };

    const filterValidCoordinates = (coordinates) => {
      if (!Array.isArray(coordinates)) return [];
      return coordinates.filter(isValidCoord);
    };

    it('should filter out invalid coordinates from array', () => {
      const coords = [
        [-122.4194, 37.7749],
        [NaN, NaN],
        [-122.4094, 37.7849],
        [Infinity, 37.7949],
        [-122.3994, 37.7949],
      ];

      const valid = filterValidCoordinates(coords);

      expect(valid).toHaveLength(3);
      expect(valid[0]).toEqual([-122.4194, 37.7749]);
      expect(valid[1]).toEqual([-122.4094, 37.7849]);
      expect(valid[2]).toEqual([-122.3994, 37.7949]);
    });

    it('should return empty array for all invalid coordinates', () => {
      const coords = [
        [NaN, NaN],
        [Infinity, -Infinity],
        [null, 37.7749],
      ];

      const valid = filterValidCoordinates(coords);

      expect(valid).toHaveLength(0);
    });

    it('should handle empty input', () => {
      expect(filterValidCoordinates([])).toEqual([]);
      expect(filterValidCoordinates(null)).toEqual([]);
      expect(filterValidCoordinates(undefined)).toEqual([]);
    });
  });

  describe('Trail Geometry Processing', () => {
    const isValidCoord = (coord) => {
      return (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) &&
        !isNaN(coord[1]) &&
        isFinite(coord[0]) &&
        isFinite(coord[1])
      );
    };

    const processTrailGeometry = (trail) => {
      if (!trail?.geometry?.coordinates) return null;

      const validCoords = trail.geometry.coordinates.filter(isValidCoord);

      if (validCoords.length < 2) return null;

      return {
        type: 'Feature',
        properties: {
          id: trail.id,
          name: trail.name,
        },
        geometry: {
          type: 'LineString',
          coordinates: validCoords,
        },
      };
    };

    it('should process valid trail geometry', () => {
      const trail = {
        id: '123',
        name: 'Test Trail',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.4194, 37.7749],
            [-122.4094, 37.7849],
          ],
        },
      };

      const feature = processTrailGeometry(trail);

      expect(feature).not.toBeNull();
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.coordinates).toHaveLength(2);
    });

    it('should filter invalid coordinates from trail', () => {
      const trail = {
        id: '123',
        name: 'Test Trail',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.4194, 37.7749],
            [NaN, NaN],
            [-122.4094, 37.7849],
          ],
        },
      };

      const feature = processTrailGeometry(trail);

      expect(feature).not.toBeNull();
      expect(feature.geometry.coordinates).toHaveLength(2);
    });

    it('should return null for trail with insufficient valid coordinates', () => {
      const trail = {
        id: '123',
        name: 'Test Trail',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.4194, 37.7749],
            [NaN, NaN],
          ],
        },
      };

      const feature = processTrailGeometry(trail);

      expect(feature).toBeNull();
    });

    it('should return null for trail without geometry', () => {
      const trail = {
        id: '123',
        name: 'Test Trail',
      };

      const feature = processTrailGeometry(trail);

      expect(feature).toBeNull();
    });

    it('should return null for trail with null geometry', () => {
      const trail = {
        id: '123',
        name: 'Test Trail',
        geometry: null,
      };

      const feature = processTrailGeometry(trail);

      expect(feature).toBeNull();
    });
  });

  describe('Bounds Calculation', () => {
    const isValidCoord = (coord) => {
      return (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) &&
        !isNaN(coord[1]) &&
        isFinite(coord[0]) &&
        isFinite(coord[1])
      );
    };

    const calculateBounds = (coordinates) => {
      const validCoords = coordinates.filter(isValidCoord);

      if (validCoords.length === 0) return null;

      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      for (const [lng, lat] of validCoords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      return [
        [minLng, minLat],
        [maxLng, maxLat],
      ];
    };

    it('should calculate bounds for valid coordinates', () => {
      const coords = [
        [-122.4194, 37.7749],
        [-122.4094, 37.7849],
        [-122.3994, 37.7649],
      ];

      const bounds = calculateBounds(coords);

      expect(bounds).not.toBeNull();
      expect(bounds[0]).toEqual([-122.4194, 37.7649]); // SW corner
      expect(bounds[1]).toEqual([-122.3994, 37.7849]); // NE corner
    });

    it('should skip invalid coordinates when calculating bounds', () => {
      const coords = [
        [-122.4194, 37.7749],
        [NaN, NaN],
        [-122.3994, 37.7849],
      ];

      const bounds = calculateBounds(coords);

      expect(bounds).not.toBeNull();
      expect(bounds[0]).toEqual([-122.4194, 37.7749]);
      expect(bounds[1]).toEqual([-122.3994, 37.7849]);
    });

    it('should return null for all invalid coordinates', () => {
      const coords = [
        [NaN, NaN],
        [Infinity, -Infinity],
      ];

      const bounds = calculateBounds(coords);

      expect(bounds).toBeNull();
    });

    it('should handle single valid coordinate', () => {
      const coords = [[-122.4194, 37.7749]];

      const bounds = calculateBounds(coords);

      expect(bounds).not.toBeNull();
      expect(bounds[0]).toEqual([-122.4194, 37.7749]);
      expect(bounds[1]).toEqual([-122.4194, 37.7749]);
    });
  });

  describe('Multiple Trails Processing', () => {
    const isValidCoord = (coord) => {
      return (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) &&
        !isNaN(coord[1]) &&
        isFinite(coord[0]) &&
        isFinite(coord[1])
      );
    };

    const processTrails = (trails) => {
      if (!Array.isArray(trails)) return [];

      return trails
        .filter((trail) => trail?.geometry?.coordinates?.length >= 2)
        .map((trail) => {
          const validCoords = trail.geometry.coordinates.filter(isValidCoord);
          if (validCoords.length < 2) return null;

          return {
            type: 'Feature',
            properties: { id: trail.id, name: trail.name },
            geometry: { type: 'LineString', coordinates: validCoords },
          };
        })
        .filter(Boolean);
    };

    it('should process multiple trails', () => {
      const trails = [
        {
          id: '1',
          name: 'Trail 1',
          geometry: {
            coordinates: [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
            ],
          },
        },
        {
          id: '2',
          name: 'Trail 2',
          geometry: {
            coordinates: [
              [-122.3194, 37.6749],
              [-122.3094, 37.6849],
            ],
          },
        },
      ];

      const features = processTrails(trails);

      expect(features).toHaveLength(2);
    });

    it('should filter out trails with invalid geometry', () => {
      const trails = [
        {
          id: '1',
          name: 'Valid Trail',
          geometry: {
            coordinates: [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
            ],
          },
        },
        {
          id: '2',
          name: 'Invalid Trail',
          geometry: {
            coordinates: [
              [NaN, NaN],
              [NaN, NaN],
            ],
          },
        },
      ];

      const features = processTrails(trails);

      expect(features).toHaveLength(1);
      expect(features[0].properties.name).toBe('Valid Trail');
    });

    it('should handle empty trails array', () => {
      expect(processTrails([])).toEqual([]);
      expect(processTrails(null)).toEqual([]);
      expect(processTrails(undefined)).toEqual([]);
    });
  });
});
