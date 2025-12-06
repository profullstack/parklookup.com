/**
 * Tests for NPS API data fetcher
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('NPS API Fetcher', () => {
  const mockParkData = {
    total: '471',
    limit: '50',
    start: '0',
    data: [
      {
        id: '77E0D7F0-1942-494A-ACE2-9004D2BDC59E',
        parkCode: 'acad',
        fullName: 'Acadia National Park',
        description: 'Acadia National Park protects the natural beauty...',
        states: 'ME',
        designation: 'National Park',
        latitude: '44.409286',
        longitude: '-68.247501',
        url: 'https://www.nps.gov/acad/index.htm',
        weatherInfo: 'Located on Mount Desert Island...',
        images: [
          {
            url: 'https://www.nps.gov/common/uploads/structured_data/acad.jpg',
            title: 'Acadia',
            altText: 'Ocean view',
          },
        ],
        activities: [{ id: '1', name: 'Hiking' }],
        topics: [{ id: '1', name: 'Wildlife' }],
        contacts: { phoneNumbers: [], emailAddresses: [] },
        entranceFees: [],
        operatingHours: [],
        addresses: [],
      },
      {
        id: '6DA17C86-088E-4B4D-B862-7C1BD5CF236B',
        parkCode: 'yose',
        fullName: 'Yosemite National Park',
        description: 'Not just a great valley...',
        states: 'CA',
        designation: 'National Park',
        latitude: '37.84883288',
        longitude: '-119.5571873',
        url: 'https://www.nps.gov/yose/index.htm',
        weatherInfo: 'Yosemite National Park covers...',
        images: [],
        activities: [],
        topics: [],
        contacts: {},
        entranceFees: [],
        operatingHours: [],
        addresses: [],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchParks', () => {
    it('should fetch parks from NPS API with correct parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockParkData),
      });

      const { fetchParks } = await import('@/lib/api/nps.js');
      const result = await fetchParks({ limit: 50, start: 0 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://developer.nps.gov/api/v1/parks'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': expect.any(String),
          }),
        })
      );
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(471);
    });

    it('should handle pagination parameters correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockParkData, start: '100' }),
      });

      const { fetchParks } = await import('@/lib/api/nps.js');
      await fetchParks({ limit: 50, start: 100 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('start=100'),
        expect.any(Object)
      );
    });

    it('should throw error when API returns non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const { fetchParks } = await import('@/lib/api/nps.js');

      await expect(fetchParks()).rejects.toThrow('NPS API error: 401 Unauthorized');
    });

    it('should throw error when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { fetchParks } = await import('@/lib/api/nps.js');

      await expect(fetchParks()).rejects.toThrow('Network error');
    });

    it('should filter by state code when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockParkData),
      });

      const { fetchParks } = await import('@/lib/api/nps.js');
      await fetchParks({ stateCode: 'CA' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('stateCode=CA'),
        expect.any(Object)
      );
    });

    it('should search by query when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockParkData),
      });

      const { fetchParks } = await import('@/lib/api/nps.js');
      await fetchParks({ q: 'yosemite' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=yosemite'),
        expect.any(Object)
      );
    });
  });

  describe('fetchAllParks', () => {
    it('should fetch all parks with pagination', async () => {
      const page1 = { ...mockParkData, total: '100', start: '0', limit: '50' };
      const page2 = {
        ...mockParkData,
        total: '100',
        start: '50',
        limit: '50',
        data: [mockParkData.data[0]],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page2),
        });

      const { fetchAllParks } = await import('@/lib/api/nps.js');
      const result = await fetchAllParks();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(3); // 2 from page1 + 1 from page2
    });

    it('should call onProgress callback during pagination', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockParkData, total: '50' }),
      });

      const onProgress = vi.fn();
      const { fetchAllParks } = await import('@/lib/api/nps.js');
      await fetchAllParks({ onProgress });

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('transformParkData', () => {
    it('should transform NPS API response to database format', async () => {
      const { transformParkData } = await import('@/lib/api/nps.js');
      const transformed = transformParkData(mockParkData.data[0]);

      expect(transformed).toEqual({
        park_code: 'acad',
        full_name: 'Acadia National Park',
        description: 'Acadia National Park protects the natural beauty...',
        states: 'ME',
        designation: 'National Park',
        latitude: 44.409286,
        longitude: -68.247501,
        url: 'https://www.nps.gov/acad/index.htm',
        weather_info: 'Located on Mount Desert Island...',
        images: mockParkData.data[0].images,
        activities: mockParkData.data[0].activities,
        topics: mockParkData.data[0].topics,
        contacts: mockParkData.data[0].contacts,
        entrance_fees: mockParkData.data[0].entranceFees,
        operating_hours: mockParkData.data[0].operatingHours,
        addresses: mockParkData.data[0].addresses,
      });
    });

    it('should handle missing optional fields', async () => {
      const { transformParkData } = await import('@/lib/api/nps.js');
      const minimalPark = {
        parkCode: 'test',
        fullName: 'Test Park',
      };

      const transformed = transformParkData(minimalPark);

      expect(transformed.park_code).toBe('test');
      expect(transformed.full_name).toBe('Test Park');
      expect(transformed.latitude).toBeNull();
      expect(transformed.longitude).toBeNull();
      expect(transformed.images).toEqual([]);
    });

    it('should parse latitude and longitude as numbers', async () => {
      const { transformParkData } = await import('@/lib/api/nps.js');
      const park = {
        parkCode: 'test',
        fullName: 'Test Park',
        latitude: '37.84883288',
        longitude: '-119.5571873',
      };

      const transformed = transformParkData(park);

      expect(typeof transformed.latitude).toBe('number');
      expect(typeof transformed.longitude).toBe('number');
      expect(transformed.latitude).toBeCloseTo(37.84883288);
      expect(transformed.longitude).toBeCloseTo(-119.5571873);
    });
  });

  describe('NPS_API_BASE_URL', () => {
    it('should export the correct base URL', async () => {
      const { NPS_API_BASE_URL } = await import('@/lib/api/nps.js');

      expect(NPS_API_BASE_URL).toBe('https://developer.nps.gov/api/v1');
    });
  });
});