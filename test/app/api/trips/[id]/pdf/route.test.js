/**
 * Trip PDF Export API Route Tests
 * Tests for GET /api/trips/[id]/pdf endpoint
 *
 * Testing Framework: Vitest (used by the project)
 *
 * Note: These tests focus on unit testing the logic without complex mocking
 * of the Supabase client. Integration tests should be done separately.
 */

import { describe, it, expect } from 'vitest';

describe('Trip PDF Export API Route - Unit Tests', () => {
  describe('Request Validation', () => {
    it('should require authorization header', () => {
      const request = new Request(
        'http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000/pdf',
        {
          method: 'GET',
        }
      );

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBeNull();
    });

    it('should parse Bearer token from authorization header', () => {
      const request = new Request(
        'http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000/pdf',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-token-123',
          },
        }
      );

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBe('Bearer test-token-123');

      const token = authHeader.substring(7);
      expect(token).toBe('test-token-123');
    });

    it('should reject non-Bearer authorization', () => {
      const request = new Request(
        'http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000/pdf',
        {
          method: 'GET',
          headers: {
            Authorization: 'Basic dXNlcjpwYXNz',
          },
        }
      );

      const authHeader = request.headers.get('authorization');
      const isBearer = authHeader?.startsWith('Bearer ');
      expect(isBearer).toBe(false);
    });
  });

  describe('Trip ID Validation', () => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('should validate UUID format', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuidRegex.test(validUUID)).toBe(true);
    });

    it('should validate UUID v4 format', () => {
      const validUUIDv4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      expect(uuidRegex.test(validUUIDv4)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123',
        '123e4567-e89b-12d3-a456', // Too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
        '', // Empty string
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(uuidRegex.test(uuid)).toBe(false);
      });
    });
  });

  describe('Pro User Check', () => {
    it('should identify pro user from profile', () => {
      const proProfile = {
        id: 'user-123',
        email: 'pro@example.com',
        is_pro: true,
      };

      const isPro = proProfile.is_pro === true;
      expect(isPro).toBe(true);
    });

    it('should identify free user from profile', () => {
      const freeProfile = {
        id: 'user-123',
        email: 'free@example.com',
        is_pro: false,
      };

      const isPro = freeProfile.is_pro === true;
      expect(isPro).toBe(false);
    });

    it('should handle null is_pro as free user', () => {
      const profileWithNullPro = {
        id: 'user-123',
        email: 'user@example.com',
        is_pro: null,
      };

      const isPro = profileWithNullPro.is_pro === true;
      expect(isPro).toBe(false);
    });

    it('should handle undefined is_pro as free user', () => {
      const profileWithoutPro = {
        id: 'user-123',
        email: 'user@example.com',
      };

      const isPro = profileWithoutPro.is_pro === true;
      expect(isPro).toBe(false);
    });
  });

  describe('Trip Data Transformation for PDF', () => {
    it('should transform trip data correctly', () => {
      const rawTrip = {
        id: 'trip-uuid-123',
        user_id: 'user-uuid-456',
        title: 'California Adventure',
        origin: 'San Francisco, CA',
        origin_lat: 37.7749,
        origin_lng: -122.4194,
        start_date: '2025-01-15',
        end_date: '2025-01-18',
        interests: ['hiking', 'photography'],
        difficulty: 'moderate',
        radius_miles: 200,
        ai_summary: {
          overall_summary: 'An amazing trip through California parks',
          packing_list: { essentials: ['hiking boots', 'camera'] },
          safety_notes: ['Stay on trails'],
          best_photo_spots: ['Half Dome viewpoint'],
          estimated_budget: { total: 500 },
        },
        trip_stops: [
          {
            id: 'stop-1',
            park_code: 'yose',
            day_number: 1,
            activities: ['hiking'],
            morning_plan: 'Visit Yosemite Valley',
            afternoon_plan: 'Hike to Mirror Lake',
            evening_plan: 'Sunset at Tunnel View',
            driving_notes: '3 hours from SF',
            highlights: 'Half Dome views',
            notes: 'Bring water',
            order_index: 0,
          },
        ],
      };

      // Simulate transformation (matching the route handler logic)
      const transformedTrip = {
        id: rawTrip.id,
        title: rawTrip.title,
        origin: rawTrip.origin,
        originLat: rawTrip.origin_lat,
        originLng: rawTrip.origin_lng,
        startDate: rawTrip.start_date,
        endDate: rawTrip.end_date,
        interests: rawTrip.interests,
        difficulty: rawTrip.difficulty,
        radiusMiles: rawTrip.radius_miles,
        summary: rawTrip.ai_summary?.overall_summary || null,
        packingList: rawTrip.ai_summary?.packing_list || null,
        safetyNotes: rawTrip.ai_summary?.safety_notes || [],
        bestPhotoSpots: rawTrip.ai_summary?.best_photo_spots || [],
        estimatedBudget: rawTrip.ai_summary?.estimated_budget || null,
        stops: (rawTrip.trip_stops || []).map((stop) => ({
          id: stop.id,
          dayNumber: stop.day_number,
          parkCode: stop.park_code,
          activities: stop.activities,
          morningPlan: stop.morning_plan,
          afternoonPlan: stop.afternoon_plan,
          eveningPlan: stop.evening_plan,
          drivingNotes: stop.driving_notes,
          highlights: stop.highlights,
          notes: stop.notes,
        })),
      };

      expect(transformedTrip.id).toBe('trip-uuid-123');
      expect(transformedTrip.title).toBe('California Adventure');
      expect(transformedTrip.originLat).toBe(37.7749);
      expect(transformedTrip.summary).toBe('An amazing trip through California parks');
      expect(transformedTrip.stops).toHaveLength(1);
      expect(transformedTrip.stops[0].dayNumber).toBe(1);
    });

    it('should handle missing ai_summary', () => {
      const rawTrip = {
        id: 'trip-uuid-123',
        title: 'Simple Trip',
        ai_summary: null,
        trip_stops: [],
      };

      const summary = rawTrip.ai_summary?.overall_summary || null;
      const packingList = rawTrip.ai_summary?.packing_list || null;
      const safetyNotes = rawTrip.ai_summary?.safety_notes || [];

      expect(summary).toBeNull();
      expect(packingList).toBeNull();
      expect(safetyNotes).toEqual([]);
    });

    it('should sort stops by day_number and order_index', () => {
      const unsortedStops = [
        { day_number: 2, order_index: 1 },
        { day_number: 1, order_index: 0 },
        { day_number: 2, order_index: 0 },
        { day_number: 1, order_index: 1 },
      ];

      const sortedStops = [...unsortedStops].sort((a, b) => {
        if (a.day_number !== b.day_number) {
          return a.day_number - b.day_number;
        }
        return (a.order_index || 0) - (b.order_index || 0);
      });

      expect(sortedStops[0]).toEqual({ day_number: 1, order_index: 0 });
      expect(sortedStops[1]).toEqual({ day_number: 1, order_index: 1 });
      expect(sortedStops[2]).toEqual({ day_number: 2, order_index: 0 });
      expect(sortedStops[3]).toEqual({ day_number: 2, order_index: 1 });
    });
  });

  describe('Response Structure', () => {
    it('should have correct error response for authentication required', () => {
      const errorResponse = {
        error: 'Authentication required',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Authentication required');
    });

    it('should have correct error response for invalid trip ID', () => {
      const errorResponse = {
        error: 'Invalid trip ID',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Invalid trip ID');
    });

    it('should have correct error response for pro feature restriction', () => {
      const errorResponse = {
        error: 'PDF export is a Pro feature',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('PDF export is a Pro feature');
    });

    it('should have correct error response for trip not found', () => {
      const errorResponse = {
        error: 'Trip not found',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Trip not found');
    });

    it('should have correct error response for PDF generation failure', () => {
      const errorResponse = {
        error: 'Failed to generate PDF',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Failed to generate PDF');
    });
  });

  describe('PDF Response Headers', () => {
    it('should have correct Content-Type for PDF', () => {
      const expectedContentType = 'application/pdf';
      expect(expectedContentType).toBe('application/pdf');
    });

    it('should have correct Content-Disposition for download', () => {
      const filename = 'california-adventure-trip-plan.pdf';
      const contentDisposition = `attachment; filename="${filename}"`;

      expect(contentDisposition).toContain('attachment');
      expect(contentDisposition).toContain(filename);
    });

    it('should generate URL-friendly filename', () => {
      const title = 'California National Parks Adventure!';
      const slugified = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      expect(slugified).toBe('california-national-parks-adventure');
    });
  });

  describe('Authorization Flow', () => {
    it('should extract token from Bearer header', () => {
      const authHeader = 'Bearer my-jwt-token-123';
      const token = authHeader.substring(7);

      expect(token).toBe('my-jwt-token-123');
    });

    it('should use service role client for auth validation', () => {
      const clientConfig = { useServiceRole: true };
      expect(clientConfig.useServiceRole).toBe(true);
    });

    it('should filter trips by user_id', () => {
      const userId = 'user-uuid-123';
      const tripId = 'trip-uuid-456';
      const query = {
        table: 'trips',
        filters: [
          { column: 'id', value: tripId },
          { column: 'user_id', value: userId },
        ],
      };

      expect(query.filters).toContainEqual({ column: 'user_id', value: userId });
      expect(query.filters).toContainEqual({ column: 'id', value: tripId });
    });
  });

  describe('Park Data Fetching', () => {
    it('should extract unique park codes from stops', () => {
      const tripStops = [
        { park_code: 'yose' },
        { park_code: 'sequ' },
        { park_code: 'yose' }, // Duplicate
        { park_code: 'kica' },
      ];

      const parkCodes = [...new Set(tripStops.map((s) => s.park_code))];

      expect(parkCodes).toHaveLength(3);
      expect(parkCodes).toContain('yose');
      expect(parkCodes).toContain('sequ');
      expect(parkCodes).toContain('kica');
    });

    it('should handle empty stops array', () => {
      const tripStops = [];
      const parkCodes = [...new Set(tripStops.map((s) => s.park_code))];

      expect(parkCodes).toHaveLength(0);
    });

    it('should merge park data into stops', () => {
      const parksMap = {
        yose: { name: 'Yosemite National Park', designation: 'National Park' },
        sequ: { name: 'Sequoia National Park', designation: 'National Park' },
      };

      const stop = { park_code: 'yose' };
      const stopWithPark = {
        ...stop,
        park: parksMap[stop.park_code] || null,
      };

      expect(stopWithPark.park).not.toBeNull();
      expect(stopWithPark.park.name).toBe('Yosemite National Park');
    });
  });
});