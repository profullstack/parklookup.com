/**
 * Tests for Trip PDF Generator
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatTripForPdf, generateTripPdf } from '@/lib/pdf/trip-pdf-generator';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('Font file not found')),
}));

// Mock @pdf-lib/fontkit
vi.mock('@pdf-lib/fontkit', () => ({
  default: {},
}));

// Mock static map generator
vi.mock('@/lib/map/static-map-generator', () => ({
  generateStaticMap: vi.fn().mockResolvedValue(null),
}));

// Mock pdf-lib
vi.mock('pdf-lib', () => {
  const mockPage = {
    drawText: vi.fn(),
    drawLine: vi.fn(),
  };

  const mockFont = {
    widthOfTextAtSize: vi.fn().mockReturnValue(100),
  };

  const mockPdfDoc = {
    addPage: vi.fn().mockReturnValue(mockPage),
    embedFont: vi.fn().mockResolvedValue(mockFont),
    getPageCount: vi.fn().mockReturnValue(1),
    getPage: vi.fn().mockReturnValue(mockPage),
    save: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])), // %PDF
    registerFontkit: vi.fn(),
  };

  return {
    PDFDocument: {
      create: vi.fn().mockResolvedValue(mockPdfDoc),
    },
    StandardFonts: {
      Helvetica: 'Helvetica',
      HelveticaBold: 'Helvetica-Bold',
    },
    rgb: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0 }),
  };
});

describe('Trip PDF Generator', () => {
  describe('formatTripForPdf', () => {
    it('should format a complete trip correctly', () => {
      const trip = {
        title: 'California Adventure',
        origin: 'San Francisco, CA',
        startDate: '2024-06-15',
        endDate: '2024-06-20',
        difficulty: 'moderate',
        radiusMiles: 150,
        summary: 'An amazing trip through California parks',
        stops: [
          {
            dayNumber: 1,
            park: { name: 'Yosemite National Park', description: 'Beautiful park' },
            parkCode: 'yose',
            activities: ['hiking', 'photography'],
            morningPlan: 'Visit Half Dome',
            afternoonPlan: 'Explore valley',
            eveningPlan: 'Campfire',
            drivingNotes: '3 hours from SF',
            highlights: 'Half Dome views',
          },
        ],
        packingList: {
          essentials: ['Water', 'Sunscreen'],
          clothing: ['Hiking boots'],
          gear: ['Camera'],
          optional: ['Binoculars'],
        },
        safetyNotes: ['Watch for wildlife', 'Stay on trails'],
        bestPhotoSpots: ['Tunnel View', 'Mirror Lake'],
        estimatedBudget: {
          entrance_fees: '$35',
          fuel_estimate: '$100',
          total_range: '$200-$300',
        },
      };

      const result = formatTripForPdf(trip);

      expect(result.title).toBe('California Adventure');
      expect(result.origin).toBe('San Francisco, CA');
      expect(result.difficulty).toBe('moderate');
      expect(result.radiusMiles).toBe(150);
      expect(result.summary).toBe('An amazing trip through California parks');
      expect(result.stops).toHaveLength(1);
      expect(result.stops[0].parkName).toBe('Yosemite National Park');
      expect(result.stops[0].activities).toEqual(['hiking', 'photography']);
      expect(result.packingList.essentials).toEqual(['Water', 'Sunscreen']);
      expect(result.safetyNotes).toEqual(['Watch for wildlife', 'Stay on trails']);
      expect(result.bestPhotoSpots).toEqual(['Tunnel View', 'Mirror Lake']);
      expect(result.estimatedBudget.entrance_fees).toBe('$35');
    });

    it('should handle missing optional fields', () => {
      const trip = {
        title: 'Simple Trip',
        stops: [],
      };

      const result = formatTripForPdf(trip);

      expect(result.title).toBe('Simple Trip');
      expect(result.origin).toBe('Unknown');
      expect(result.difficulty).toBe('moderate');
      expect(result.radiusMiles).toBe(100);
      expect(result.summary).toBe('');
      expect(result.stops).toEqual([]);
      expect(result.packingList).toBeNull();
      expect(result.safetyNotes).toEqual([]);
      expect(result.bestPhotoSpots).toEqual([]);
      expect(result.estimatedBudget).toBeNull();
    });

    it('should handle empty trip object', () => {
      const result = formatTripForPdf({});

      expect(result.title).toBe('Trip Plan');
      expect(result.origin).toBe('Unknown');
      expect(result.stops).toEqual([]);
    });

    it('should format dates correctly', () => {
      const trip = {
        startDate: '2024-12-25T12:00:00Z',
        endDate: '2024-12-31T12:00:00Z',
      };

      const result = formatTripForPdf(trip);

      expect(result.startDate).toContain('December');
      expect(result.startDate).toContain('2024');
      expect(result.endDate).toContain('December');
      expect(result.endDate).toContain('2024');
    });

    it('should handle stops without park data', () => {
      const trip = {
        stops: [
          {
            dayNumber: 1,
            parkCode: 'test-park',
          },
        ],
      };

      const result = formatTripForPdf(trip);

      expect(result.stops[0].parkName).toBe('test-park');
      expect(result.stops[0].parkDescription).toBe('');
    });
  });

  describe('generateTripPdf', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should generate a PDF buffer', async () => {
      const trip = {
        title: 'Test Trip',
        origin: 'Test City',
        startDate: '2024-06-15',
        endDate: '2024-06-20',
        stops: [
          {
            dayNumber: 1,
            park: { name: 'Test Park' },
            activities: ['hiking'],
          },
        ],
      };

      const result = await generateTripPdf(trip);

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.filename).toMatch(/\.pdf$/);
    });

    it('should generate a valid filename', async () => {
      const trip = {
        title: 'My Amazing Trip!',
        stops: [],
      };

      const result = await generateTripPdf(trip);

      expect(result.filename).toMatch(/^my-amazing-trip-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('should handle special characters in title', async () => {
      const trip = {
        title: 'Trip #1: California & Oregon!!!',
        stops: [],
      };

      const result = await generateTripPdf(trip);

      expect(result.filename).toMatch(/^trip-1-california-oregon-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('should handle empty title', async () => {
      const trip = {
        title: '',
        stops: [],
      };

      const result = await generateTripPdf(trip);

      // Empty title defaults to "Trip Plan" which becomes "trip-plan"
      expect(result.filename).toMatch(/^trip-plan-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('should include all trip sections', async () => {
      const { PDFDocument } = await import('pdf-lib');
      const mockCreate = PDFDocument.create;

      const trip = {
        title: 'Complete Trip',
        origin: 'San Francisco',
        startDate: '2024-06-15',
        endDate: '2024-06-20',
        summary: 'A great trip',
        stops: [
          {
            dayNumber: 1,
            park: { name: 'Yosemite' },
            morningPlan: 'Hike',
            afternoonPlan: 'Explore',
            eveningPlan: 'Rest',
            drivingNotes: 'Long drive',
            highlights: 'Amazing views',
            activities: ['hiking'],
          },
        ],
        packingList: {
          essentials: ['Water'],
        },
        safetyNotes: ['Be careful'],
        bestPhotoSpots: ['Tunnel View'],
        estimatedBudget: {
          entrance_fees: '$35',
        },
      };

      await generateTripPdf(trip);

      // Verify PDF was created
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should handle trips with multiple stops', async () => {
      const trip = {
        title: 'Multi-Stop Trip',
        stops: [
          { dayNumber: 1, park: { name: 'Park 1' } },
          { dayNumber: 2, park: { name: 'Park 2' } },
          { dayNumber: 3, park: { name: 'Park 3' } },
        ],
      };

      const result = await generateTripPdf(trip);

      expect(result.buffer).toBeDefined();
      expect(result.filename).toContain('multi-stop-trip');
    });

    it('should handle trips with no stops', async () => {
      const trip = {
        title: 'Empty Trip',
        stops: [],
      };

      const result = await generateTripPdf(trip);

      expect(result.buffer).toBeDefined();
    });
  });
});