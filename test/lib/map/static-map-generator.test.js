/**
 * Tests for Static Map Generator
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock canvas module
vi.mock('canvas', () => {
  const mockContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
  };

  const mockCanvas = {
    getContext: vi.fn(() => mockContext),
    toBuffer: vi.fn(() => Buffer.from('mock-png-data')),
    width: 800,
    height: 400,
  };

  return {
    createCanvas: vi.fn(() => mockCanvas),
    loadImage: vi.fn(() =>
      Promise.resolve({
        width: 256,
        height: 256,
      })
    ),
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

    it('should use custom width and height', async () => {
      const { createCanvas } = await import('canvas');
      const points = [{ lat: 37.8, lng: -122.4, label: 'S', isOrigin: true }];

      await generateStaticMap({ points, width: 1000, height: 500 });

      expect(createCanvas).toHaveBeenCalledWith(1000, 500);
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

  describe('marker drawing', () => {
    it('should draw markers for all points', async () => {
      const { createCanvas } = await import('canvas');
      const mockCanvas = createCanvas();
      const mockCtx = mockCanvas.getContext('2d');

      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
        { lat: 38.2, lng: -122.0, label: '2', isOrigin: false },
      ];

      await generateStaticMap({ points });

      // Should have drawn circles for markers
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });
  });

  describe('route drawing', () => {
    it('should draw route line when route coordinates are provided', async () => {
      const { createCanvas } = await import('canvas');
      const mockCanvas = createCanvas();
      const mockCtx = mockCanvas.getContext('2d');

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

      // Should have drawn lines
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should draw dashed line when no route coordinates but multiple points', async () => {
      const { createCanvas } = await import('canvas');
      const mockCanvas = createCanvas();
      const mockCtx = mockCanvas.getContext('2d');

      const points = [
        { lat: 37.8, lng: -122.4, label: 'S', isOrigin: true },
        { lat: 38.0, lng: -122.2, label: '1', isOrigin: false },
      ];

      await generateStaticMap({ points, routeCoordinates: [] });

      // Should have set dashed line
      expect(mockCtx.setLineDash).toHaveBeenCalled();
    });
  });

  describe('zoom calculation', () => {
    it('should calculate appropriate zoom for nearby points', async () => {
      const points = [
        { lat: 37.80, lng: -122.40, label: 'S', isOrigin: true },
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
});