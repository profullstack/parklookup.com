/**
 * Tests for ParkTrailsSection Component
 *
 * Tests the trail filtering and coordinate validation logic
 * used in ParkDetailClient's ParkTrailsSection
 *
 * @module test/app/parks/ParkTrailsSection.test
 */

import { describe, it, expect } from 'vitest';

describe('ParkTrailsSection Trail Filtering', () => {
  /**
   * Coordinate validation function (same as in ParkDetailClient)
   */
  const isValidCoord = (coord) =>
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number' &&
    !isNaN(coord[0]) &&
    !isNaN(coord[1]) &&
    isFinite(coord[0]) &&
    isFinite(coord[1]);

  /**
   * Trail filtering function (same logic as in ParkDetailClient)
   */
  const filterTrailsWithGeometry = (trails) => {
    return trails.filter((trail) => {
      if (!trail.geojson && !trail.geometry && !trail.geometry_geojson) return false;

      // Parse geometry to check for valid coordinates
      let geom = trail.geojson || trail.geometry || trail.geometry_geojson;
      if (typeof geom === 'string') {
        try {
          geom = JSON.parse(geom);
        } catch {
          return false;
        }
      }

      // Check if geometry has valid coordinates
      if (!geom?.coordinates || !Array.isArray(geom.coordinates)) return false;

      // Check for at least one valid coordinate
      const hasValidCoord = geom.coordinates.some((coord) => isValidCoord(coord));

      return hasValidCoord;
    });
  };

  describe('Trail Geometry Filtering', () => {
    it('should include trails with valid geojson', () => {
      const trails = [
        {
          id: '1',
          name: 'Valid Trail',
          geojson: {
            type: 'LineString',
            coordinates: [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
            ],
          },
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Valid Trail');
    });

    it('should include trails with valid geometry property', () => {
      const trails = [
        {
          id: '1',
          name: 'Valid Trail',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
            ],
          },
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(1);
    });

    it('should include trails with valid geometry_geojson property', () => {
      const trails = [
        {
          id: '1',
          name: 'Valid Trail',
          geometry_geojson: {
            type: 'LineString',
            coordinates: [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
            ],
          },
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(1);
    });

    it('should parse stringified geometry', () => {
      const trails = [
        {
          id: '1',
          name: 'Valid Trail',
          geojson: JSON.stringify({
            type: 'LineString',
            coordinates: [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
            ],
          }),
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(1);
    });

    it('should exclude trails without any geometry', () => {
      const trails = [
        {
          id: '1',
          name: 'No Geometry Trail',
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(0);
    });

    it('should exclude trails with null geometry', () => {
      const trails = [
        {
          id: '1',
          name: 'Null Geometry Trail',
          geojson: null,
          geometry: null,
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(0);
    });

    it('should exclude trails with invalid JSON string', () => {
      const trails = [
        {
          id: '1',
          name: 'Invalid JSON Trail',
          geojson: 'not valid json',
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(0);
    });

    it('should exclude trails with empty coordinates array', () => {
      const trails = [
        {
          id: '1',
          name: 'Empty Coords Trail',
          geojson: {
            type: 'LineString',
            coordinates: [],
          },
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(0);
    });

    it('should exclude trails with all NaN coordinates', () => {
      const trails = [
        {
          id: '1',
          name: 'NaN Coords Trail',
          geojson: {
            type: 'LineString',
            coordinates: [
              [NaN, NaN],
              [NaN, NaN],
            ],
          },
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(0);
    });

    it('should exclude trails with all Infinity coordinates', () => {
      const trails = [
        {
          id: '1',
          name: 'Infinity Coords Trail',
          geojson: {
            type: 'LineString',
            coordinates: [
              [Infinity, -Infinity],
              [Infinity, Infinity],
            ],
          },
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(0);
    });

    it('should include trails with at least one valid coordinate', () => {
      const trails = [
        {
          id: '1',
          name: 'Mixed Coords Trail',
          geojson: {
            type: 'LineString',
            coordinates: [
              [NaN, NaN],
              [-122.4194, 37.7749], // Valid
              [Infinity, 37.7849],
            ],
          },
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(1);
    });

    it('should filter multiple trails correctly', () => {
      const trails = [
        {
          id: '1',
          name: 'Valid Trail 1',
          geojson: {
            type: 'LineString',
            coordinates: [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
            ],
          },
        },
        {
          id: '2',
          name: 'Invalid Trail',
          geojson: {
            type: 'LineString',
            coordinates: [[NaN, NaN]],
          },
        },
        {
          id: '3',
          name: 'Valid Trail 2',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-121.4194, 36.7749],
              [-121.4094, 36.7849],
            ],
          },
        },
        {
          id: '4',
          name: 'No Geometry Trail',
        },
      ];

      const filtered = filterTrailsWithGeometry(trails);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('Valid Trail 1');
      expect(filtered[1].name).toBe('Valid Trail 2');
    });
  });

  describe('Coordinate Validation', () => {
    it('should validate standard coordinates', () => {
      expect(isValidCoord([-122.4194, 37.7749])).toBe(true);
      expect(isValidCoord([0, 0])).toBe(true);
      expect(isValidCoord([-180, -90])).toBe(true);
      expect(isValidCoord([180, 90])).toBe(true);
    });

    it('should validate coordinates with elevation', () => {
      expect(isValidCoord([-122.4194, 37.7749, 100])).toBe(true);
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

    it('should reject non-array values', () => {
      expect(isValidCoord(null)).toBe(false);
      expect(isValidCoord(undefined)).toBe(false);
      expect(isValidCoord('[-122.4194, 37.7749]')).toBe(false);
      expect(isValidCoord({ lng: -122.4194, lat: 37.7749 })).toBe(false);
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
  });
});
