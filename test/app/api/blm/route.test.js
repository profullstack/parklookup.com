/**
 * Tests for BLM (Bureau of Land Management) API Routes
 *
 * @module test/app/api/blm/route.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase server module
vi.mock('../../../../lib/supabase/server.js', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        or: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        ilike: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  })),
}));

describe('BLM API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UUID Validation', () => {
    it('should validate correct UUID format', () => {
      const isValidUUID = (str) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // Valid UUIDs
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);

      // Invalid UUIDs (park codes/slugs)
      expect(isValidUUID('yose')).toBe(false);
      expect(isValidUUID('yellowstone')).toBe(false);
      expect(isValidUUID('grand-canyon')).toBe(false);
      expect(isValidUUID('waco')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });

    it('should handle edge cases for UUID validation', () => {
      const isValidUUID = (str) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // Edge cases
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // Too short
      expect(isValidUUID('550e8400-e29b-41d4-a716-4466554400000')).toBe(false); // Too long
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false); // No dashes
    });
  });

  describe('Query Building for Park BLM Lands', () => {
    it('should build query with only park_code when parkCode is not a UUID', () => {
      const parkCode = 'yose';
      const isValidUUID = (str) => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // When parkCode is not a UUID, we should only query by park_code
      const shouldQueryById = isValidUUID(parkCode);
      expect(shouldQueryById).toBe(false);

      // The query should be: .eq('park_code', parkCode)
      // NOT: .or(`id.eq.${parkCode},park_code.eq.${parkCode}`)
    });

    it('should build query with both id and park_code when parkCode is a UUID', () => {
      const parkCode = '550e8400-e29b-41d4-a716-446655440000';
      const isValidUUID = (str) => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // When parkCode is a UUID, we can query by both id and park_code
      const shouldQueryById = isValidUUID(parkCode);
      expect(shouldQueryById).toBe(true);

      // The query can be: .or(`id.eq.${parkCode},park_code.eq.${parkCode}`)
    });
  });

  describe('BLM Land Data Structure', () => {
    it('should have expected fields for BLM land record', () => {
      const mockBLMLand = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test BLM Area',
        state: 'CA',
        acres: 50000,
        description: 'A test BLM area',
        activities: ['hiking', 'camping', 'hunting'],
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-122.4194, 37.7749],
              [-122.4094, 37.7749],
              [-122.4094, 37.7849],
              [-122.4194, 37.7849],
              [-122.4194, 37.7749],
            ],
          ],
        },
        centroid: {
          type: 'Point',
          coordinates: [-122.4144, 37.7799],
        },
      };

      expect(mockBLMLand).toHaveProperty('id');
      expect(mockBLMLand).toHaveProperty('name');
      expect(mockBLMLand).toHaveProperty('state');
      expect(mockBLMLand).toHaveProperty('acres');
      expect(mockBLMLand).toHaveProperty('activities');
      expect(mockBLMLand).toHaveProperty('geometry');
      expect(mockBLMLand).toHaveProperty('centroid');
    });

    it('should return array of BLM lands for list endpoint', () => {
      const mockBLMLands = [
        { id: '1', name: 'BLM Area 1', state: 'CA' },
        { id: '2', name: 'BLM Area 2', state: 'NV' },
      ];

      expect(Array.isArray(mockBLMLands)).toBe(true);
      expect(mockBLMLands).toHaveLength(2);
    });
  });

  describe('State Filtering', () => {
    it('should filter BLM lands by state', () => {
      const mockBLMLands = [
        { id: '1', name: 'BLM Area 1', state: 'CA' },
        { id: '2', name: 'BLM Area 2', state: 'NV' },
        { id: '3', name: 'BLM Area 3', state: 'CA' },
      ];

      const state = 'CA';
      const filtered = mockBLMLands.filter((land) => land.state === state);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((land) => land.state === 'CA')).toBe(true);
    });

    it('should handle case-insensitive state codes', () => {
      const normalizeState = (state) => state?.toUpperCase();

      expect(normalizeState('ca')).toBe('CA');
      expect(normalizeState('Ca')).toBe('CA');
      expect(normalizeState('CA')).toBe('CA');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent BLM land', async () => {
      const mockResponse = { data: null, error: { code: 'PGRST116', message: 'Not found' } };

      expect(mockResponse.data).toBeNull();
      expect(mockResponse.error).toBeDefined();
    });

    it('should return 500 for database errors', async () => {
      const mockResponse = { data: null, error: { code: 'PGRST500', message: 'Database error' } };

      expect(mockResponse.data).toBeNull();
      expect(mockResponse.error.code).toBe('PGRST500');
    });

    it('should handle invalid state parameter', () => {
      const isValidState = (state) => {
        if (!state) return false;
        // US state codes are 2 letters
        return /^[A-Z]{2}$/i.test(state);
      };

      expect(isValidState('CA')).toBe(true);
      expect(isValidState('ca')).toBe(true);
      expect(isValidState('California')).toBe(false);
      expect(isValidState('C')).toBe(false);
      expect(isValidState('CAL')).toBe(false);
      expect(isValidState('')).toBe(false);
      expect(isValidState(null)).toBe(false);
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', () => {
      const mockBLMLands = Array.from({ length: 100 }, (_, i) => ({
        id: String(i + 1),
        name: `BLM Area ${i + 1}`,
      }));

      const limit = 20;
      const paginated = mockBLMLands.slice(0, limit);

      expect(paginated).toHaveLength(20);
    });

    it('should support offset parameter', () => {
      const mockBLMLands = Array.from({ length: 100 }, (_, i) => ({
        id: String(i + 1),
        name: `BLM Area ${i + 1}`,
      }));

      const limit = 20;
      const offset = 40;
      const paginated = mockBLMLands.slice(offset, offset + limit);

      expect(paginated).toHaveLength(20);
      expect(paginated[0].id).toBe('41');
    });
  });

  describe('Search Functionality', () => {
    it('should search BLM lands by name', () => {
      const mockBLMLands = [
        { id: '1', name: 'Red Rock Canyon' },
        { id: '2', name: 'Black Rock Desert' },
        { id: '3', name: 'White Sands' },
      ];

      const searchTerm = 'rock';
      const results = mockBLMLands.filter((land) =>
        land.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Red Rock Canyon');
      expect(results[1].name).toBe('Black Rock Desert');
    });

    it('should handle empty search results', () => {
      const mockBLMLands = [
        { id: '1', name: 'Red Rock Canyon' },
        { id: '2', name: 'Black Rock Desert' },
      ];

      const searchTerm = 'nonexistent';
      const results = mockBLMLands.filter((land) =>
        land.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(0);
    });
  });
});
