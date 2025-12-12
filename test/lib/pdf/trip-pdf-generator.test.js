/**
 * Trip PDF Generator Tests
 * Tests for PDF export functionality for travel plans
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdfkit before importing the module
vi.mock('pdfkit', () => {
  const mockDoc = {
    pipe: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    font: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    addPage: vi.fn().mockReturnThis(),
    end: vi.fn(),
    on: vi.fn((event, callback) => {
      if (event === 'end') {
        setTimeout(callback, 0);
      }
      return mockDoc;
    }),
    y: 100,
    page: { height: 792, width: 612 },
  };
  return { default: vi.fn(() => mockDoc) };
});

// Import after mocking
const { generateTripPdf, formatTripForPdf } = await import(
  '@/lib/pdf/trip-pdf-generator.js'
);

describe('Trip PDF Generator', () => {
  const mockTrip = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'California National Parks Adventure',
    origin: 'Los Angeles, CA',
    originLat: 34.0522,
    originLng: -118.2437,
    startDate: '2024-06-15',
    endDate: '2024-06-18',
    interests: ['hiking', 'photography', 'wildlife'],
    difficulty: 'moderate',
    radiusMiles: 200,
    summary: 'An exciting 4-day adventure through California\'s most beautiful national parks.',
    packingList: {
      essentials: ['Water bottles', 'Sunscreen', 'First aid kit'],
      clothing: ['Hiking boots', 'Layered clothing', 'Hat'],
      gear: ['Camera', 'Binoculars', 'Backpack'],
      optional: ['Tripod', 'Field guide'],
    },
    safetyNotes: [
      'Stay on marked trails',
      'Carry plenty of water',
      'Check weather conditions before hiking',
    ],
    bestPhotoSpots: [
      'Half Dome viewpoint at sunrise',
      'Tunnel View overlook',
      'Mirror Lake reflection shots',
    ],
    estimatedBudget: {
      entrance_fees: '$35 per vehicle',
      fuel_estimate: '$80-100',
      total_range: '$200-300',
    },
    stops: [
      {
        id: 'stop-1',
        dayNumber: 1,
        parkCode: 'yose',
        park: {
          name: 'Yosemite National Park',
          description: 'Iconic granite cliffs and waterfalls',
          states: 'CA',
          latitude: 37.8651,
          longitude: -119.5383,
          designation: 'National Park',
        },
        activities: ['hiking', 'photography'],
        morningPlan: 'Arrive early and hike to Yosemite Falls',
        afternoonPlan: 'Explore Yosemite Valley floor',
        eveningPlan: 'Sunset at Tunnel View',
        drivingNotes: '4 hour drive from Los Angeles',
        highlights: 'Half Dome, El Capitan, Yosemite Falls',
      },
      {
        id: 'stop-2',
        dayNumber: 2,
        parkCode: 'sequ',
        park: {
          name: 'Sequoia National Park',
          description: 'Home to giant sequoia trees',
          states: 'CA',
          latitude: 36.4864,
          longitude: -118.5658,
          designation: 'National Park',
        },
        activities: ['hiking', 'nature walks'],
        morningPlan: 'Visit General Sherman Tree',
        afternoonPlan: 'Hike Congress Trail',
        eveningPlan: 'Stargazing at Crescent Meadow',
        drivingNotes: '3 hour drive from Yosemite',
        highlights: 'General Sherman Tree, Moro Rock',
      },
    ],
  };

  describe('formatTripForPdf', () => {
    it('should format trip data for PDF generation', () => {
      const formatted = formatTripForPdf(mockTrip);

      expect(formatted).toHaveProperty('title', mockTrip.title);
      expect(formatted).toHaveProperty('origin', mockTrip.origin);
      expect(formatted).toHaveProperty('dateRange');
      expect(formatted).toHaveProperty('duration');
      expect(formatted).toHaveProperty('stops');
      expect(formatted.stops).toHaveLength(2);
    });

    it('should calculate correct duration', () => {
      const formatted = formatTripForPdf(mockTrip);

      // June 15 to June 18 = 4 days
      expect(formatted.duration).toBe('4 days');
    });

    it('should format dates correctly', () => {
      const formatted = formatTripForPdf(mockTrip);

      expect(formatted.dateRange).toContain('June');
      expect(formatted.dateRange).toContain('2024');
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalTrip = {
        id: '123',
        title: 'Simple Trip',
        origin: 'NYC',
        startDate: '2024-07-01',
        endDate: '2024-07-02',
        stops: [],
      };

      const formatted = formatTripForPdf(minimalTrip);

      expect(formatted.title).toBe('Simple Trip');
      expect(formatted.packingList).toBeNull();
      expect(formatted.safetyNotes).toEqual([]);
      expect(formatted.bestPhotoSpots).toEqual([]);
    });

    it('should format stop data correctly', () => {
      const formatted = formatTripForPdf(mockTrip);
      const firstStop = formatted.stops[0];

      expect(firstStop).toHaveProperty('dayNumber', 1);
      expect(firstStop).toHaveProperty('parkName', 'Yosemite National Park');
      expect(firstStop).toHaveProperty('activities');
      expect(firstStop).toHaveProperty('schedule');
      expect(firstStop.schedule).toHaveProperty('morning');
      expect(firstStop.schedule).toHaveProperty('afternoon');
      expect(firstStop.schedule).toHaveProperty('evening');
    });
  });

  describe('generateTripPdf', () => {
    it('should generate a PDF buffer', async () => {
      const result = await generateTripPdf(mockTrip);

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
    });

    it('should generate appropriate filename', async () => {
      const result = await generateTripPdf(mockTrip);

      expect(result.filename).toContain('california-national-parks-adventure');
      expect(result.filename.endsWith('.pdf')).toBe(true);
    });

    it('should handle trips with no stops', async () => {
      const emptyTrip = {
        ...mockTrip,
        stops: [],
      };

      const result = await generateTripPdf(emptyTrip);

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
    });

    it('should throw error for invalid trip data', async () => {
      await expect(generateTripPdf(null)).rejects.toThrow('Invalid trip data');
      await expect(generateTripPdf(undefined)).rejects.toThrow('Invalid trip data');
      await expect(generateTripPdf({})).rejects.toThrow('Invalid trip data');
    });

    it('should throw error for trip without title', async () => {
      const invalidTrip = { ...mockTrip, title: '' };

      await expect(generateTripPdf(invalidTrip)).rejects.toThrow('Invalid trip data');
    });
  });
});