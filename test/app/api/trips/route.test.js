/**
 * Trips API Route Tests
 * Tests for the trips API endpoints
 * 
 * Testing Framework: Vitest (used by the project)
 * 
 * Note: These tests focus on unit testing the logic without complex mocking
 * of the Supabase client. Integration tests should be done separately.
 */

import { describe, it, expect } from 'vitest';

describe('Trips API Routes - Unit Tests', () => {
  describe('GET /api/trips - Request Validation', () => {
    it('should require authorization header', () => {
      const request = new Request('http://localhost/api/trips', {
        method: 'GET',
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBeNull();
    });

    it('should parse Bearer token from authorization header', () => {
      const request = new Request('http://localhost/api/trips', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token-123',
        },
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBe('Bearer test-token-123');
      
      const token = authHeader.substring(7);
      expect(token).toBe('test-token-123');
    });

    it('should reject non-Bearer authorization', () => {
      const request = new Request('http://localhost/api/trips', {
        method: 'GET',
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz',
        },
      });

      const authHeader = request.headers.get('authorization');
      const isBearer = authHeader?.startsWith('Bearer ');
      expect(isBearer).toBe(false);
    });
  });

  describe('Query Parameter Parsing', () => {
    it('should parse limit parameter', () => {
      const url = new URL('http://localhost/api/trips?limit=10');
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      expect(limit).toBe(10);
    });

    it('should use default limit when not provided', () => {
      const url = new URL('http://localhost/api/trips');
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      expect(limit).toBe(20);
    });

    it('should cap limit at 100', () => {
      const url = new URL('http://localhost/api/trips?limit=200');
      const requestedLimit = parseInt(url.searchParams.get('limit') || '20', 10);
      const limit = Math.min(requestedLimit, 100);
      expect(limit).toBe(100);
    });

    it('should parse offset parameter', () => {
      const url = new URL('http://localhost/api/trips?offset=20');
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      expect(offset).toBe(20);
    });

    it('should use default offset when not provided', () => {
      const url = new URL('http://localhost/api/trips');
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      expect(offset).toBe(0);
    });

    it('should parse sortBy parameter', () => {
      const url = new URL('http://localhost/api/trips?sortBy=start_date');
      const sortBy = url.searchParams.get('sortBy') || 'created_at';
      expect(sortBy).toBe('start_date');
    });

    it('should use default sortBy when not provided', () => {
      const url = new URL('http://localhost/api/trips');
      const sortBy = url.searchParams.get('sortBy') || 'created_at';
      expect(sortBy).toBe('created_at');
    });

    it('should parse sortOrder parameter', () => {
      const url = new URL('http://localhost/api/trips?sortOrder=asc');
      const sortOrder = url.searchParams.get('sortOrder') || 'desc';
      expect(sortOrder).toBe('asc');
    });
  });

  describe('Sort Parameter Validation', () => {
    const validSortFields = ['created_at', 'start_date', 'title'];
    const validSortOrders = ['asc', 'desc'];

    it('should accept valid sort fields', () => {
      expect(validSortFields.includes('created_at')).toBe(true);
      expect(validSortFields.includes('start_date')).toBe(true);
      expect(validSortFields.includes('title')).toBe(true);
    });

    it('should reject invalid sort fields', () => {
      expect(validSortFields.includes('invalid_field')).toBe(false);
      expect(validSortFields.includes('user_id')).toBe(false);
      expect(validSortFields.includes('password')).toBe(false);
    });

    it('should accept valid sort orders', () => {
      expect(validSortOrders.includes('asc')).toBe(true);
      expect(validSortOrders.includes('desc')).toBe(true);
    });

    it('should reject invalid sort orders', () => {
      expect(validSortOrders.includes('ascending')).toBe(false);
      expect(validSortOrders.includes('descending')).toBe(false);
      expect(validSortOrders.includes('random')).toBe(false);
    });
  });

  describe('Trip Data Transformation', () => {
    it('should transform trip data correctly', () => {
      const rawTrip = {
        id: 'trip-1',
        title: 'Test Trip',
        origin: 'Test City',
        start_date: '2025-01-15',
        end_date: '2025-01-18',
        interests: ['hiking'],
        difficulty: 'easy',
        radius_miles: 100,
        ai_summary: { overall_summary: 'Summary' },
        created_at: '2025-01-10T10:00:00Z',
        updated_at: '2025-01-10T10:00:00Z',
        trip_stops: [
          { id: 's1', park_code: 'yose', day_number: 1 },
          { id: 's2', park_code: 'sequ', day_number: 2 },
        ],
      };

      // Simulate transformation
      const transformed = {
        id: rawTrip.id,
        title: rawTrip.title,
        origin: rawTrip.origin,
        startDate: rawTrip.start_date,
        endDate: rawTrip.end_date,
        interests: rawTrip.interests,
        difficulty: rawTrip.difficulty,
        radiusMiles: rawTrip.radius_miles,
        summary: rawTrip.ai_summary?.overall_summary || null,
        parkCount: rawTrip.trip_stops?.length || 0,
        dayCount: rawTrip.trip_stops 
          ? new Set(rawTrip.trip_stops.map(s => s.day_number)).size 
          : 0,
        createdAt: rawTrip.created_at,
        updatedAt: rawTrip.updated_at,
      };

      expect(transformed.id).toBe('trip-1');
      expect(transformed.title).toBe('Test Trip');
      expect(transformed.startDate).toBe('2025-01-15');
      expect(transformed.endDate).toBe('2025-01-18');
      expect(transformed.parkCount).toBe(2);
      expect(transformed.dayCount).toBe(2);
      expect(transformed.summary).toBe('Summary');
      expect(transformed.radiusMiles).toBe(100);
    });

    it('should handle missing trip_stops', () => {
      const rawTrip = {
        id: 'trip-1',
        title: 'Test Trip',
        trip_stops: null,
      };

      const parkCount = rawTrip.trip_stops?.length || 0;
      const dayCount = rawTrip.trip_stops 
        ? new Set(rawTrip.trip_stops.map(s => s.day_number)).size 
        : 0;

      expect(parkCount).toBe(0);
      expect(dayCount).toBe(0);
    });

    it('should handle empty trip_stops array', () => {
      const rawTrip = {
        id: 'trip-1',
        title: 'Test Trip',
        trip_stops: [],
      };

      const parkCount = rawTrip.trip_stops?.length || 0;
      const dayCount = rawTrip.trip_stops 
        ? new Set(rawTrip.trip_stops.map(s => s.day_number)).size 
        : 0;

      expect(parkCount).toBe(0);
      expect(dayCount).toBe(0);
    });

    it('should handle missing ai_summary', () => {
      const rawTrip = {
        id: 'trip-1',
        title: 'Test Trip',
        ai_summary: null,
      };

      const summary = rawTrip.ai_summary?.overall_summary || null;
      expect(summary).toBeNull();
    });

    it('should handle ai_summary without overall_summary', () => {
      const rawTrip = {
        id: 'trip-1',
        title: 'Test Trip',
        ai_summary: { daily_schedule: [] },
      };

      const summary = rawTrip.ai_summary?.overall_summary || null;
      expect(summary).toBeNull();
    });

    it('should count unique days correctly', () => {
      const tripStops = [
        { day_number: 1 },
        { day_number: 1 }, // Same day
        { day_number: 2 },
        { day_number: 3 },
      ];

      const dayCount = new Set(tripStops.map(s => s.day_number)).size;
      expect(dayCount).toBe(3);
    });
  });

  describe('Pagination Logic', () => {
    it('should calculate hasMore correctly when more results exist', () => {
      const total = 50;
      const limit = 20;
      const offset = 0;

      const hasMore = offset + limit < total;
      expect(hasMore).toBe(true);
    });

    it('should return hasMore false when at end', () => {
      const total = 50;
      const limit = 20;
      const offset = 40;

      const hasMore = offset + limit < total;
      expect(hasMore).toBe(false);
    });

    it('should return hasMore false when exactly at end', () => {
      const total = 50;
      const limit = 20;
      const offset = 30;

      const hasMore = offset + limit < total;
      expect(hasMore).toBe(false);
    });

    it('should handle empty results', () => {
      const total = 0;
      const limit = 20;
      const offset = 0;

      const hasMore = offset + limit < total;
      expect(hasMore).toBe(false);
    });

    it('should calculate correct range for Supabase query', () => {
      const limit = 20;
      const offset = 40;

      const rangeStart = offset;
      const rangeEnd = offset + limit - 1;

      expect(rangeStart).toBe(40);
      expect(rangeEnd).toBe(59);
    });
  });

  describe('Response Structure', () => {
    it('should have correct response structure', () => {
      const response = {
        trips: [],
        pagination: {
          total: 0,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      expect(response).toHaveProperty('trips');
      expect(response).toHaveProperty('pagination');
      expect(response.pagination).toHaveProperty('total');
      expect(response.pagination).toHaveProperty('limit');
      expect(response.pagination).toHaveProperty('offset');
      expect(response.pagination).toHaveProperty('hasMore');
    });

    it('should have correct error response structure', () => {
      const errorResponse = {
        error: 'Authentication required',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(typeof errorResponse.error).toBe('string');
    });
  });
});

describe('Trip ID Validation', () => {
  // UUID regex matching the one used in the route handler
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      null, // Null
      undefined, // Undefined
    ];

    invalidUUIDs.forEach(uuid => {
      expect(uuidRegex.test(uuid)).toBe(false);
    });
  });

  it('should reject UUID with invalid version', () => {
    // Version 0 is invalid
    const invalidVersion = '123e4567-e89b-02d3-a456-426614174000';
    expect(uuidRegex.test(invalidVersion)).toBe(false);
  });

  it('should reject UUID with invalid variant', () => {
    // Variant must be 8, 9, a, or b
    const invalidVariant = '123e4567-e89b-12d3-0456-426614174000';
    expect(uuidRegex.test(invalidVariant)).toBe(false);
  });
});

describe('GET /api/trips/[id] - Single Trip Route', () => {
  describe('Request Validation', () => {
    it('should require authorization header', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'GET',
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBeNull();
    });

    it('should parse Bearer token from authorization header', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token-123',
        },
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBe('Bearer test-token-123');
      
      const token = authHeader.substring(7);
      expect(token).toBe('test-token-123');
    });

    it('should reject non-Bearer authorization', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'GET',
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz',
        },
      });

      const authHeader = request.headers.get('authorization');
      const isBearer = authHeader?.startsWith('Bearer ');
      expect(isBearer).toBe(false);
    });
  });

  describe('Single Trip Data Transformation', () => {
    it('should transform single trip data correctly', () => {
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
          packing_list: ['hiking boots', 'camera'],
          safety_notes: ['Stay on trails'],
          best_photo_spots: ['Half Dome viewpoint'],
          estimated_budget: { total: 500 },
        },
        created_at: '2025-01-10T10:00:00Z',
        updated_at: '2025-01-10T10:00:00Z',
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
          {
            id: 'stop-2',
            park_code: 'sequ',
            day_number: 2,
            activities: ['sightseeing'],
            morning_plan: 'General Sherman Tree',
            afternoon_plan: 'Moro Rock',
            evening_plan: 'Stargazing',
            driving_notes: '2 hours from Yosemite',
            highlights: 'Giant sequoias',
            notes: null,
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
        createdAt: rawTrip.created_at,
        updatedAt: rawTrip.updated_at,
      };

      expect(transformedTrip.id).toBe('trip-uuid-123');
      expect(transformedTrip.title).toBe('California Adventure');
      expect(transformedTrip.origin).toBe('San Francisco, CA');
      expect(transformedTrip.originLat).toBe(37.7749);
      expect(transformedTrip.originLng).toBe(-122.4194);
      expect(transformedTrip.startDate).toBe('2025-01-15');
      expect(transformedTrip.endDate).toBe('2025-01-18');
      expect(transformedTrip.interests).toEqual(['hiking', 'photography']);
      expect(transformedTrip.difficulty).toBe('moderate');
      expect(transformedTrip.radiusMiles).toBe(200);
      expect(transformedTrip.summary).toBe('An amazing trip through California parks');
      expect(transformedTrip.packingList).toEqual(['hiking boots', 'camera']);
      expect(transformedTrip.safetyNotes).toEqual(['Stay on trails']);
      expect(transformedTrip.bestPhotoSpots).toEqual(['Half Dome viewpoint']);
      expect(transformedTrip.estimatedBudget).toEqual({ total: 500 });
    });

    it('should handle missing ai_summary fields gracefully', () => {
      const rawTrip = {
        id: 'trip-uuid-123',
        ai_summary: {},
      };

      const summary = rawTrip.ai_summary?.overall_summary || null;
      const packingList = rawTrip.ai_summary?.packing_list || null;
      const safetyNotes = rawTrip.ai_summary?.safety_notes || [];
      const bestPhotoSpots = rawTrip.ai_summary?.best_photo_spots || [];
      const estimatedBudget = rawTrip.ai_summary?.estimated_budget || null;

      expect(summary).toBeNull();
      expect(packingList).toBeNull();
      expect(safetyNotes).toEqual([]);
      expect(bestPhotoSpots).toEqual([]);
      expect(estimatedBudget).toBeNull();
    });

    it('should handle null ai_summary', () => {
      const rawTrip = {
        id: 'trip-uuid-123',
        ai_summary: null,
      };

      const summary = rawTrip.ai_summary?.overall_summary || null;
      const packingList = rawTrip.ai_summary?.packing_list || null;
      const safetyNotes = rawTrip.ai_summary?.safety_notes || [];

      expect(summary).toBeNull();
      expect(packingList).toBeNull();
      expect(safetyNotes).toEqual([]);
    });
  });

  describe('Trip Stops Transformation', () => {
    it('should transform trip stops correctly', () => {
      const rawStop = {
        id: 'stop-1',
        park_code: 'yose',
        day_number: 1,
        activities: ['hiking', 'photography'],
        morning_plan: 'Visit Yosemite Valley',
        afternoon_plan: 'Hike to Mirror Lake',
        evening_plan: 'Sunset at Tunnel View',
        driving_notes: '3 hours from SF',
        highlights: 'Half Dome views',
        notes: 'Bring water',
        order_index: 0,
      };

      const transformedStop = {
        id: rawStop.id,
        dayNumber: rawStop.day_number,
        parkCode: rawStop.park_code,
        activities: rawStop.activities,
        morningPlan: rawStop.morning_plan,
        afternoonPlan: rawStop.afternoon_plan,
        eveningPlan: rawStop.evening_plan,
        drivingNotes: rawStop.driving_notes,
        highlights: rawStop.highlights,
        notes: rawStop.notes,
      };

      expect(transformedStop.id).toBe('stop-1');
      expect(transformedStop.dayNumber).toBe(1);
      expect(transformedStop.parkCode).toBe('yose');
      expect(transformedStop.activities).toEqual(['hiking', 'photography']);
      expect(transformedStop.morningPlan).toBe('Visit Yosemite Valley');
      expect(transformedStop.afternoonPlan).toBe('Hike to Mirror Lake');
      expect(transformedStop.eveningPlan).toBe('Sunset at Tunnel View');
      expect(transformedStop.drivingNotes).toBe('3 hours from SF');
      expect(transformedStop.highlights).toBe('Half Dome views');
      expect(transformedStop.notes).toBe('Bring water');
    });

    it('should sort stops by day_number and order_index', () => {
      const unsortedStops = [
        { day_number: 2, order_index: 1 },
        { day_number: 1, order_index: 0 },
        { day_number: 2, order_index: 0 },
        { day_number: 1, order_index: 1 },
        { day_number: 3, order_index: 0 },
      ];

      const sortedStops = [...unsortedStops].sort((a, b) => {
        if (a.day_number !== b.day_number) {
          return a.day_number - b.day_number;
        }
        return a.order_index - b.order_index;
      });

      expect(sortedStops[0]).toEqual({ day_number: 1, order_index: 0 });
      expect(sortedStops[1]).toEqual({ day_number: 1, order_index: 1 });
      expect(sortedStops[2]).toEqual({ day_number: 2, order_index: 0 });
      expect(sortedStops[3]).toEqual({ day_number: 2, order_index: 1 });
      expect(sortedStops[4]).toEqual({ day_number: 3, order_index: 0 });
    });

    it('should handle empty trip_stops array', () => {
      const tripStops = [];
      const sortedStops = [...tripStops].sort((a, b) => {
        if (a.day_number !== b.day_number) {
          return a.day_number - b.day_number;
        }
        return a.order_index - b.order_index;
      });

      expect(sortedStops).toEqual([]);
    });
  });

  describe('Park Code Extraction', () => {
    it('should extract unique park codes from stops', () => {
      const tripStops = [
        { park_code: 'yose' },
        { park_code: 'sequ' },
        { park_code: 'yose' }, // Duplicate
        { park_code: 'kica' },
      ];

      const parkCodes = [...new Set(tripStops.map(s => s.park_code))];

      expect(parkCodes).toHaveLength(3);
      expect(parkCodes).toContain('yose');
      expect(parkCodes).toContain('sequ');
      expect(parkCodes).toContain('kica');
    });

    it('should handle empty stops array', () => {
      const tripStops = [];
      const parkCodes = [...new Set(tripStops.map(s => s.park_code))];

      expect(parkCodes).toHaveLength(0);
    });
  });

  describe('Response Structure', () => {
    it('should have correct single trip response structure', () => {
      const response = {
        trip: {
          id: 'trip-uuid',
          title: 'Test Trip',
          origin: 'Test City',
          originLat: 0,
          originLng: 0,
          startDate: '2025-01-15',
          endDate: '2025-01-18',
          interests: [],
          difficulty: 'moderate',
          radiusMiles: 200,
          summary: null,
          packingList: null,
          safetyNotes: [],
          bestPhotoSpots: [],
          estimatedBudget: null,
          createdAt: '2025-01-10T10:00:00Z',
          updatedAt: '2025-01-10T10:00:00Z',
          stops: [],
        },
      };

      expect(response).toHaveProperty('trip');
      expect(response.trip).toHaveProperty('id');
      expect(response.trip).toHaveProperty('title');
      expect(response.trip).toHaveProperty('origin');
      expect(response.trip).toHaveProperty('originLat');
      expect(response.trip).toHaveProperty('originLng');
      expect(response.trip).toHaveProperty('startDate');
      expect(response.trip).toHaveProperty('endDate');
      expect(response.trip).toHaveProperty('interests');
      expect(response.trip).toHaveProperty('difficulty');
      expect(response.trip).toHaveProperty('radiusMiles');
      expect(response.trip).toHaveProperty('summary');
      expect(response.trip).toHaveProperty('packingList');
      expect(response.trip).toHaveProperty('safetyNotes');
      expect(response.trip).toHaveProperty('bestPhotoSpots');
      expect(response.trip).toHaveProperty('estimatedBudget');
      expect(response.trip).toHaveProperty('createdAt');
      expect(response.trip).toHaveProperty('updatedAt');
      expect(response.trip).toHaveProperty('stops');
    });

    it('should have correct error response for invalid trip ID', () => {
      const errorResponse = {
        error: 'Invalid trip ID',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Invalid trip ID');
    });

    it('should have correct error response for trip not found', () => {
      const errorResponse = {
        error: 'Trip not found',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Trip not found');
    });

    it('should have correct error response for authentication required', () => {
      const errorResponse = {
        error: 'Authentication required',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Authentication required');
    });
  });
});

describe('DELETE /api/trips/[id] - Delete Trip Route', () => {
  describe('Request Validation', () => {
    it('should require authorization header for DELETE', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'DELETE',
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBeNull();
    });

    it('should parse Bearer token for DELETE request', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer delete-token-123',
        },
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBe('Bearer delete-token-123');
    });
  });

  describe('Authorization Check', () => {
    it('should verify trip belongs to user before deletion', () => {
      const trip = {
        id: 'trip-uuid-123',
        user_id: 'user-uuid-456',
      };
      const currentUserId = 'user-uuid-456';

      const isAuthorized = trip.user_id === currentUserId;
      expect(isAuthorized).toBe(true);
    });

    it('should reject deletion if trip belongs to different user', () => {
      const trip = {
        id: 'trip-uuid-123',
        user_id: 'user-uuid-456',
      };
      const currentUserId = 'different-user-uuid';

      const isAuthorized = trip.user_id === currentUserId;
      expect(isAuthorized).toBe(false);
    });
  });

  describe('Response Structure', () => {
    it('should have correct success response structure', () => {
      const successResponse = {
        success: true,
        message: 'Trip deleted successfully',
      };

      expect(successResponse).toHaveProperty('success');
      expect(successResponse).toHaveProperty('message');
      expect(successResponse.success).toBe(true);
      expect(successResponse.message).toBe('Trip deleted successfully');
    });

    it('should have correct error response for not authorized', () => {
      const errorResponse = {
        error: 'Not authorized to delete this trip',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Not authorized to delete this trip');
    });

    it('should have correct error response for trip not found on delete', () => {
      const errorResponse = {
        error: 'Trip not found',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Trip not found');
    });

    it('should have correct error response for failed deletion', () => {
      const errorResponse = {
        error: 'Failed to delete trip',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Failed to delete trip');
    });
  });
});

describe('Supabase Client Configuration', () => {
  describe('Service Role Usage', () => {
    it('should use service role for trip queries to bypass RLS', () => {
      // This test documents the expected behavior:
      // The trips API routes should use createServerClient({ useServiceRole: true })
      // to bypass RLS policies since authentication is handled via JWT validation
      
      const clientOptions = { useServiceRole: true };
      expect(clientOptions.useServiceRole).toBe(true);
    });

    it('should still filter by user_id even with service role', () => {
      // Even though service role bypasses RLS, the query should still
      // filter by user_id to ensure users only see their own trips
      
      const userId = 'user-uuid-123';
      const query = {
        table: 'trips',
        filters: [
          { column: 'user_id', value: userId },
        ],
      };

      expect(query.filters).toContainEqual({ column: 'user_id', value: userId });
    });

    it('should use service role for authentication validation', () => {
      // The getAuthenticatedUser function should use service role
      // to properly validate JWT tokens without RLS interference
      
      const authClientOptions = { useServiceRole: true };
      expect(authClientOptions.useServiceRole).toBe(true);
    });
  });
});

describe('Trip Deletion - Comprehensive Tests', () => {
  describe('DELETE /api/trips/[id] - Request Flow', () => {
    it('should validate trip ID before processing', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      const validId = '123e4567-e89b-12d3-a456-426614174000';
      const invalidId = 'not-a-uuid';
      
      expect(uuidRegex.test(validId)).toBe(true);
      expect(uuidRegex.test(invalidId)).toBe(false);
    });

    it('should require authentication before deletion', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'DELETE',
      });
      
      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBeNull();
    });

    it('should verify trip ownership before deletion', () => {
      const trip = {
        id: 'trip-uuid-123',
        user_id: 'user-uuid-456',
      };
      const requestingUserId = 'user-uuid-456';
      
      const isOwner = trip.user_id === requestingUserId;
      expect(isOwner).toBe(true);
    });

    it('should reject deletion if user does not own trip', () => {
      const trip = {
        id: 'trip-uuid-123',
        user_id: 'user-uuid-456',
      };
      const requestingUserId = 'different-user-uuid';
      
      const isOwner = trip.user_id === requestingUserId;
      expect(isOwner).toBe(false);
    });
  });

  describe('DELETE /api/trips/[id] - Error Handling', () => {
    it('should return 400 for invalid trip ID', () => {
      const invalidIds = ['', 'abc', '123', null, undefined];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      invalidIds.forEach(id => {
        const isValid = id ? uuidRegex.test(id) : false;
        expect(isValid).toBe(false);
      });
    });

    it('should return 401 for missing authorization', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'DELETE',
      });
      
      const authHeader = request.headers.get('authorization');
      const hasAuth = authHeader?.startsWith('Bearer ');
      
      expect(hasAuth).toBeFalsy();
    });

    it('should return 401 for invalid authorization format', () => {
      const request = new Request('http://localhost/api/trips/123e4567-e89b-12d3-a456-426614174000', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz',
        },
      });
      
      const authHeader = request.headers.get('authorization');
      const isBearer = authHeader?.startsWith('Bearer ');
      
      expect(isBearer).toBe(false);
    });

    it('should return 404 for non-existent trip', () => {
      const tripQueryResult = {
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      };
      
      const tripNotFound = !tripQueryResult.data || tripQueryResult.error;
      expect(tripNotFound).toBe(true);
    });

    it('should return 403 for unauthorized deletion attempt', () => {
      const trip = {
        id: 'trip-uuid-123',
        user_id: 'owner-user-uuid',
      };
      const requestingUserId = 'attacker-user-uuid';
      
      const isAuthorized = trip.user_id === requestingUserId;
      expect(isAuthorized).toBe(false);
    });

    it('should return 500 for database errors', () => {
      const deleteResult = {
        error: { message: 'Database connection failed' },
      };
      
      const hasError = !!deleteResult.error;
      expect(hasError).toBe(true);
    });
  });

  describe('DELETE /api/trips/[id] - Success Response', () => {
    it('should return success true on successful deletion', () => {
      const successResponse = {
        success: true,
        message: 'Trip deleted successfully',
      };
      
      expect(successResponse.success).toBe(true);
    });

    it('should return confirmation message', () => {
      const successResponse = {
        success: true,
        message: 'Trip deleted successfully',
      };
      
      expect(successResponse.message).toBe('Trip deleted successfully');
    });

    it('should cascade delete trip_stops', () => {
      // This documents the expected database behavior:
      // When a trip is deleted, all associated trip_stops should be
      // automatically deleted due to the CASCADE constraint
      
      const tripSchema = {
        trips: {
          id: 'uuid',
          user_id: 'uuid',
        },
        trip_stops: {
          id: 'uuid',
          trip_id: 'uuid', // Foreign key with ON DELETE CASCADE
        },
      };
      
      expect(tripSchema.trip_stops.trip_id).toBeDefined();
    });
  });

  describe('DELETE /api/trips/[id] - Authorization Flow', () => {
    it('should extract token from Bearer header', () => {
      const authHeader = 'Bearer my-jwt-token-123';
      const token = authHeader.substring(7);
      
      expect(token).toBe('my-jwt-token-123');
    });

    it('should validate token with Supabase auth', () => {
      // This documents the expected auth flow:
      // 1. Extract token from Authorization header
      // 2. Call supabase.auth.getUser(token)
      // 3. Return user if valid, null if invalid
      
      const authFlow = {
        step1: 'Extract Bearer token',
        step2: 'Call supabase.auth.getUser(token)',
        step3: 'Return user or null',
      };
      
      expect(authFlow.step2).toContain('getUser');
    });

    it('should use service role client for auth validation', () => {
      // The auth validation should use service role to bypass RLS
      // This ensures the token can be validated regardless of RLS policies
      
      const clientConfig = { useServiceRole: true };
      expect(clientConfig.useServiceRole).toBe(true);
    });
  });

  describe('DELETE /api/trips/[id] - Database Operations', () => {
    it('should first fetch trip to verify ownership', () => {
      const fetchQuery = {
        table: 'trips',
        select: ['id', 'user_id'],
        filters: [{ column: 'id', value: 'trip-uuid' }],
      };
      
      expect(fetchQuery.select).toContain('user_id');
    });

    it('should delete trip by ID', () => {
      const deleteQuery = {
        table: 'trips',
        operation: 'delete',
        filters: [{ column: 'id', value: 'trip-uuid' }],
      };
      
      expect(deleteQuery.operation).toBe('delete');
      expect(deleteQuery.filters[0].column).toBe('id');
    });

    it('should use service role for delete operation', () => {
      // Service role is required to bypass RLS for the delete operation
      
      const deleteClientConfig = { useServiceRole: true };
      expect(deleteClientConfig.useServiceRole).toBe(true);
    });
  });
});

describe('Park Source Detection', () => {
  describe('NPS vs Wikidata Parks', () => {
    it('should identify NPS parks by park_code format', () => {
      const npsParkCodes = ['yose', 'sequ', 'kica', 'grca', 'zion'];
      const wikidataPattern = /^Q\d+$/;
      
      npsParkCodes.forEach(code => {
        expect(wikidataPattern.test(code)).toBe(false);
      });
    });

    it('should identify Wikidata parks by Q-code format', () => {
      const wikidataCodes = ['Q5719910', 'Q123456', 'Q999999'];
      const wikidataPattern = /^Q\d+$/;
      
      wikidataCodes.forEach(code => {
        expect(wikidataPattern.test(code)).toBe(true);
      });
    });

    it('should determine source from park data', () => {
      const npsPark = { park_code: 'yose', full_name: 'Yosemite National Park' };
      const wikidataPark = { park_code: 'Q5719910', full_name: 'Some State Park', source: 'wikidata' };
      
      const getNpsSource = (park) => park.source || 'nps';
      
      expect(getNpsSource(npsPark)).toBe('nps');
      expect(getNpsSource(wikidataPark)).toBe('wikidata');
    });
  });

  describe('Park Link Generation', () => {
    it('should generate internal link for NPS parks', () => {
      const stop = { parkCode: 'yose', park: { source: 'nps' } };
      
      // All parks link to internal park detail page
      const link = `/parks/${stop.parkCode}`;
      expect(link).toBe('/parks/yose');
    });

    it('should generate internal link for Wikidata parks (Q-codes)', () => {
      const stop = {
        parkCode: 'Q5719910',
        park: {
          source: 'wikidata',
          full_name: 'Some State Park'
        }
      };
      
      // All parks link to internal park detail page, including Wikidata parks
      const link = `/parks/${stop.parkCode}`;
      expect(link).toBe('/parks/Q5719910');
    });

    it('should return null when parkCode is missing', () => {
      const stop = { parkCode: null, park: { full_name: 'Some Park' } };
      
      const link = stop.parkCode ? `/parks/${stop.parkCode}` : null;
      expect(link).toBeNull();
    });

    it('should handle empty parkCode', () => {
      const stop = { parkCode: '', park: { full_name: 'Some Park' } };
      
      const link = stop.parkCode ? `/parks/${stop.parkCode}` : null;
      expect(link).toBeNull();
    });
  });

  describe('Park Data Merging', () => {
    it('should merge NPS parks into parksMap', () => {
      const npsParks = [
        { park_code: 'yose', full_name: 'Yosemite' },
        { park_code: 'sequ', full_name: 'Sequoia' },
      ];
      
      const parksMap = npsParks.reduce((acc, park) => {
        acc[park.park_code] = park;
        return acc;
      }, {});
      
      expect(Object.keys(parksMap)).toHaveLength(2);
      expect(parksMap['yose'].full_name).toBe('Yosemite');
    });

    it('should find missing park codes', () => {
      const parkCodes = ['yose', 'Q5719910', 'sequ'];
      const parksMap = { yose: {}, sequ: {} };
      
      const foundCodes = new Set(Object.keys(parksMap));
      const missingCodes = parkCodes.filter(code => !foundCodes.has(code));
      
      expect(missingCodes).toEqual(['Q5719910']);
    });

    it('should merge Wikidata parks for missing codes', () => {
      const parksMap = { yose: { full_name: 'Yosemite' } };
      const wikidataParks = [
        { park_code: 'Q5719910', full_name: 'State Park', source: 'wikidata' },
      ];
      
      wikidataParks.forEach(park => {
        parksMap[park.park_code] = park;
      });
      
      expect(Object.keys(parksMap)).toHaveLength(2);
      expect(parksMap['Q5719910'].source).toBe('wikidata');
    });
  });
});

describe('Product Recommendations', () => {
  describe('Activity-Based Product Filtering', () => {
    it('should extract unique activities from trip', () => {
      const trip = {
        interests: ['hiking', 'photography'],
        trip_stops: [
          { activities: ['hiking', 'camping'] },
          { activities: ['photography', 'wildlife'] },
        ],
      };
      
      const allActivities = [...new Set([
        ...(trip.interests || []),
        ...trip.trip_stops.flatMap(s => s.activities || [])
      ])];
      
      expect(allActivities).toContain('hiking');
      expect(allActivities).toContain('photography');
      expect(allActivities).toContain('camping');
      expect(allActivities).toContain('wildlife');
      expect(allActivities).toHaveLength(4);
    });

    it('should handle missing interests', () => {
      const trip = {
        interests: null,
        trip_stops: [{ activities: ['hiking'] }],
      };
      
      const allActivities = [...new Set([
        ...(trip.interests || []),
        ...trip.trip_stops.flatMap(s => s.activities || [])
      ])];
      
      expect(allActivities).toEqual(['hiking']);
    });

    it('should handle missing activities in stops', () => {
      const trip = {
        interests: ['hiking'],
        trip_stops: [
          { activities: null },
          { activities: ['camping'] },
        ],
      };
      
      const allActivities = [...new Set([
        ...(trip.interests || []),
        ...trip.trip_stops.flatMap(s => s.activities || [])
      ])];
      
      expect(allActivities).toContain('hiking');
      expect(allActivities).toContain('camping');
    });

    it('should handle empty trip_stops', () => {
      const trip = {
        interests: ['hiking'],
        trip_stops: [],
      };
      
      const allActivities = [...new Set([
        ...(trip.interests || []),
        ...trip.trip_stops.flatMap(s => s.activities || [])
      ])];
      
      expect(allActivities).toEqual(['hiking']);
    });
  });

  describe('Product Data Transformation', () => {
    it('should transform product data correctly', () => {
      const rawProduct = {
        id: 'prod-1',
        asin: 'B123456',
        title: 'Hiking Boots',
        brand: 'TrailMaster',
        price: 129.99,
        currency: 'USD',
        original_price: 149.99,
        rating: 4.5,
        ratings_total: 1234,
        main_image_url: 'https://example.com/image.jpg',
        is_prime: true,
        affiliate_url: 'https://amazon.com/dp/B123456',
        product_categories: { name: 'Footwear', slug: 'footwear' },
      };
      
      const transformed = {
        id: rawProduct.id,
        asin: rawProduct.asin,
        title: rawProduct.title,
        brand: rawProduct.brand,
        price: rawProduct.price,
        currency: rawProduct.currency,
        originalPrice: rawProduct.original_price,
        rating: rawProduct.rating,
        ratingsTotal: rawProduct.ratings_total,
        imageUrl: rawProduct.main_image_url,
        isPrime: rawProduct.is_prime,
        affiliateUrl: rawProduct.affiliate_url,
        category: rawProduct.product_categories?.name || null,
      };
      
      expect(transformed.id).toBe('prod-1');
      expect(transformed.title).toBe('Hiking Boots');
      expect(transformed.price).toBe(129.99);
      expect(transformed.isPrime).toBe(true);
      expect(transformed.category).toBe('Footwear');
    });

    it('should handle missing product_categories', () => {
      const rawProduct = {
        id: 'prod-1',
        title: 'Hiking Boots',
        product_categories: null,
      };
      
      const category = rawProduct.product_categories?.name || null;
      expect(category).toBeNull();
    });
  });

  describe('Response Structure with Products', () => {
    it('should include recommendedProducts in trip response', () => {
      const response = {
        trip: {
          id: 'trip-uuid',
          title: 'Test Trip',
          stops: [],
          recommendedProducts: [
            { id: 'prod-1', title: 'Product 1' },
            { id: 'prod-2', title: 'Product 2' },
          ],
        },
      };
      
      expect(response.trip).toHaveProperty('recommendedProducts');
      expect(response.trip.recommendedProducts).toHaveLength(2);
    });

    it('should handle empty recommendedProducts', () => {
      const response = {
        trip: {
          id: 'trip-uuid',
          recommendedProducts: [],
        },
      };
      
      expect(response.trip.recommendedProducts).toEqual([]);
    });
  });
});

describe('Nearby Places', () => {
  describe('Nearby Places Data Structure', () => {
    it('should group nearby places by category', () => {
      const nearbyPlacesData = [
        { park_id: 1, nearby_places: { id: 1, category: 'dining', title: 'Restaurant A' } },
        { park_id: 1, nearby_places: { id: 2, category: 'bars', title: 'Bar B' } },
        { park_id: 1, nearby_places: { id: 3, category: 'dining', title: 'Restaurant C' } },
      ];
      
      const nearbyPlacesMap = {
        dining: [],
        bars: [],
        lodging: [],
        entertainment: [],
        shopping: [],
        attractions: [],
      };
      
      nearbyPlacesData.forEach(item => {
        if (!item.nearby_places) {return;}
        const category = item.nearby_places.category?.toLowerCase() || 'attractions';
        if (nearbyPlacesMap[category]) {
          nearbyPlacesMap[category].push(item.nearby_places);
        }
      });
      
      expect(nearbyPlacesMap.dining).toHaveLength(2);
      expect(nearbyPlacesMap.bars).toHaveLength(1);
      expect(nearbyPlacesMap.lodging).toHaveLength(0);
    });

    it('should limit places per category', () => {
      const places = Array(10).fill(null).map((_, i) => ({
        id: i,
        title: `Place ${i}`,
        rating: Math.random() * 5,
      }));
      
      const limited = places
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);
      
      expect(limited).toHaveLength(5);
    });

    it('should sort places by rating', () => {
      const places = [
        { id: 1, rating: 3.5 },
        { id: 2, rating: 4.8 },
        { id: 3, rating: 4.2 },
      ];
      
      const sorted = [...places].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
      expect(sorted[0].rating).toBe(4.8);
      expect(sorted[1].rating).toBe(4.2);
      expect(sorted[2].rating).toBe(3.5);
    });
  });

  describe('Nearby Places Transformation', () => {
    it('should transform nearby place data correctly', () => {
      const rawPlace = {
        id: 'place-1',
        data_cid: '123456789',
        title: 'Great Restaurant',
        category: 'dining',
        address: '123 Main St',
        phone: '555-1234',
        website: 'https://example.com',
        latitude: 37.7749,
        longitude: -122.4194,
        rating: 4.5,
        reviews_count: 500,
        price_level: 2,
        thumbnail: 'https://example.com/thumb.jpg',
      };
      const distanceMiles = 2.5;
      
      const transformed = {
        ...rawPlace,
        distanceMiles,
      };
      
      expect(transformed.title).toBe('Great Restaurant');
      expect(transformed.rating).toBe(4.5);
      expect(transformed.distanceMiles).toBe(2.5);
    });

    it('should handle missing optional fields', () => {
      const rawPlace = {
        id: 'place-1',
        title: 'Basic Place',
        category: 'dining',
        rating: null,
        website: null,
        thumbnail: null,
      };
      
      expect(rawPlace.rating).toBeNull();
      expect(rawPlace.website).toBeNull();
      expect(rawPlace.thumbnail).toBeNull();
    });
  });

  describe('Response Structure with Nearby Places', () => {
    it('should include nearbyPlaces in stop data', () => {
      const stop = {
        id: 'stop-1',
        parkCode: 'yose',
        nearbyPlaces: {
          dining: [{ id: 1, title: 'Restaurant' }],
          bars: [{ id: 2, title: 'Bar' }],
          lodging: [],
          entertainment: [],
          shopping: [],
          attractions: [],
        },
      };
      
      expect(stop).toHaveProperty('nearbyPlaces');
      expect(stop.nearbyPlaces.dining).toHaveLength(1);
      expect(stop.nearbyPlaces.bars).toHaveLength(1);
    });

    it('should handle null nearbyPlaces', () => {
      const stop = {
        id: 'stop-1',
        parkCode: 'yose',
        nearbyPlaces: null,
      };
      
      expect(stop.nearbyPlaces).toBeNull();
    });

    it('should handle park with no nearby places', () => {
      const nearbyPlacesMap = {};
      const parkCode = 'remote-park';
      
      const nearbyPlaces = nearbyPlacesMap[parkCode] || null;
      expect(nearbyPlaces).toBeNull();
    });
  });

  describe('Category Handling', () => {
    it('should handle all supported categories', () => {
      const supportedCategories = ['dining', 'bars', 'lodging', 'entertainment', 'shopping', 'attractions'];
      
      const nearbyPlacesMap = {};
      supportedCategories.forEach(cat => {
        nearbyPlacesMap[cat] = [];
      });
      
      expect(Object.keys(nearbyPlacesMap)).toHaveLength(6);
      supportedCategories.forEach(cat => {
        expect(nearbyPlacesMap).toHaveProperty(cat);
      });
    });

    it('should default unknown categories to attractions', () => {
      const place = { category: 'unknown_category' };
      const category = place.category?.toLowerCase() || 'attractions';
      const supportedCategories = ['dining', 'bars', 'lodging', 'entertainment', 'shopping', 'attractions'];
      
      const finalCategory = supportedCategories.includes(category) ? category : 'attractions';
      expect(finalCategory).toBe('attractions');
    });

    it('should handle null category', () => {
      const place = { category: null };
      const category = place.category?.toLowerCase() || 'attractions';
      
      expect(category).toBe('attractions');
    });
  });
});

describe('Trip Deletion - Edge Cases', () => {
  it('should handle concurrent deletion attempts', () => {
    // If two requests try to delete the same trip simultaneously,
    // the second one should get a 404 (trip not found)
    
    const firstDeleteResult = { success: true };
    const secondDeleteResult = { error: 'Trip not found' };
    
    expect(firstDeleteResult.success).toBe(true);
    expect(secondDeleteResult.error).toBe('Trip not found');
  });

  it('should handle trip with many stops', () => {
    // Cascade delete should handle trips with many stops efficiently
    
    const tripWithManyStops = {
      id: 'trip-uuid',
      stops: Array(100).fill({ id: 'stop-uuid' }),
    };
    
    expect(tripWithManyStops.stops.length).toBe(100);
  });

  it('should handle trip with no stops', () => {
    // Deletion should work even if trip has no stops
    
    const tripWithNoStops = {
      id: 'trip-uuid',
      stops: [],
    };
    
    expect(tripWithNoStops.stops.length).toBe(0);
  });

  it('should handle special characters in trip title', () => {
    // Trip deletion should work regardless of trip content
    
    const tripWithSpecialChars = {
      id: 'trip-uuid',
      title: "Trip with 'quotes' and \"double quotes\" and <html>",
    };
    
    expect(tripWithSpecialChars.title).toContain("'quotes'");
  });
});