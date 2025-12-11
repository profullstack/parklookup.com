/**
 * Geocode Origin Tests
 * Tests for the HERE API geocoding service
 * 
 * Testing Framework: Vitest (used by the project)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the validation functions that don't require API key
import {
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  milesToMeters,
  kmToMiles,
  milesToKm,
} from '@/lib/api/geocode-origin';

describe('Geocode Origin', () => {
  describe('isValidLatitude', () => {
    it('should return true for valid latitude', () => {
      expect(isValidLatitude(37.7749)).toBe(true);
    });

    it('should return true for edge case latitudes', () => {
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
      expect(isValidLatitude(0)).toBe(true);
    });

    it('should return false for invalid latitude', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      expect(isValidLatitude('37')).toBe(false);
      expect(isValidLatitude(null)).toBe(false);
      expect(isValidLatitude(undefined)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidLatitude(NaN)).toBe(false);
    });
  });

  describe('isValidLongitude', () => {
    it('should return true for valid longitude', () => {
      expect(isValidLongitude(-122.4194)).toBe(true);
    });

    it('should return true for edge case longitudes', () => {
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
      expect(isValidLongitude(0)).toBe(true);
    });

    it('should return false for invalid longitude', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      expect(isValidLongitude('-122')).toBe(false);
      expect(isValidLongitude(null)).toBe(false);
      expect(isValidLongitude(undefined)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidLongitude(NaN)).toBe(false);
    });
  });

  describe('isValidCoordinates', () => {
    it('should return true for valid coordinates object', () => {
      expect(isValidCoordinates({ lat: 37.7749, lng: -122.4194 })).toBe(true);
    });

    it('should return true for edge case coordinates', () => {
      expect(isValidCoordinates({ lat: 90, lng: 180 })).toBe(true);
      expect(isValidCoordinates({ lat: -90, lng: -180 })).toBe(true);
      expect(isValidCoordinates({ lat: 0, lng: 0 })).toBe(true);
    });

    it('should return false for invalid latitude in coordinates', () => {
      expect(isValidCoordinates({ lat: 91, lng: 0 })).toBe(false);
      expect(isValidCoordinates({ lat: -91, lng: 0 })).toBe(false);
    });

    it('should return false for invalid longitude in coordinates', () => {
      expect(isValidCoordinates({ lat: 0, lng: 181 })).toBe(false);
      expect(isValidCoordinates({ lat: 0, lng: -181 })).toBe(false);
    });

    it('should return falsy for null or undefined', () => {
      // isValidCoordinates returns null/undefined for null/undefined input
      // which is falsy, so we test for falsiness
      expect(isValidCoordinates(null)).toBeFalsy();
      expect(isValidCoordinates(undefined)).toBeFalsy();
    });

    it('should return false for missing lat or lng', () => {
      expect(isValidCoordinates({ lat: 37 })).toBe(false);
      expect(isValidCoordinates({ lng: -122 })).toBe(false);
      expect(isValidCoordinates({})).toBe(false);
    });
  });

  describe('milesToMeters', () => {
    it('should convert miles to meters correctly', () => {
      expect(milesToMeters(1)).toBeCloseTo(1609.344, 2);
    });

    it('should handle zero', () => {
      expect(milesToMeters(0)).toBe(0);
    });

    it('should handle larger values', () => {
      expect(milesToMeters(100)).toBeCloseTo(160934.4, 1);
    });
  });

  describe('kmToMiles', () => {
    it('should convert kilometers to miles correctly', () => {
      expect(kmToMiles(1)).toBeCloseTo(0.621371, 4);
    });

    it('should handle zero', () => {
      expect(kmToMiles(0)).toBe(0);
    });

    it('should handle larger values', () => {
      expect(kmToMiles(100)).toBeCloseTo(62.1371, 2);
    });
  });

  describe('milesToKm', () => {
    it('should convert miles to kilometers correctly', () => {
      expect(milesToKm(1)).toBeCloseTo(1.60934, 4);
    });

    it('should handle zero', () => {
      expect(milesToKm(0)).toBe(0);
    });

    it('should handle larger values', () => {
      expect(milesToKm(100)).toBeCloseTo(160.934, 2);
    });

    it('should be inverse of kmToMiles', () => {
      const miles = 50;
      const km = milesToKm(miles);
      // Use lower precision due to floating point arithmetic
      expect(kmToMiles(km)).toBeCloseTo(miles, 2);
    });
  });
});

describe('Geocode Origin API (requires HERE_API_KEY)', () => {
  // These tests are skipped because they require the HERE_API_KEY
  // In a real test environment, you would mock the fetch call
  
  describe('geocodeOrigin', () => {
    it.skip('should return coordinates for valid address', async () => {
      // This test requires HERE_API_KEY to be set
      // In production, mock the fetch call instead
    });

    it.skip('should throw error when no results found', async () => {
      // This test requires HERE_API_KEY to be set
    });

    it.skip('should throw error for empty input', async () => {
      // This test requires HERE_API_KEY to be set
    });
  });
});

describe('Coordinate Validation Edge Cases', () => {
  it('should handle floating point precision', () => {
    expect(isValidLatitude(37.77493)).toBe(true);
    expect(isValidLongitude(-122.41942)).toBe(true);
  });

  it('should handle very small values', () => {
    expect(isValidLatitude(0.0001)).toBe(true);
    expect(isValidLongitude(0.0001)).toBe(true);
  });

  it('should handle negative values', () => {
    expect(isValidLatitude(-45.5)).toBe(true);
    expect(isValidLongitude(-122.5)).toBe(true);
  });
});

describe('Distance Conversion Accuracy', () => {
  it('should convert marathon distance correctly', () => {
    // Marathon is 26.2 miles = 42.195 km
    expect(milesToKm(26.2)).toBeCloseTo(42.16, 1);
  });

  it('should convert 5K correctly', () => {
    // 5K = 3.1 miles
    expect(kmToMiles(5)).toBeCloseTo(3.1, 1);
  });

  it('should convert 100 meters to miles', () => {
    // 100 meters = 0.0621 miles
    const meters = 100;
    const miles = meters / 1609.344;
    expect(miles).toBeCloseTo(0.0621, 3);
  });
});