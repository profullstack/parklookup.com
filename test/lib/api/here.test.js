/**
 * Tests for HERE API Library
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidLatitude,
  isValidLongitude,
  formatAddress,
  getShortAddress,
  reverseGeocode,
  batchReverseGeocode,
} from '@/lib/api/here';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HERE API Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable
    vi.stubEnv('HERE_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isValidLatitude', () => {
    it('should return true for valid latitudes', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(45.5)).toBe(true);
      expect(isValidLatitude(-45.5)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it('should return false for invalid latitudes', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(180)).toBe(false);
      expect(isValidLatitude(NaN)).toBe(false);
      expect(isValidLatitude('invalid')).toBe(false);
    });

    it('should handle string numbers', () => {
      expect(isValidLatitude('45.5')).toBe(true);
      expect(isValidLatitude('-45.5')).toBe(true);
    });
  });

  describe('isValidLongitude', () => {
    it('should return true for valid longitudes', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(90)).toBe(true);
      expect(isValidLongitude(-90)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it('should return false for invalid longitudes', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
      expect(isValidLongitude(NaN)).toBe(false);
      expect(isValidLongitude('invalid')).toBe(false);
    });

    it('should handle string numbers', () => {
      expect(isValidLongitude('90.5')).toBe(true);
      expect(isValidLongitude('-90.5')).toBe(true);
    });
  });

  describe('formatAddress', () => {
    it('should format a complete address', () => {
      const address = {
        houseNumber: '123',
        street: 'Main St',
        city: 'San Francisco',
        stateCode: 'CA',
        postalCode: '94102',
        countryCode: 'USA',
      };

      const result = formatAddress(address);
      expect(result).toContain('123 Main St');
      expect(result).toContain('San Francisco');
      expect(result).toContain('CA');
      expect(result).toContain('94102');
    });

    it('should handle address without house number', () => {
      const address = {
        street: 'Main St',
        city: 'San Francisco',
        stateCode: 'CA',
      };

      const result = formatAddress(address);
      expect(result).toContain('Main St');
      expect(result).toContain('San Francisco');
    });

    it('should handle address with only city and state', () => {
      const address = {
        city: 'San Francisco',
        stateCode: 'CA',
      };

      const result = formatAddress(address);
      expect(result).toBe('San Francisco, CA');
    });

    it('should return null for null address', () => {
      expect(formatAddress(null)).toBeNull();
    });

    it('should return null for empty address', () => {
      expect(formatAddress({})).toBeNull();
    });

    it('should include country for non-USA addresses', () => {
      const address = {
        city: 'Toronto',
        state: 'Ontario',
        countryCode: 'CAN',
        countryName: 'Canada',
      };

      const result = formatAddress(address);
      expect(result).toContain('Canada');
    });
  });

  describe('getShortAddress', () => {
    it('should return city and state', () => {
      const address = {
        city: 'San Francisco',
        stateCode: 'CA',
      };

      expect(getShortAddress(address)).toBe('San Francisco, CA');
    });

    it('should use state if stateCode not available', () => {
      const address = {
        city: 'San Francisco',
        state: 'California',
      };

      expect(getShortAddress(address)).toBe('San Francisco, California');
    });

    it('should return only city if no state', () => {
      const address = {
        city: 'San Francisco',
      };

      expect(getShortAddress(address)).toBe('San Francisco');
    });

    it('should return null for null address', () => {
      expect(getShortAddress(null)).toBeNull();
    });

    it('should return null for empty address', () => {
      expect(getShortAddress({})).toBeNull();
    });
  });

  describe('reverseGeocode', () => {
    const mockSuccessResponse = {
      items: [
        {
          address: {
            label: '123 Main St, San Francisco, CA 94102, USA',
            houseNumber: '123',
            street: 'Main St',
            city: 'San Francisco',
            stateCode: 'CA',
            postalCode: '94102',
            countryCode: 'USA',
            countryName: 'United States',
          },
          position: {
            lat: 37.7749,
            lng: -122.4194,
          },
          resultType: 'houseNumber',
        },
      ],
    };

    it('should successfully reverse geocode coordinates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const result = await reverseGeocode(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.address.city).toBe('San Francisco');
      expect(result.address.stateCode).toBe('CA');
      expect(result.shortAddress).toBe('San Francisco, CA');
    });

    it('should handle no results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const result = await reverseGeocode(0, 0);

      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
      expect(result.address).toBeNull();
    });

    it('should throw error for missing API key', async () => {
      vi.stubEnv('HERE_API_KEY', '');

      await expect(reverseGeocode(37.7749, -122.4194)).rejects.toThrow(
        'HERE_API_KEY environment variable is not set'
      );
    });

    it('should throw error for invalid latitude', async () => {
      await expect(reverseGeocode(100, -122.4194)).rejects.toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', async () => {
      await expect(reverseGeocode(37.7749, -200)).rejects.toThrow('Invalid longitude');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(reverseGeocode(37.7749, -122.4194)).rejects.toThrow('HERE API error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(reverseGeocode(37.7749, -122.4194)).rejects.toThrow(
        'Failed to reverse geocode'
      );
    });

    it('should include correct query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await reverseGeocode(37.7749, -122.4194);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('at=37.7749%2C-122.4194')
      );
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('apiKey=test-api-key'));
    });
  });

  describe('batchReverseGeocode', () => {
    const mockSuccessResponse = {
      items: [
        {
          address: {
            city: 'San Francisco',
            stateCode: 'CA',
          },
          position: { lat: 37.7749, lng: -122.4194 },
        },
      ],
    };

    it('should batch geocode multiple coordinates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const coordinates = [
        { id: 'park1', lat: 37.7749, lng: -122.4194 },
        { id: 'park2', lat: 34.0522, lng: -118.2437 },
      ];

      const results = await batchReverseGeocode(coordinates, { delayMs: 0 });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('park1');
      expect(results[1].id).toBe('park2');
    });

    it('should handle errors for individual coordinates', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const coordinates = [
        { id: 'park1', lat: 37.7749, lng: -122.4194 },
        { id: 'park2', lat: 34.0522, lng: -118.2437 },
      ];

      const results = await batchReverseGeocode(coordinates, { delayMs: 0 });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });

    it('should respect concurrency limit', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const coordinates = Array.from({ length: 10 }, (_, i) => ({
        id: `park${i}`,
        lat: 37.7749 + i * 0.01,
        lng: -122.4194,
      }));

      await batchReverseGeocode(coordinates, { concurrency: 2, delayMs: 0 });

      // All coordinates should be processed
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });
  });
});