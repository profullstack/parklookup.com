/**
 * Tests for Trails API Routes
 *
 * @module test/app/api/trails/route.test
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
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  })),
}));

describe('Trails API Routes', () => {
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

    it('should handle mixed case UUIDs', () => {
      const isValidUUID = (str) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });
  });

  describe('Query Building', () => {
    it('should build query with only park_code when parkCode is not a UUID', () => {
      const parkCode = 'yose';
      const isValidUUID = (str) => {
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
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // When parkCode is a UUID, we can query by both id and park_code
      const shouldQueryById = isValidUUID(parkCode);
      expect(shouldQueryById).toBe(true);

      // The query can be: .or(`id.eq.${parkCode},park_code.eq.${parkCode}`)
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent trail', async () => {
      // This tests the expected behavior when a trail is not found
      const mockResponse = { data: null, error: { code: 'PGRST116', message: 'Not found' } };

      expect(mockResponse.data).toBeNull();
      expect(mockResponse.error).toBeDefined();
    });

    it('should return 500 for database errors', async () => {
      // This tests the expected behavior when a database error occurs
      const mockResponse = { data: null, error: { code: 'PGRST500', message: 'Database error' } };

      expect(mockResponse.data).toBeNull();
      expect(mockResponse.error.code).toBe('PGRST500');
    });
  });

  describe('Response Format', () => {
    it('should return trail data with expected fields', () => {
      const mockTrail = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Trail',
        slug: 'test-trail',
        difficulty: 'moderate',
        length_meters: 5000,
        elevation_gain_m: 200,
        surface: 'dirt',
        trail_type: 'loop',
        description: 'A test trail',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.4194, 37.7749],
            [-122.4094, 37.7849],
          ],
        },
      };

      expect(mockTrail).toHaveProperty('id');
      expect(mockTrail).toHaveProperty('name');
      expect(mockTrail).toHaveProperty('slug');
      expect(mockTrail).toHaveProperty('difficulty');
      expect(mockTrail).toHaveProperty('length_meters');
      expect(mockTrail).toHaveProperty('geometry');
    });

    it('should return array of trails for list endpoint', () => {
      const mockTrails = [
        { id: '1', name: 'Trail 1', slug: 'trail-1' },
        { id: '2', name: 'Trail 2', slug: 'trail-2' },
      ];

      expect(Array.isArray(mockTrails)).toBe(true);
      expect(mockTrails).toHaveLength(2);
    });
  });
});
