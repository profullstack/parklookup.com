/**
 * Tests for Park Linking Algorithm
 * Using Vitest for testing
 */

import { describe, it, expect } from 'vitest';

describe('Park Linker', () => {
  const mockNpsParks = [
    {
      id: '1',
      park_code: 'yell',
      full_name: 'Yellowstone National Park',
      states: 'WY,MT,ID',
      latitude: 44.428,
      longitude: -110.5885,
    },
    {
      id: '2',
      park_code: 'yose',
      full_name: 'Yosemite National Park',
      states: 'CA',
      latitude: 37.84883288,
      longitude: -119.5571873,
    },
    {
      id: '3',
      park_code: 'grca',
      full_name: 'Grand Canyon National Park',
      states: 'AZ',
      latitude: 36.0544,
      longitude: -112.1401,
    },
  ];

  const mockWikidataParks = [
    {
      id: 'w1',
      wikidata_id: 'Q180402',
      label: 'Yellowstone National Park',
      state: 'Wyoming',
      latitude: 44.428,
      longitude: -110.5885,
    },
    {
      id: 'w2',
      wikidata_id: 'Q180544',
      label: 'Yosemite National Park',
      state: 'California',
      latitude: 37.84883288,
      longitude: -119.5571873,
    },
    {
      id: 'w3',
      wikidata_id: 'Q223969',
      label: 'Grand Canyon National Park',
      state: 'Arizona',
      latitude: 36.0544,
      longitude: -112.1401,
    },
  ];

  describe('calculateNameSimilarity', () => {
    it('should return 1.0 for identical names', async () => {
      const { calculateNameSimilarity } = await import('@/lib/utils/park-linker.js');

      const score = calculateNameSimilarity(
        'Yellowstone National Park',
        'Yellowstone National Park'
      );

      expect(score).toBe(1.0);
    });

    it('should return 1.0 for case-insensitive matches', async () => {
      const { calculateNameSimilarity } = await import('@/lib/utils/park-linker.js');

      const score = calculateNameSimilarity(
        'yellowstone national park',
        'YELLOWSTONE NATIONAL PARK'
      );

      expect(score).toBe(1.0);
    });

    it('should return high score for similar names', async () => {
      const { calculateNameSimilarity } = await import('@/lib/utils/park-linker.js');

      // "Yellowstone NP" is an abbreviation, so similarity is moderate
      const score = calculateNameSimilarity('Yellowstone National Park', 'Yellowstone NP');

      expect(score).toBeGreaterThan(0.5);
    });

    it('should return low score for different names', async () => {
      const { calculateNameSimilarity } = await import('@/lib/utils/park-linker.js');

      const score = calculateNameSimilarity('Yellowstone National Park', 'Grand Canyon');

      expect(score).toBeLessThan(0.5);
    });

    it('should handle empty strings', async () => {
      const { calculateNameSimilarity } = await import('@/lib/utils/park-linker.js');

      expect(calculateNameSimilarity('', '')).toBe(0);
      expect(calculateNameSimilarity('Test', '')).toBe(0);
      expect(calculateNameSimilarity('', 'Test')).toBe(0);
    });
  });

  describe('calculateLocationSimilarity', () => {
    it('should return 1.0 for identical coordinates', async () => {
      const { calculateLocationSimilarity } = await import('@/lib/utils/park-linker.js');

      const score = calculateLocationSimilarity(
        { latitude: 44.428, longitude: -110.5885 },
        { latitude: 44.428, longitude: -110.5885 }
      );

      expect(score).toBe(1.0);
    });

    it('should return high score for nearby coordinates', async () => {
      const { calculateLocationSimilarity } = await import('@/lib/utils/park-linker.js');

      const score = calculateLocationSimilarity(
        { latitude: 44.428, longitude: -110.5885 },
        { latitude: 44.43, longitude: -110.59 }
      );

      expect(score).toBeGreaterThan(0.9);
    });

    it('should return low score for distant coordinates', async () => {
      const { calculateLocationSimilarity } = await import('@/lib/utils/park-linker.js');

      const score = calculateLocationSimilarity(
        { latitude: 44.428, longitude: -110.5885 },
        { latitude: 37.84883288, longitude: -119.5571873 }
      );

      expect(score).toBeLessThan(0.5);
    });

    it('should return 0 for null coordinates', async () => {
      const { calculateLocationSimilarity } = await import('@/lib/utils/park-linker.js');

      expect(calculateLocationSimilarity(null, { latitude: 44.428, longitude: -110.5885 })).toBe(0);
      expect(calculateLocationSimilarity({ latitude: 44.428, longitude: -110.5885 }, null)).toBe(0);
      expect(calculateLocationSimilarity(null, null)).toBe(0);
    });
  });

  describe('calculateOverallScore', () => {
    it('should combine name and location scores with weights', async () => {
      const { calculateOverallScore } = await import('@/lib/utils/park-linker.js');

      const score = calculateOverallScore({
        nameSimilarity: 1.0,
        locationSimilarity: 1.0,
      });

      expect(score).toBe(1.0);
    });

    it('should weight name similarity higher than location', async () => {
      const { calculateOverallScore } = await import('@/lib/utils/park-linker.js');

      const nameOnlyScore = calculateOverallScore({
        nameSimilarity: 1.0,
        locationSimilarity: 0,
      });

      const locationOnlyScore = calculateOverallScore({
        nameSimilarity: 0,
        locationSimilarity: 1.0,
      });

      expect(nameOnlyScore).toBeGreaterThan(locationOnlyScore);
    });
  });

  describe('findBestMatch', () => {
    it('should find the best matching Wikidata park for an NPS park', async () => {
      const { findBestMatch } = await import('@/lib/utils/park-linker.js');

      const match = findBestMatch(mockNpsParks[0], mockWikidataParks);

      expect(match).not.toBeNull();
      expect(match.wikidataPark.wikidata_id).toBe('Q180402');
      expect(match.score).toBeGreaterThan(0.8);
    });

    it('should return null if no match above threshold', async () => {
      const { findBestMatch } = await import('@/lib/utils/park-linker.js');

      const npsPark = {
        id: '99',
        park_code: 'test',
        full_name: 'Completely Different Park Name',
        latitude: 0,
        longitude: 0,
      };

      const match = findBestMatch(npsPark, mockWikidataParks, { threshold: 0.9 });

      expect(match).toBeNull();
    });

    it('should respect custom threshold', async () => {
      const { findBestMatch } = await import('@/lib/utils/park-linker.js');

      const match = findBestMatch(mockNpsParks[0], mockWikidataParks, { threshold: 0.99 });

      // Even exact matches might not hit 0.99 due to algorithm specifics
      // This tests that threshold is respected
      expect(match === null || match.score >= 0.99).toBe(true);
    });
  });

  describe('linkParks', () => {
    it('should link all NPS parks to their Wikidata counterparts', async () => {
      const { linkParks } = await import('@/lib/utils/park-linker.js');

      const links = linkParks(mockNpsParks, mockWikidataParks);

      expect(links).toHaveLength(3);
      expect(links.every((link) => link.confidence_score > 0.8)).toBe(true);
    });

    it('should include match method in results', async () => {
      const { linkParks } = await import('@/lib/utils/park-linker.js');

      const links = linkParks(mockNpsParks, mockWikidataParks);

      expect(links[0].match_method).toBe('name_location_similarity');
    });

    it('should return empty array for empty inputs', async () => {
      const { linkParks } = await import('@/lib/utils/park-linker.js');

      expect(linkParks([], mockWikidataParks)).toEqual([]);
      expect(linkParks(mockNpsParks, [])).toEqual([]);
      expect(linkParks([], [])).toEqual([]);
    });

    it('should call onProgress callback', async () => {
      const { linkParks } = await import('@/lib/utils/park-linker.js');
      const onProgress = vi.fn();

      linkParks(mockNpsParks, mockWikidataParks, { onProgress });

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('normalizeString', () => {
    it('should lowercase and remove special characters', async () => {
      const { normalizeString } = await import('@/lib/utils/park-linker.js');

      expect(normalizeString('Yellowstone National Park')).toBe('yellowstonenationalpark');
      expect(normalizeString("Hawai'i Volcanoes")).toBe('hawaiivolcanoes');
    });

    it('should handle empty and null strings', async () => {
      const { normalizeString } = await import('@/lib/utils/park-linker.js');

      expect(normalizeString('')).toBe('');
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
    });
  });

  describe('calculateLevenshteinDistance', () => {
    it('should return 0 for identical strings', async () => {
      const { calculateLevenshteinDistance } = await import('@/lib/utils/park-linker.js');

      expect(calculateLevenshteinDistance('test', 'test')).toBe(0);
    });

    it('should return correct distance for different strings', async () => {
      const { calculateLevenshteinDistance } = await import('@/lib/utils/park-linker.js');

      expect(calculateLevenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(calculateLevenshteinDistance('', 'test')).toBe(4);
      expect(calculateLevenshteinDistance('test', '')).toBe(4);
    });
  });

  describe('haversineDistance', () => {
    it('should calculate distance between two points in km', async () => {
      const { haversineDistance } = await import('@/lib/utils/park-linker.js');

      // Distance from Yellowstone to Yosemite (approximately 1000+ km)
      const distance = haversineDistance(
        { latitude: 44.428, longitude: -110.5885 },
        { latitude: 37.84883288, longitude: -119.5571873 }
      );

      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1200);
    });

    it('should return 0 for same coordinates', async () => {
      const { haversineDistance } = await import('@/lib/utils/park-linker.js');

      const distance = haversineDistance(
        { latitude: 44.428, longitude: -110.5885 },
        { latitude: 44.428, longitude: -110.5885 }
      );

      expect(distance).toBe(0);
    });
  });
});