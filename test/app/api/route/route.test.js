/**
 * Route API Tests
 * Tests for the OSRM routing API endpoint
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/route/route';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Route API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/route', () => {
    it('should return 400 if waypoints parameter is missing', async () => {
      const request = new Request('http://localhost/api/route');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing waypoints parameter');
    });

    it('should return 400 if less than 2 waypoints provided', async () => {
      const request = new Request('http://localhost/api/route?waypoints=-122.4194,37.7749');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('At least 2 waypoints are required');
    });

    it('should return 400 for invalid coordinate format', async () => {
      const request = new Request('http://localhost/api/route?waypoints=invalid,coords;-121.8863,37.3382');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid coordinate pair');
    });

    it('should return 400 for coordinates out of range', async () => {
      const request = new Request('http://localhost/api/route?waypoints=-122.4194,100;-121.8863,37.3382');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Coordinates out of range');
    });

    it('should return 400 for longitude out of range', async () => {
      const request = new Request('http://localhost/api/route?waypoints=-200,37.7749;-121.8863,37.3382');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Coordinates out of range');
    });

    it('should return route data for valid waypoints', async () => {
      const mockOsrmResponse = {
        code: 'Ok',
        routes: [
          {
            geometry: {
              coordinates: [
                [-122.4194, 37.7749],
                [-122.3, 37.6],
                [-121.8863, 37.3382],
              ],
            },
            distance: 80467, // ~50 miles in meters
            duration: 3600, // 1 hour in seconds
            legs: [
              {
                distance: 40233,
                duration: 1800,
                summary: 'US-101 S',
                steps: [
                  {
                    maneuver: {
                      instruction: 'Head south on US-101',
                      type: 'depart',
                      modifier: 'straight',
                      location: [-122.4194, 37.7749],
                    },
                    distance: 40233,
                    duration: 1800,
                    name: 'US-101',
                    mode: 'driving',
                  },
                ],
              },
              {
                distance: 40234,
                duration: 1800,
                summary: 'US-101 S',
                steps: [],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOsrmResponse,
      });

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.route).toBeDefined();
      expect(data.route.coordinates).toHaveLength(3);
      // Coordinates should be converted to [lat, lng] format
      expect(data.route.coordinates[0]).toEqual([37.7749, -122.4194]);
      expect(data.route.summary).toBeDefined();
      expect(data.route.summary.distanceMiles).toBe('50.0');
      expect(data.route.summary.durationHours).toBe('1.0');
      expect(data.route.legs).toHaveLength(2);
    });

    it('should return 502 if OSRM API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toBe('Failed to fetch route from routing service');
    });

    it('should return 404 if no route found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'NoRoute',
          routes: [],
        }),
      });

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No route found between the specified waypoints');
    });

    it('should handle multiple waypoints', async () => {
      const mockOsrmResponse = {
        code: 'Ok',
        routes: [
          {
            geometry: {
              coordinates: [
                [-122.4194, 37.7749],
                [-122.0, 37.5],
                [-121.8863, 37.3382],
                [-121.5, 37.0],
                [-121.0, 36.5],
              ],
            },
            distance: 160934, // ~100 miles
            duration: 7200, // 2 hours
            legs: [
              { distance: 53644, duration: 2400, summary: 'Leg 1', steps: [] },
              { distance: 53645, duration: 2400, summary: 'Leg 2', steps: [] },
              { distance: 53645, duration: 2400, summary: 'Leg 3', steps: [] },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOsrmResponse,
      });

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382;-121.0,36.5'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.route.coordinates).toHaveLength(5);
      expect(data.route.legs).toHaveLength(3);
    });

    it('should handle empty geometry gracefully', async () => {
      const mockOsrmResponse = {
        code: 'Ok',
        routes: [
          {
            geometry: {},
            distance: 1000,
            duration: 60,
            legs: [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOsrmResponse,
      });

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.route.coordinates).toEqual([]);
    });

    it('should include step-by-step instructions in legs', async () => {
      const mockOsrmResponse = {
        code: 'Ok',
        routes: [
          {
            geometry: {
              coordinates: [
                [-122.4194, 37.7749],
                [-121.8863, 37.3382],
              ],
            },
            distance: 80467,
            duration: 3600,
            legs: [
              {
                distance: 80467,
                duration: 3600,
                summary: 'US-101 S',
                steps: [
                  {
                    maneuver: {
                      instruction: 'Head south on Market Street',
                      type: 'depart',
                      modifier: 'straight',
                      location: [-122.4194, 37.7749],
                    },
                    distance: 500,
                    duration: 60,
                    name: 'Market Street',
                    mode: 'driving',
                  },
                  {
                    maneuver: {
                      instruction: 'Turn right onto US-101 S',
                      type: 'turn',
                      modifier: 'right',
                      location: [-122.41, 37.77],
                    },
                    distance: 79967,
                    duration: 3540,
                    name: 'US-101',
                    mode: 'driving',
                  },
                ],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOsrmResponse,
      });

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.route.legs[0].steps).toHaveLength(2);
      expect(data.route.legs[0].steps[0].instruction).toBe('Head south on Market Street');
      expect(data.route.legs[0].steps[0].maneuver.type).toBe('depart');
      expect(data.route.legs[0].steps[1].instruction).toBe('Turn right onto US-101 S');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should calculate leg duration in minutes', async () => {
      const mockOsrmResponse = {
        code: 'Ok',
        routes: [
          {
            geometry: {
              coordinates: [
                [-122.4194, 37.7749],
                [-121.8863, 37.3382],
              ],
            },
            distance: 80467,
            duration: 3600,
            legs: [
              {
                distance: 80467,
                duration: 2700, // 45 minutes
                summary: 'US-101 S',
                steps: [],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOsrmResponse,
      });

      const request = new Request(
        'http://localhost/api/route?waypoints=-122.4194,37.7749;-121.8863,37.3382'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.route.legs[0].durationMinutes).toBe(45);
    });
  });
});