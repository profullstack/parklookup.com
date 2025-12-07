/**
 * Tests for Geocode API Route
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the HERE API library
vi.mock('@/lib/api/here', () => ({
  reverseGeocode: vi.fn(),
  isValidLatitude: vi.fn((lat) => {
    const num = parseFloat(lat);
    return !isNaN(num) && num >= -90 && num <= 90;
  }),
  isValidLongitude: vi.fn((lng) => {
    const num = parseFloat(lng);
    return !isNaN(num) && num >= -180 && num <= 180;
  }),
}));

import { reverseGeocode } from '@/lib/api/here';

describe('Geocode API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('HERE_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe('GET /api/geocode', () => {
    it('should return address for valid coordinates', async () => {
      const mockResult = {
        success: true,
        found: true,
        address: {
          city: 'San Francisco',
          stateCode: 'CA',
        },
        formattedAddress: 'San Francisco, CA',
        shortAddress: 'San Francisco, CA',
        coordinates: { lat: 37.7749, lng: -122.4194 },
      };

      reverseGeocode.mockResolvedValueOnce(mockResult);

      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=37.7749&lng=-122.4194');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.found).toBe(true);
      expect(data.shortAddress).toBe('San Francisco, CA');
    });

    it('should return 400 if lat is missing', async () => {
      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lng=-122.4194');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 400 if lng is missing', async () => {
      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=37.7749');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 400 for invalid latitude', async () => {
      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=100&lng=-122.4194');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('latitude');
    });

    it('should return 400 for invalid longitude', async () => {
      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=37.7749&lng=-200');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('longitude');
    });

    it('should return 503 if HERE API key is not configured', async () => {
      vi.stubEnv('HERE_API_KEY', '');

      vi.resetModules();
      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=37.7749&lng=-122.4194');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain('not configured');
    });

    it('should return 502 for HERE API errors', async () => {
      reverseGeocode.mockRejectedValueOnce(new Error('HERE API error: 401 - Unauthorized'));

      vi.resetModules();
      vi.stubEnv('HERE_API_KEY', 'test-api-key');
      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=37.7749&lng=-122.4194');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toContain('Geocoding service error');
    });

    it('should return 500 for unexpected errors', async () => {
      reverseGeocode.mockRejectedValueOnce(new Error('Unexpected error'));

      vi.resetModules();
      vi.stubEnv('HERE_API_KEY', 'test-api-key');
      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=37.7749&lng=-122.4194');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle not found results', async () => {
      const mockResult = {
        success: true,
        found: false,
        address: null,
        formattedAddress: null,
        shortAddress: null,
        coordinates: { lat: 0, lng: 0 },
      };

      reverseGeocode.mockResolvedValueOnce(mockResult);

      const { GET } = await import('@/app/api/geocode/route.js');

      const request = new Request('http://localhost:8080/api/geocode?lat=0&lng=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.found).toBe(false);
    });
  });
});