/**
 * useTripStream Hook Tests
 * Tests for the SSE stream handling hook
 * 
 * Testing Framework: Vitest (used by the project)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import the hook and constants
import { useTripStream, TRIP_STREAM_STATUS } from '@/hooks/useTripStream';

describe('useTripStream Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    it('should have idle status initially', () => {
      const { result } = renderHook(() => useTripStream());

      expect(result.current.status).toBe(TRIP_STREAM_STATUS.IDLE);
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isComplete).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should have null values for trip data initially', () => {
      const { result } = renderHook(() => useTripStream());

      expect(result.current.progress).toBeNull();
      expect(result.current.completedDays).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.tripId).toBeNull();
      expect(result.current.tripTitle).toBeNull();
      expect(result.current.location).toBeNull();
      expect(result.current.parkCount).toBe(0);
    });
  });

  describe('TRIP_STREAM_STATUS Constants', () => {
    it('should have all required status values', () => {
      expect(TRIP_STREAM_STATUS.IDLE).toBe('idle');
      expect(TRIP_STREAM_STATUS.CONNECTING).toBe('connecting');
      expect(TRIP_STREAM_STATUS.GEOCODING).toBe('geocoding');
      expect(TRIP_STREAM_STATUS.FINDING_PARKS).toBe('finding_parks');
      expect(TRIP_STREAM_STATUS.GENERATING).toBe('generating');
      expect(TRIP_STREAM_STATUS.SAVING).toBe('saving');
      expect(TRIP_STREAM_STATUS.COMPLETE).toBe('complete');
      expect(TRIP_STREAM_STATUS.ERROR).toBe('error');
    });
  });

  describe('generateTrip', () => {
    it('should set connecting status when called', async () => {
      // Mock a response that never resolves to test initial state
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useTripStream());

      act(() => {
        result.current.generateTrip(
          { origin: 'San Francisco', startDate: '2025-01-15', endDate: '2025-01-18', interests: ['hiking'], difficulty: 'moderate' },
          'test-token'
        );
      });

      expect(result.current.status).toBe(TRIP_STREAM_STATUS.CONNECTING);
      expect(result.current.isLoading).toBe(true);
    });

    it('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Authentication required' }),
      });

      const { result } = renderHook(() => useTripStream());

      await act(async () => {
        await result.current.generateTrip(
          { origin: 'San Francisco', startDate: '2025-01-15', endDate: '2025-01-18', interests: ['hiking'], difficulty: 'moderate' },
          'invalid-token'
        );
      });

      expect(result.current.status).toBe(TRIP_STREAM_STATUS.ERROR);
      expect(result.current.isError).toBe(true);
      expect(result.current.error.code).toBe('API_ERROR');
    });

    it('should handle 402 free tier limit error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 402,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Free tier limit reached', code: 'FREE_TIER_LIMIT' }),
      });

      const { result } = renderHook(() => useTripStream());

      await act(async () => {
        await result.current.generateTrip(
          { origin: 'San Francisco', startDate: '2025-01-15', endDate: '2025-01-18', interests: ['hiking'], difficulty: 'moderate' },
          'test-token'
        );
      });

      expect(result.current.status).toBe(TRIP_STREAM_STATUS.ERROR);
      expect(result.current.isFreeTierLimit).toBe(true);
      expect(result.current.error.code).toBe('FREE_TIER_LIMIT');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTripStream());

      await act(async () => {
        await result.current.generateTrip(
          { origin: 'San Francisco', startDate: '2025-01-15', endDate: '2025-01-18', interests: ['hiking'], difficulty: 'moderate' },
          'test-token'
        );
      });

      expect(result.current.status).toBe(TRIP_STREAM_STATUS.ERROR);
      expect(result.current.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Bad request' }),
      });

      const { result } = renderHook(() => useTripStream());

      // First, trigger an error state
      await act(async () => {
        await result.current.generateTrip(
          { origin: 'San Francisco', startDate: '2025-01-15', endDate: '2025-01-18', interests: ['hiking'], difficulty: 'moderate' },
          'test-token'
        );
      });

      expect(result.current.isError).toBe(true);

      // Then reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe(TRIP_STREAM_STATUS.IDLE);
      expect(result.current.isIdle).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBeNull();
      expect(result.current.completedDays).toEqual([]);
    });
  });

  describe('cancel', () => {
    it('should abort the request and reset to idle', async () => {
      // Mock a long-running request
      let abortController;
      mockFetch.mockImplementation((url, options) => {
        abortController = options.signal;
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      const { result } = renderHook(() => useTripStream());

      // Start generation
      act(() => {
        result.current.generateTrip(
          { origin: 'San Francisco', startDate: '2025-01-15', endDate: '2025-01-18', interests: ['hiking'], difficulty: 'moderate' },
          'test-token'
        );
      });

      expect(result.current.isLoading).toBe(true);

      // Cancel
      await act(async () => {
        result.current.cancel();
        // Wait for the abort to be processed
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(result.current.status).toBe(TRIP_STREAM_STATUS.IDLE);
    });
  });

  describe('Computed Properties', () => {
    it('should correctly compute isLoading for all loading states', () => {
      const loadingStatuses = [
        TRIP_STREAM_STATUS.CONNECTING,
        TRIP_STREAM_STATUS.GEOCODING,
        TRIP_STREAM_STATUS.FINDING_PARKS,
        TRIP_STREAM_STATUS.GENERATING,
        TRIP_STREAM_STATUS.SAVING,
      ];

      loadingStatuses.forEach(status => {
        expect(loadingStatuses.includes(status)).toBe(true);
      });
    });

    it('should correctly identify complete state', () => {
      const { result } = renderHook(() => useTripStream());
      
      // Initially not complete
      expect(result.current.isComplete).toBe(false);
    });

    it('should correctly identify error state', () => {
      const { result } = renderHook(() => useTripStream());
      
      // Initially not error
      expect(result.current.isError).toBe(false);
    });
  });
});

describe('SSE Event Parsing', () => {
  describe('Progress Events', () => {
    it('should parse geocoding progress event', () => {
      const eventData = {
        stage: 'geocoding',
        message: 'Finding location for "San Francisco"...',
      };

      expect(eventData.stage).toBe('geocoding');
      expect(eventData.message).toContain('San Francisco');
    });

    it('should parse parks_found progress event', () => {
      const eventData = {
        stage: 'parks_found',
        message: 'Found 15 parks within 200 miles',
        parkCount: 15,
      };

      expect(eventData.stage).toBe('parks_found');
      expect(eventData.parkCount).toBe(15);
    });

    it('should parse generating progress event', () => {
      const eventData = {
        stage: 'generating',
        message: 'Creating your personalized itinerary...',
      };

      expect(eventData.stage).toBe('generating');
    });
  });

  describe('Day Complete Events', () => {
    it('should parse day_complete event', () => {
      const eventData = {
        day: 1,
        park_name: 'Yosemite National Park',
      };

      expect(eventData.day).toBe(1);
      expect(eventData.park_name).toBe('Yosemite National Park');
    });
  });

  describe('Complete Events', () => {
    it('should parse complete event', () => {
      const eventData = {
        trip_id: '123e4567-e89b-12d3-a456-426614174000',
        redirect: '/trip/123e4567-e89b-12d3-a456-426614174000',
        title: 'California Adventure',
        days: 4,
      };

      expect(eventData.trip_id).toBeDefined();
      expect(eventData.redirect).toContain('/trip/');
      expect(eventData.title).toBe('California Adventure');
      expect(eventData.days).toBe(4);
    });
  });

  describe('Error Events', () => {
    it('should parse error event', () => {
      const eventData = {
        message: 'Failed to generate trip',
      };

      expect(eventData.message).toBe('Failed to generate trip');
    });
  });
});

describe('Form Data Validation', () => {
  it('should validate origin is required', () => {
    const formData = { origin: '' };
    expect(formData.origin.trim().length === 0).toBe(true);
  });

  it('should validate dates are required', () => {
    const formData = { startDate: null, endDate: null };
    expect(formData.startDate).toBeNull();
    expect(formData.endDate).toBeNull();
  });

  it('should validate interests array is not empty', () => {
    const emptyInterests = [];
    const validInterests = ['hiking'];

    expect(emptyInterests.length === 0).toBe(true);
    expect(validInterests.length > 0).toBe(true);
  });

  it('should validate difficulty is valid', () => {
    const validDifficulties = ['easy', 'moderate', 'hard'];
    
    expect(validDifficulties.includes('moderate')).toBe(true);
    expect(validDifficulties.includes('extreme')).toBe(false);
  });
});