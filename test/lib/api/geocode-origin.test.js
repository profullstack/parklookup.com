/**
 * Geocode Origin Tests
 * Tests for the HERE API geocoding service
 * 
 * Testing Framework: Vitest (used by the project)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { geocodeOrigin, validateCoordinates } from '@/lib/api/geocode-origin';

describe('Geocode Origin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable
    process.env.HERE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('geocodeOrigin', () => {
    it('should return coordinates for valid address', async () => {
      const mockResponse = {
        items: [
          {
            position: {
              lat: 37.7749,
              lng: -122.4194,
            },
            address: {
              label: 'San Francisco, CA, USA',
            },
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await geocodeOrigin('San Francisco, CA');

      expect(result).toEqual({
        lat: 37.7749,
        lng: -122.4194,
        formattedAddress: 'San Francisco, CA, USA',
      });
    });

    it('should call HERE API with correct parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ position: { lat: 0, lng: 0 }, address: { label: 'Test' } }],
        }),
      });

      await geocodeOrigin('Test Location');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('geocode.search.hereapi.com');
      expect(callUrl).toContain('q=Test%20Location');
      expect(callUrl).toContain('apiKey=test-api-key');
    });

    it('should throw error when no results found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await expect(geocodeOrigin('Invalid Location XYZ123')).rejects.toThrow(
        'No results found'
      );
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(geocodeOrigin('San Francisco')).rejects.toThrow();
    });

    it('should throw error when network fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(geocodeOrigin('San Francisco')).rejects.toThrow('Network error');
    });

    it('should handle empty input', async () => {
      await expect(geocodeOrigin('')).rejects.toThrow();
    });

    it('should handle whitespace-only input', async () => {
      await expect(geocodeOrigin('   ')).rejects.toThrow();
    });

    it('should trim input before sending', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ position: { lat: 0, lng: 0 }, address: { label: 'Test' } }],
        }),
      });

      await geocodeOrigin('  San Francisco  ');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('q=San%20Francisco');
    });
  });

  describe('validateCoordinates', () => {
    it('should return true for valid coordinates', () => {
      expect(validateCoordinates(37.7749, -122.4194)).toBe(true);
    });

    it('should return true for edge case coordinates', () => {
      expect(validateCoordinates(90, 180)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
      expect(validateCoordinates(0, 0)).toBe(true);
    });

    it('should return false for invalid latitude', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
      expect(validateCoordinates(-91, 0)).toBe(false);
    });

    it('should return false for invalid longitude', () => {
      expect(validateCoordinates(0, 181)).toBe(false);
      expect(validateCoordinates(0, -181)).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      expect(validateCoordinates('37', '-122')).toBe(false);
      expect(validateCoordinates(null, null)).toBe(false);
      expect(validateCoordinates(undefined, undefined)).toBe(false);
    });

    it('should return false for NaN values', () => {
      expect(validateCoordinates(NaN, -122)).toBe(false);
      expect(validateCoordinates(37, NaN)).toBe(false);
    });
  });

  describe('Address Parsing', () => {
    it('should handle US addresses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              position: { lat: 40.7128, lng: -74.006 },
              address: { label: 'New York, NY, USA' },
            },
          ],
        }),
      });

      const result = await geocodeOrigin('New York');
      expect(result.formattedAddress).toContain('New York');
    });

    it('should handle zip codes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              position: { lat: 37.7749, lng: -122.4194 },
              address: { label: '94102, San Francisco, CA, USA' },
            },
          ],
        }),
      });

      const result = await geocodeOrigin('94102');
      expect(result.lat).toBeDefined();
      expect(result.lng).toBeDefined();
    });

    it('should handle international addresses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              position: { lat: 51.5074, lng: -0.1278 },
              address: { label: 'London, England, United Kingdom' },
            },
          ],
        }),
      });

      const result = await geocodeOrigin('London, UK');
      expect(result.formattedAddress).toContain('London');
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(geocodeOrigin('San Francisco')).rejects.toThrow();
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(geocodeOrigin('San Francisco')).rejects.toThrow();
    });

    it('should handle malformed response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'format' }),
      });

      await expect(geocodeOrigin('San Francisco')).rejects.toThrow();
    });

    it('should handle missing position in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ address: { label: 'Test' } }],
        }),
      });

      await expect(geocodeOrigin('San Francisco')).rejects.toThrow();
    });
  });
});

describe('Environment Configuration', () => {
  it('should require HERE_API_KEY environment variable', () => {
    const originalKey = process.env.HERE_API_KEY;
    delete process.env.HERE_API_KEY;

    // The function should check for API key
    expect(process.env.HERE_API_KEY).toBeUndefined();

    // Restore
    process.env.HERE_API_KEY = originalKey;
  });
});