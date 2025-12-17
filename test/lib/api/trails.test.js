/**
 * Tests for Trail Data Normalization and Transformation Utilities
 *
 * @module test/lib/api/trails.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLength,
  calculateDifficulty,
  generateSlug,
  normalizeSurface,
  determineTrailType,
  extractName,
  coordinatesToWKT,
  transformOsmToTrail,
  transformOsmElements,
  prepareForDatabase,
  deduplicateTrails,
} from '../../../lib/api/trails.js';

describe('Trail Utilities', () => {
  describe('calculateLength', () => {
    it('should return 0 for empty coordinates', () => {
      expect(calculateLength([])).toBe(0);
      expect(calculateLength(null)).toBe(0);
      expect(calculateLength(undefined)).toBe(0);
    });

    it('should return 0 for single coordinate', () => {
      expect(calculateLength([[-122.4194, 37.7749]])).toBe(0);
    });

    it('should calculate length for two coordinates', () => {
      // Approximately 1km apart
      const coords = [
        [-122.4194, 37.7749],
        [-122.4094, 37.7749],
      ];
      const length = calculateLength(coords);
      // Should be approximately 850-900 meters
      expect(length).toBeGreaterThan(800);
      expect(length).toBeLessThan(1000);
    });

    it('should calculate length for multiple coordinates', () => {
      const coords = [
        [-122.4194, 37.7749],
        [-122.4094, 37.7749],
        [-122.4094, 37.7849],
      ];
      const length = calculateLength(coords);
      // Should be approximately 1.9km
      expect(length).toBeGreaterThan(1800);
      expect(length).toBeLessThan(2200);
    });
  });

  describe('calculateDifficulty', () => {
    it('should return difficulty based on SAC scale', () => {
      expect(calculateDifficulty({ sacScale: 'hiking' })).toBe('easy');
      expect(calculateDifficulty({ sacScale: 'mountain_hiking' })).toBe('moderate');
      expect(calculateDifficulty({ sacScale: 'alpine_hiking' })).toBe('hard');
    });

    it('should return hard for long trails', () => {
      expect(calculateDifficulty({ lengthMeters: 16000 })).toBe('hard');
    });

    it('should return hard for high elevation gain', () => {
      expect(calculateDifficulty({ elevationGainM: 700 })).toBe('hard');
    });

    it('should return moderate for medium trails', () => {
      expect(calculateDifficulty({ lengthMeters: 10000 })).toBe('moderate');
    });

    it('should return moderate for medium elevation gain', () => {
      expect(calculateDifficulty({ elevationGainM: 400 })).toBe('moderate');
    });

    it('should return easy by default', () => {
      expect(calculateDifficulty({})).toBe('easy');
      expect(calculateDifficulty({ lengthMeters: 5000 })).toBe('easy');
    });
  });

  describe('generateSlug', () => {
    it('should generate slug from name', () => {
      expect(generateSlug('Mountain Trail', '123')).toBe('mountain-trail');
    });

    it('should handle special characters', () => {
      expect(generateSlug("John's Trail #1", '123')).toBe('john-s-trail-1');
    });

    it('should truncate long names', () => {
      const longName = 'A'.repeat(150);
      const slug = generateSlug(longName, '123');
      expect(slug.length).toBeLessThanOrEqual(100);
    });

    it('should use source ID as fallback', () => {
      expect(generateSlug(null, '12345')).toBe('trail-12345');
      expect(generateSlug('', '12345')).toBe('trail-12345');
    });
  });

  describe('normalizeSurface', () => {
    it('should normalize paved surfaces', () => {
      expect(normalizeSurface('asphalt')).toBe('paved');
      expect(normalizeSurface('concrete')).toBe('paved');
      expect(normalizeSurface('paved')).toBe('paved');
    });

    it('should normalize gravel surfaces', () => {
      expect(normalizeSurface('gravel')).toBe('gravel');
      expect(normalizeSurface('fine_gravel')).toBe('gravel');
      expect(normalizeSurface('compacted')).toBe('gravel');
    });

    it('should normalize dirt surfaces', () => {
      expect(normalizeSurface('dirt')).toBe('dirt');
      expect(normalizeSurface('earth')).toBe('dirt');
      expect(normalizeSurface('grass')).toBe('dirt');
    });

    it('should normalize rock surfaces', () => {
      expect(normalizeSurface('rock')).toBe('rock');
      expect(normalizeSurface('stone')).toBe('rock');
    });

    it('should return mixed for unknown surfaces', () => {
      expect(normalizeSurface('unknown')).toBe('mixed');
    });

    it('should return null for empty input', () => {
      expect(normalizeSurface(null)).toBeNull();
      expect(normalizeSurface('')).toBeNull();
    });
  });

  describe('determineTrailType', () => {
    it('should return loop for trails that start and end at same point', () => {
      const coords = [
        [-122.4194, 37.7749],
        [-122.4094, 37.7749],
        [-122.4094, 37.7849],
        [-122.4194, 37.7749], // Same as start
      ];
      expect(determineTrailType(coords)).toBe('loop');
    });

    it('should return point-to-point for trails with different start/end', () => {
      const coords = [
        [-122.4194, 37.7749],
        [-122.4094, 37.7749],
        [-122.3994, 37.7749],
      ];
      expect(determineTrailType(coords)).toBe('point-to-point');
    });

    it('should return point-to-point for invalid input', () => {
      expect(determineTrailType([])).toBe('point-to-point');
      expect(determineTrailType(null)).toBe('point-to-point');
      expect(determineTrailType([[-122.4194, 37.7749]])).toBe('point-to-point');
    });
  });

  describe('extractName', () => {
    it('should extract name from tags', () => {
      expect(extractName({ name: 'Trail Name' })).toBe('Trail Name');
    });

    it('should fallback to name:en', () => {
      expect(extractName({ 'name:en': 'English Name' })).toBe('English Name');
    });

    it('should fallback to ref', () => {
      expect(extractName({ ref: 'TR-123' })).toBe('TR-123');
    });

    it('should fallback to description', () => {
      expect(extractName({ description: 'A nice trail' })).toBe('A nice trail');
    });

    it('should return null for empty tags', () => {
      expect(extractName({})).toBeNull();
      expect(extractName(null)).toBeNull();
    });
  });

  describe('coordinatesToWKT', () => {
    it('should convert coordinates to WKT LineString', () => {
      const coords = [
        [-122.4194, 37.7749],
        [-122.4094, 37.7849],
      ];
      expect(coordinatesToWKT(coords)).toBe('LINESTRING(-122.4194 37.7749, -122.4094 37.7849)');
    });

    it('should return null for invalid input', () => {
      expect(coordinatesToWKT([])).toBeNull();
      expect(coordinatesToWKT(null)).toBeNull();
      expect(coordinatesToWKT([[-122.4194, 37.7749]])).toBeNull();
    });
  });

  describe('transformOsmToTrail', () => {
    it('should transform OSM element to trail object', () => {
      const element = {
        type: 'way',
        id: 12345,
        tags: {
          name: 'Test Trail',
          surface: 'gravel',
          sac_scale: 'hiking',
        },
      };
      const coords = [
        [-122.4194, 37.7749],
        [-122.4094, 37.7849],
      ];

      const trail = transformOsmToTrail(element, coords);

      expect(trail.source).toBe('osm');
      expect(trail.sourceId).toBe('way/12345');
      expect(trail.name).toBe('Test Trail');
      expect(trail.surface).toBe('gravel');
      expect(trail.sacScale).toBe('hiking');
      expect(trail.difficulty).toBe('easy');
      expect(trail.slug).toBe('test-trail');
      expect(trail.coordinates).toEqual(coords);
      expect(trail.wkt).toContain('LINESTRING');
    });
  });

  describe('transformOsmElements', () => {
    it('should transform multiple OSM elements', () => {
      const elements = [
        {
          type: 'way',
          id: 1,
          tags: { name: 'Trail 1' },
          geometry: [
            { lon: -122.4194, lat: 37.7749 },
            { lon: -122.4094, lat: 37.7849 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { name: 'Trail 2' },
          geometry: [
            { lon: -122.3194, lat: 37.6749 },
            { lon: -122.3094, lat: 37.6849 },
          ],
        },
      ];

      const extractCoordinates = (el) => el.geometry.map((p) => [p.lon, p.lat]);
      const trails = transformOsmElements(elements, extractCoordinates);

      expect(trails).toHaveLength(2);
      expect(trails[0].name).toBe('Trail 1');
      expect(trails[1].name).toBe('Trail 2');
    });

    it('should skip elements without geometry', () => {
      const elements = [
        { type: 'way', id: 1, tags: { name: 'Trail 1' } },
      ];

      const extractCoordinates = () => [];
      const trails = transformOsmElements(elements, extractCoordinates);

      expect(trails).toHaveLength(0);
    });
  });

  describe('prepareForDatabase', () => {
    it('should prepare trail for database insertion', () => {
      const trail = {
        source: 'osm',
        sourceId: 'way/12345',
        slug: 'test-trail',
        name: 'Test Trail',
        description: 'A test trail',
        difficulty: 'easy',
        lengthMeters: 5000,
        elevationGainM: 100,
        surface: 'gravel',
        trailType: 'loop',
        sacScale: 'hiking',
        trailVisibility: 'good',
        osmTags: { name: 'Test Trail' },
        wkt: 'LINESTRING(-122.4194 37.7749, -122.4094 37.7849)',
      };

      const dbRecord = prepareForDatabase(trail, { parkId: 'park-123', parkSource: 'nps' });

      expect(dbRecord.source).toBe('osm');
      expect(dbRecord.source_id).toBe('way/12345');
      expect(dbRecord.slug).toBe('test-trail');
      expect(dbRecord.name).toBe('Test Trail');
      expect(dbRecord.difficulty).toBe('easy');
      expect(dbRecord.length_meters).toBe(5000);
      expect(dbRecord.park_id).toBe('park-123');
      expect(dbRecord.park_source).toBe('nps');
      expect(dbRecord.geometry).toBe('LINESTRING(-122.4194 37.7749, -122.4094 37.7849)');
      expect(dbRecord.last_seen_at).toBeDefined();
    });

    it('should handle null park association', () => {
      const trail = {
        source: 'osm',
        sourceId: 'way/12345',
        slug: 'test-trail',
      };

      const dbRecord = prepareForDatabase(trail);

      expect(dbRecord.park_id).toBeNull();
      expect(dbRecord.park_source).toBeNull();
    });
  });

  describe('deduplicateTrails', () => {
    it('should remove duplicate trails by source_id', () => {
      const trails = [
        { sourceId: 'way/1', name: 'Trail 1' },
        { sourceId: 'way/2', name: 'Trail 2' },
        { sourceId: 'way/1', name: 'Trail 1 Duplicate' },
      ];

      const unique = deduplicateTrails(trails);

      expect(unique).toHaveLength(2);
      expect(unique[0].name).toBe('Trail 1');
      expect(unique[1].name).toBe('Trail 2');
    });

    it('should handle source_id property name', () => {
      const trails = [
        { source_id: 'way/1', name: 'Trail 1' },
        { source_id: 'way/1', name: 'Trail 1 Duplicate' },
      ];

      const unique = deduplicateTrails(trails);

      expect(unique).toHaveLength(1);
    });
  });
});
