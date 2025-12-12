/**
 * Wikidata Local Parks Matching Service Tests
 *
 * Tests for matching local parks with Wikidata entities and fetching photos
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildParkMatchQuery,
  buildPhotoQuery,
  parseWikidataResult,
  parseCommonsImage,
  calculateDistance,
  findBestMatch,
} from '@/lib/api/wikidata-local.js';

describe('Wikidata Local Parks Matching Service', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points in kilometers', () => {
      // San Francisco to Los Angeles (~559 km)
      const distance = calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);
      expect(distance).toBeCloseTo(559, -1); // within 10 km
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(distance).toBe(0);
    });

    it('should handle null coordinates', () => {
      expect(calculateDistance(null, -122.4194, 34.0522, -118.2437)).toBeNull();
      expect(calculateDistance(37.7749, null, 34.0522, -118.2437)).toBeNull();
      expect(calculateDistance(37.7749, -122.4194, null, -118.2437)).toBeNull();
      expect(calculateDistance(37.7749, -122.4194, 34.0522, null)).toBeNull();
    });
  });

  describe('buildParkMatchQuery', () => {
    it('should build a SPARQL query for park matching', () => {
      const query = buildParkMatchQuery({
        name: 'Central Park',
        latitude: 40.7829,
        longitude: -73.9654,
        radiusKm: 10,
      });

      expect(typeof query).toBe('string');
      // Query searches by location, name is used for matching later
      expect(query).toContain('40.7829');
      expect(query).toContain('-73.9654');
      expect(query).toContain('"10"'); // radius in quotes
      expect(query).toContain('wikibase:around'); // geo search
      expect(query).toContain('Q22698'); // park entity type
    });

    it('should escape special characters in park name', () => {
      const query = buildParkMatchQuery({
        name: "O'Brien's Park & Recreation",
        latitude: 40.0,
        longitude: -74.0,
      });

      // Apostrophes are removed, & is replaced with 'and'
      expect(query).not.toContain("'Brien");
      expect(query).not.toContain('&');
    });

    it('should use default radius if not specified', () => {
      const query = buildParkMatchQuery({
        name: 'Test Park',
        latitude: 40.0,
        longitude: -74.0,
      });

      expect(query).toContain('"5"'); // default 5km radius in quotes
    });
  });

  describe('buildPhotoQuery', () => {
    it('should build a SPARQL query for fetching photos by Wikidata ID', () => {
      const query = buildPhotoQuery('Q160409');

      expect(typeof query).toBe('string');
      expect(query).toContain('Q160409');
      expect(query).toContain('P18'); // image property
      expect(query).toContain('P373'); // Commons category
    });
  });

  describe('parseWikidataResult', () => {
    const mockResult = {
      park: { value: 'http://www.wikidata.org/entity/Q160409' },
      parkLabel: { value: 'Central Park' },
      coord: { value: 'Point(-73.9654 40.7829)' },
      image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Central_Park.jpg' },
      commonsCat: { value: 'Central Park, New York City' },
    };

    it('should parse Wikidata ID from URI', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.wikidata_id).toBe('Q160409');
    });

    it('should parse park label', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.label).toBe('Central Park');
    });

    it('should parse coordinates', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.latitude).toBeCloseTo(40.7829, 3);
      expect(result.longitude).toBeCloseTo(-73.9654, 3);
    });

    it('should parse image URL', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.image_url).toContain('Central_Park.jpg');
    });

    it('should parse Commons category', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.commons_category).toBe('Central Park, New York City');
    });

    it('should handle missing optional fields', () => {
      const minimalResult = {
        park: { value: 'http://www.wikidata.org/entity/Q12345' },
        parkLabel: { value: 'Test Park' },
      };
      const result = parseWikidataResult(minimalResult);
      expect(result.wikidata_id).toBe('Q12345');
      expect(result.image_url).toBeNull();
      expect(result.commons_category).toBeNull();
    });
  });

  describe('parseCommonsImage', () => {
    const mockImageInfo = {
      title: 'File:Central Park.jpg',
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Central_Park.jpg',
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Central_Park.jpg/300px-Central_Park.jpg',
          width: 4000,
          height: 3000,
          extmetadata: {
            LicenseShortName: { value: 'CC BY-SA 4.0' },
            Artist: { value: '<a href="...">John Doe</a>' },
          },
        },
      ],
    };

    it('should parse image URL', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.image_url).toContain('Central_Park.jpg');
    });

    it('should parse thumbnail URL', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.thumb_url).toContain('300px');
    });

    it('should parse dimensions', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.width).toBe(4000);
      expect(result.height).toBe(3000);
    });

    it('should parse license', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.license).toBe('CC BY-SA 4.0');
    });

    it('should parse title', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.title).toBe('Central Park.jpg');
    });

    it('should set source as wikimedia', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.source).toBe('wikimedia');
    });

    it('should handle missing imageinfo', () => {
      const result = parseCommonsImage({ title: 'File:Test.jpg' });
      expect(result).toBeNull();
    });
  });

  describe('findBestMatch', () => {
    const parkData = {
      name: 'Central Park',
      latitude: 40.7829,
      longitude: -73.9654,
    };

    const candidates = [
      {
        wikidata_id: 'Q160409',
        label: 'Central Park',
        latitude: 40.7829,
        longitude: -73.9654,
      },
      {
        wikidata_id: 'Q12345',
        label: 'Central Park Zoo',
        latitude: 40.7678,
        longitude: -73.9718,
      },
      {
        wikidata_id: 'Q67890',
        label: 'Some Other Park',
        latitude: 41.0,
        longitude: -74.0,
      },
    ];

    it('should return the best matching candidate', () => {
      const match = findBestMatch(parkData, candidates);
      expect(match).not.toBeNull();
      expect(match.wikidata_id).toBe('Q160409');
    });

    it('should prefer exact name matches', () => {
      const match = findBestMatch(parkData, candidates);
      expect(match.label).toBe('Central Park');
    });

    it('should return null for empty candidates', () => {
      const match = findBestMatch(parkData, []);
      expect(match).toBeNull();
    });

    it('should return null if no good match found', () => {
      const farPark = {
        name: 'Completely Different Park',
        latitude: 0,
        longitude: 0,
      };
      const match = findBestMatch(farPark, candidates, { maxDistanceKm: 1 });
      expect(match).toBeNull();
    });
  });

  describe('fetchParkMatch (integration)', () => {
    it.skip('should fetch matching Wikidata entity for a park', async () => {
      const { fetchParkMatch } = await import('@/lib/api/wikidata-local.js');
      const result = await fetchParkMatch({
        name: 'Central Park',
        latitude: 40.7829,
        longitude: -73.9654,
      });

      expect(result).not.toBeNull();
      expect(result.wikidata_id).toBe('Q160409');
    });
  });

  describe('fetchCommonsImages (integration)', () => {
    it.skip('should fetch images from Commons category', async () => {
      const { fetchCommonsImages } = await import('@/lib/api/wikidata-local.js');
      const images = await fetchCommonsImages('Central Park, New York City', { limit: 5 });

      expect(Array.isArray(images)).toBe(true);
      expect(images.length).toBeLessThanOrEqual(5);
      if (images.length > 0) {
        expect(images[0]).toHaveProperty('image_url');
        expect(images[0]).toHaveProperty('thumb_url');
        expect(images[0]).toHaveProperty('license');
      }
    });
  });
});