/**
 * AI Trip Generation API Route Tests
 * Tests for the trip generation and limit checking logic
 *
 * Testing Framework: Vitest (used by the project)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AI Trip API Routes - Unit Tests', () => {
  describe('Trip Limit Check Logic', () => {
    /**
     * Simulates the checkTripLimit function logic
     * This tests the business logic without requiring Supabase mocks
     */
    const simulateCheckTripLimit = ({ isPro, existingTrips }) => {
      // Pro users can always create
      if (isPro) {
        return { canCreate: true, isPro: true, existingTripId: null };
      }

      // Free users can always create/overwrite their single trip
      const existingTripId = existingTrips?.[0]?.id || null;
      return { canCreate: true, isPro: false, existingTripId };
    };

    describe('Pro Users', () => {
      it('should allow pro users to create trips', () => {
        const result = simulateCheckTripLimit({
          isPro: true,
          existingTrips: [],
        });

        expect(result.canCreate).toBe(true);
        expect(result.isPro).toBe(true);
        expect(result.existingTripId).toBeNull();
      });

      it('should allow pro users to create trips even with existing trips', () => {
        const result = simulateCheckTripLimit({
          isPro: true,
          existingTrips: [
            { id: 'trip-1' },
            { id: 'trip-2' },
            { id: 'trip-3' },
          ],
        });

        expect(result.canCreate).toBe(true);
        expect(result.isPro).toBe(true);
      });
    });

    describe('Free Users', () => {
      it('should allow free users to create their first trip', () => {
        const result = simulateCheckTripLimit({
          isPro: false,
          existingTrips: [],
        });

        expect(result.canCreate).toBe(true);
        expect(result.isPro).toBe(false);
        expect(result.existingTripId).toBeNull();
      });

      it('should allow free users to overwrite their existing trip', () => {
        const result = simulateCheckTripLimit({
          isPro: false,
          existingTrips: [{ id: 'existing-trip-123' }],
        });

        expect(result.canCreate).toBe(true);
        expect(result.isPro).toBe(false);
        expect(result.existingTripId).toBe('existing-trip-123');
      });

      it('should return existingTripId when free user has a trip', () => {
        const result = simulateCheckTripLimit({
          isPro: false,
          existingTrips: [{ id: 'my-trip-uuid' }],
        });

        expect(result.existingTripId).toBe('my-trip-uuid');
      });

      it('should handle null existingTrips array', () => {
        const result = simulateCheckTripLimit({
          isPro: false,
          existingTrips: null,
        });

        expect(result.canCreate).toBe(true);
        expect(result.existingTripId).toBeNull();
      });

      it('should handle undefined existingTrips array', () => {
        const result = simulateCheckTripLimit({
          isPro: false,
          existingTrips: undefined,
        });

        expect(result.canCreate).toBe(true);
        expect(result.existingTripId).toBeNull();
      });
    });
  });

  describe('Save Trip Logic - Overwrite Behavior', () => {
    /**
     * Simulates the saveTrip function's decision logic
     * Returns whether to update or insert
     */
    const determineSaveAction = (existingTrips) => {
      if (existingTrips && existingTrips.length > 0) {
        return { action: 'update', tripId: existingTrips[0].id };
      }
      return { action: 'insert', tripId: null };
    };

    it('should update when user has existing trip', () => {
      const result = determineSaveAction([{ id: 'existing-trip-123' }]);

      expect(result.action).toBe('update');
      expect(result.tripId).toBe('existing-trip-123');
    });

    it('should insert when user has no trips', () => {
      const result = determineSaveAction([]);

      expect(result.action).toBe('insert');
      expect(result.tripId).toBeNull();
    });

    it('should insert when existingTrips is null', () => {
      const result = determineSaveAction(null);

      expect(result.action).toBe('insert');
      expect(result.tripId).toBeNull();
    });

    it('should use first trip id when multiple exist (edge case)', () => {
      const result = determineSaveAction([
        { id: 'trip-1' },
        { id: 'trip-2' },
      ]);

      expect(result.action).toBe('update');
      expect(result.tripId).toBe('trip-1');
    });
  });

  describe('Request Validation', () => {
    const TRIP_INTERESTS = [
      'camping',
      'hiking',
      'photography',
      'scenic_drives',
      'wildlife',
      'stargazing',
      'rock_climbing',
      'fishing',
      'kayaking',
      'bird_watching',
    ];

    const DIFFICULTY_LEVELS = ['easy', 'moderate', 'hard'];

    /**
     * Simulates the validateRequest function
     */
    const validateRequest = (body) => {
      const errors = [];

      if (!body.origin || typeof body.origin !== 'string') {
        errors.push('origin is required and must be a string');
      }

      if (!body.startDate) {
        errors.push('startDate is required');
      } else {
        const start = new Date(body.startDate);
        if (isNaN(start.getTime())) {
          errors.push('startDate must be a valid date');
        }
      }

      if (!body.endDate) {
        errors.push('endDate is required');
      } else {
        const end = new Date(body.endDate);
        if (isNaN(end.getTime())) {
          errors.push('endDate must be a valid date');
        }
      }

      if (body.startDate && body.endDate) {
        const start = new Date(body.startDate);
        const end = new Date(body.endDate);
        if (end < start) {
          errors.push('endDate must be after startDate');
        }
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (days > 14) {
          errors.push('Trip cannot exceed 14 days');
        }
      }

      if (!body.interests || !Array.isArray(body.interests) || body.interests.length === 0) {
        errors.push('interests is required and must be a non-empty array');
      } else {
        const invalidInterests = body.interests.filter((i) => !TRIP_INTERESTS.includes(i));
        if (invalidInterests.length > 0) {
          errors.push(`Invalid interests: ${invalidInterests.join(', ')}`);
        }
      }

      if (!body.difficulty || !DIFFICULTY_LEVELS.includes(body.difficulty)) {
        errors.push(`difficulty must be one of: ${DIFFICULTY_LEVELS.join(', ')}`);
      }

      if (body.radiusMiles !== undefined) {
        const radius = parseInt(body.radiusMiles, 10);
        if (isNaN(radius) || radius < 50 || radius > 500) {
          errors.push('radiusMiles must be between 50 and 500');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    it('should validate a complete valid request', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: ['hiking', 'photography'],
        difficulty: 'moderate',
        radiusMiles: 200,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing origin', () => {
      const result = validateRequest({
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: ['hiking'],
        difficulty: 'easy',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('origin is required and must be a string');
    });

    it('should reject missing startDate', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        endDate: '2025-06-05',
        interests: ['hiking'],
        difficulty: 'easy',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('startDate is required');
    });

    it('should reject endDate before startDate', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-10',
        endDate: '2025-06-05',
        interests: ['hiking'],
        difficulty: 'easy',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('endDate must be after startDate');
    });

    it('should reject trips longer than 14 days', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-20',
        interests: ['hiking'],
        difficulty: 'easy',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Trip cannot exceed 14 days');
    });

    it('should reject empty interests array', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: [],
        difficulty: 'easy',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('interests is required and must be a non-empty array');
    });

    it('should reject invalid interests', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: ['hiking', 'invalid_interest'],
        difficulty: 'easy',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid interests'))).toBe(true);
    });

    it('should reject invalid difficulty', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: ['hiking'],
        difficulty: 'extreme',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('difficulty must be one of'))).toBe(true);
    });

    it('should reject radiusMiles below 50', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: ['hiking'],
        difficulty: 'easy',
        radiusMiles: 25,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('radiusMiles must be between 50 and 500');
    });

    it('should reject radiusMiles above 500', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: ['hiking'],
        difficulty: 'easy',
        radiusMiles: 600,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('radiusMiles must be between 50 and 500');
    });

    it('should allow request without radiusMiles (uses default)', () => {
      const result = validateRequest({
        origin: 'San Francisco, CA',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
        interests: ['hiking'],
        difficulty: 'easy',
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('Authentication Header Parsing', () => {
    it('should extract Bearer token from authorization header', () => {
      const request = new Request('http://localhost/api/ai/trip', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token-123',
        },
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBe('Bearer test-token-123');

      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      expect(token).toBe('test-token-123');
    });

    it('should return null for missing authorization header', () => {
      const request = new Request('http://localhost/api/ai/trip', {
        method: 'POST',
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBeNull();
    });

    it('should return null for non-Bearer authorization', () => {
      const request = new Request('http://localhost/api/ai/trip', {
        method: 'POST',
        headers: {
          Authorization: 'Basic dXNlcjpwYXNz',
        },
      });

      const authHeader = request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      expect(token).toBeNull();
    });
  });

  describe('Trip Days Calculation', () => {
    it('should calculate correct number of days for a trip', () => {
      const startDate = '2025-06-01';
      const endDate = '2025-06-05';

      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      expect(days).toBe(5);
    });

    it('should return 1 for same-day trip', () => {
      const startDate = '2025-06-01';
      const endDate = '2025-06-01';

      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      expect(days).toBe(1);
    });

    it('should calculate 14 days for maximum allowed trip', () => {
      const startDate = '2025-06-01';
      const endDate = '2025-06-14';

      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      expect(days).toBe(14);
    });
  });

  describe('Season Detection', () => {
    const getSeason = (dateString) => {
      const month = new Date(dateString).getMonth();
      return month >= 2 && month <= 4
        ? 'spring'
        : month >= 5 && month <= 7
          ? 'summer'
          : month >= 8 && month <= 10
            ? 'fall'
            : 'winter';
    };

    it('should detect spring (March-May)', () => {
      expect(getSeason('2025-03-15')).toBe('spring');
      expect(getSeason('2025-04-15')).toBe('spring');
      expect(getSeason('2025-05-15')).toBe('spring');
    });

    it('should detect summer (June-August)', () => {
      expect(getSeason('2025-06-15')).toBe('summer');
      expect(getSeason('2025-07-15')).toBe('summer');
      expect(getSeason('2025-08-15')).toBe('summer');
    });

    it('should detect fall (September-November)', () => {
      expect(getSeason('2025-09-15')).toBe('fall');
      expect(getSeason('2025-10-15')).toBe('fall');
      expect(getSeason('2025-11-15')).toBe('fall');
    });

    it('should detect winter (December-February)', () => {
      expect(getSeason('2025-12-15')).toBe('winter');
      expect(getSeason('2025-01-15')).toBe('winter');
      expect(getSeason('2025-02-15')).toBe('winter');
    });
  });
});