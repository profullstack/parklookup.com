/**
 * Tests for Static Map Generator
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sharp module
vi.mock('sharp', () => {
  const mockSharpInstance = {
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-png-data')),
  };

  const mockSharp = vi.fn(() => mockSharpInstance);
  mockSharp.mockInstance = mockSharpInstance;

  return {
    default: mockSharp,
  };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Static Map Generator', () => {
  let generateStaticMap;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock successful tile fetch
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    // Import the module after mocks are set up
    const module = await import('../../../lib/map/static-map-generator.js');
    generateStaticMap = module.generateStaticMap;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('generateStaticMap', () => {
    it('should return null when no points are provided', async () => {
      const result = await generateStaticMap({ points: [] });
      expect(result).toBeNull();
    });

    it('should return null when points array is undefined', async () => {
      const result = await generateStaticMap({});
      expect(result).toBeNull();
    });

    it('should generate a map buffer with valid points', async () => {
      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
      ];

      const result = await generateStaticMap({ points });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('mock-png-data');
    });

    it('should generate a map with a single point', async () => {
      const points = [{ lat: 37.8, lng: -122.4, label: 'S', isOrigin: true }];

      const result = await generateStaticMap({ points });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle route coordinates', async () => {
      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
      ];
      const routeCoordinates = [
        [37.8, -122.4],
        [37.9, -122.3],
        [38.0, -122.2],
      ];

      const result = await generateStaticMap({ points, routeCoordinates });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should fetch tiles from OSM server', async () => {
      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
      ];

      await generateStaticMap({ points });

      // Should have fetched at least one tile
      expect(mockFetch).toHaveBeenCalled();
      const fetchCalls = mockFetch.mock.calls;
      expect(fetchCalls.some((call) => call[0].includes('tile.openstreetmap.org'))).toBe(true);
    });

    it('should handle tile fetch failures gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const points = [{ lat: 37.8, lng: -122.4, label: 'S', isOrigin: true }];

      // Should not throw, just skip failed tiles
      const result = await generateStaticMap({ points });
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const points = [{ lat: 37.8, lng: -122.4, label: 'S', isOrigin: true }];

      // Should not throw, just skip failed tiles
      const result = await generateStaticMap({ points });
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should include User-Agent header in tile requests', async () => {
      const points = [{ lat: 37.8, lng: -122.4, label: 'S', isOrigin: true }];

      await generateStaticMap({ points });

      const fetchCalls = mockFetch.mock.calls;
      expect(fetchCalls.length).toBeGreaterThan(0);
      expect(fetchCalls[0][1]).toHaveProperty('headers');
      expect(fetchCalls[0][1].headers['User-Agent']).toContain('ParkLookup');
    });

    it('should handle points with extreme coordinates', async () => {
      const points = [
        { lat: -89, lng: -179, label: '1', isOrigin: false },
        { lat: 89, lng: 179, label: '2', isOrigin: false },
      ];

      const result = await generateStaticMap({ points });
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle points at the same location', async () => {
      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 37.8, lng: -122.4, label: '1', isOrigin: false },
      ];

      const result = await generateStaticMap({ points });
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('sharp compositing', () => {
    it('should use sharp for image compositing', async () => {
      const sharp = (await import('sharp')).default;

      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
      ];

      await generateStaticMap({ points });

      // Sharp should have been called to create the base image
      expect(sharp).toHaveBeenCalled();
    });

    it('should composite tiles onto the base image', async () => {
      const sharp = (await import('sharp')).default;

      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
      ];

      await generateStaticMap({ points });

      // Composite should have been called
      expect(sharp.mockInstance.composite).toHaveBeenCalled();
    });
  });

  describe('zoom calculation', () => {
    it('should calculate appropriate zoom for nearby points', async () => {
      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 37.81, lng: -122.39, label: '1', isOrigin: false },
      ];

      // Should not throw and should generate a map
      const result = await generateStaticMap({ points });
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should calculate appropriate zoom for distant points', async () => {
      const points = [
        { lat: 30.0, lng: -120.0, label: 'S', isOrigin: true },
        { lat: 45.0, lng: -100.0, label: '1', isOrigin: false },
      ];

      // Should not throw and should generate a map
      const result = await generateStaticMap({ points });
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('SVG generation', () => {
    it('should create markers for all points', async () => {
      const sharp = (await import('sharp')).default;

      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
        { lat: 38.2, lng: -122.0, label: '2', isOrigin: false },
      ];

      await generateStaticMap({ points });

      // Composite should have been called multiple times for markers
      const compositeCalls = sharp.mockInstance.composite.mock.calls;
      expect(compositeCalls.length).toBeGreaterThan(0);
    });

    it('should draw route line when route coordinates are provided', async () => {
      const sharp = (await import('sharp')).default;

      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
      ];
      const routeCoordinates = [
        [37.8, -122.4],
        [37.9, -122.3],
        [38.0, -122.2],
      ];

      await generateStaticMap({ points, routeCoordinates });

      // Composite should have been called for route
      expect(sharp.mockInstance.composite).toHaveBeenCalled();
    });
  });
});