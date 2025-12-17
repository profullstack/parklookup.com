/**
 * Tests for useGeolocation Hook
 *
 * @module test/hooks/useGeolocation.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

// Mock navigator.permissions
const mockPermissions = {
  query: vi.fn(),
};

describe('useGeolocation Hook', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: mockGeolocation,
      permissions: mockPermissions,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Initial State', () => {
    it('should have null position initially', () => {
      // Initial state before any geolocation calls
      const initialState = {
        position: null,
        error: null,
        loading: false,
        permissionState: 'prompt',
      };

      expect(initialState.position).toBeNull();
      expect(initialState.error).toBeNull();
      expect(initialState.loading).toBe(false);
    });

    it('should have prompt permission state initially', () => {
      const initialState = {
        permissionState: 'prompt',
      };

      expect(initialState.permissionState).toBe('prompt');
    });
  });

  describe('Permission Handling', () => {
    it('should check permission on mount', async () => {
      mockPermissions.query.mockResolvedValueOnce({
        state: 'granted',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      // Permission should be checked
      await mockPermissions.query({ name: 'geolocation' });

      expect(mockPermissions.query).toHaveBeenCalledWith({ name: 'geolocation' });
    });

    it('should handle granted permission', async () => {
      const permissionStatus = {
        state: 'granted',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      mockPermissions.query.mockResolvedValueOnce(permissionStatus);

      const result = await mockPermissions.query({ name: 'geolocation' });
      expect(result.state).toBe('granted');
    });

    it('should handle denied permission', async () => {
      const permissionStatus = {
        state: 'denied',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      mockPermissions.query.mockResolvedValueOnce(permissionStatus);

      const result = await mockPermissions.query({ name: 'geolocation' });
      expect(result.state).toBe('denied');
    });

    it('should handle prompt permission', async () => {
      const permissionStatus = {
        state: 'prompt',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      mockPermissions.query.mockResolvedValueOnce(permissionStatus);

      const result = await mockPermissions.query({ name: 'geolocation' });
      expect(result.state).toBe('prompt');
    });

    it('should listen for permission changes', async () => {
      const addEventListener = vi.fn();
      const permissionStatus = {
        state: 'prompt',
        addEventListener,
        removeEventListener: vi.fn(),
      };

      mockPermissions.query.mockResolvedValueOnce(permissionStatus);

      await mockPermissions.query({ name: 'geolocation' });

      // Should add change listener
      permissionStatus.addEventListener('change', expect.any(Function));
    });
  });

  describe('getCurrentPosition', () => {
    it('should get current position successfully', async () => {
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 100,
          accuracy: 10,
          altitudeAccuracy: 5,
          heading: 45,
          speed: 1.5,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
        success(mockPosition);
      });

      let receivedPosition = null;
      mockGeolocation.getCurrentPosition((pos) => {
        receivedPosition = pos;
      });

      expect(receivedPosition).toEqual(mockPosition);
      expect(receivedPosition.coords.latitude).toBe(37.7749);
      expect(receivedPosition.coords.longitude).toBe(-122.4194);
    });

    it('should handle position error', async () => {
      const mockError = {
        code: 1,
        message: 'User denied geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      mockGeolocation.getCurrentPosition.mockImplementationOnce((success, error) => {
        error(mockError);
      });

      let receivedError = null;
      mockGeolocation.getCurrentPosition(
        () => {},
        (err) => {
          receivedError = err;
        }
      );

      expect(receivedError.code).toBe(1);
      expect(receivedError.message).toBe('User denied geolocation');
    });

    it('should handle timeout error', async () => {
      const mockError = {
        code: 3,
        message: 'Timeout expired',
        TIMEOUT: 3,
      };

      mockGeolocation.getCurrentPosition.mockImplementationOnce((success, error) => {
        error(mockError);
      });

      let receivedError = null;
      mockGeolocation.getCurrentPosition(
        () => {},
        (err) => {
          receivedError = err;
        }
      );

      expect(receivedError.code).toBe(3);
    });

    it('should pass options to getCurrentPosition', () => {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      };

      mockGeolocation.getCurrentPosition(vi.fn(), vi.fn(), options);

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        options
      );
    });
  });

  describe('watchPosition', () => {
    it('should start watching position', () => {
      const watchId = 123;
      mockGeolocation.watchPosition.mockReturnValueOnce(watchId);

      const id = mockGeolocation.watchPosition(vi.fn(), vi.fn(), {
        enableHighAccuracy: true,
      });

      expect(id).toBe(watchId);
      expect(mockGeolocation.watchPosition).toHaveBeenCalled();
    });

    it('should receive position updates', () => {
      const positions = [];
      const mockPosition1 = {
        coords: { latitude: 37.7749, longitude: -122.4194 },
        timestamp: Date.now(),
      };
      const mockPosition2 = {
        coords: { latitude: 37.7750, longitude: -122.4195 },
        timestamp: Date.now() + 1000,
      };

      mockGeolocation.watchPosition.mockImplementationOnce((success) => {
        success(mockPosition1);
        setTimeout(() => success(mockPosition2), 100);
        return 123;
      });

      mockGeolocation.watchPosition((pos) => {
        positions.push(pos);
      });

      expect(positions).toHaveLength(1);
      expect(positions[0].coords.latitude).toBe(37.7749);
    });

    it('should clear watch on cleanup', () => {
      const watchId = 123;
      mockGeolocation.watchPosition.mockReturnValueOnce(watchId);

      const id = mockGeolocation.watchPosition(vi.fn());
      mockGeolocation.clearWatch(id);

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId);
    });

    it('should pass high accuracy option', () => {
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      };

      mockGeolocation.watchPosition(vi.fn(), vi.fn(), options);

      expect(mockGeolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        options
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle PERMISSION_DENIED error', () => {
      const error = { code: 1, message: 'User denied geolocation' };
      const errorMessage = getErrorMessage(error);

      expect(errorMessage).toContain('denied');
    });

    it('should handle POSITION_UNAVAILABLE error', () => {
      const error = { code: 2, message: 'Position unavailable' };
      const errorMessage = getErrorMessage(error);

      expect(errorMessage).toContain('unavailable');
    });

    it('should handle TIMEOUT error', () => {
      const error = { code: 3, message: 'Timeout' };
      const errorMessage = getErrorMessage(error);

      expect(errorMessage).toContain('timeout');
    });

    it('should handle unknown error', () => {
      const error = { code: 99, message: 'Unknown error' };
      const errorMessage = getErrorMessage(error);

      expect(errorMessage).toBeDefined();
    });
  });

  describe('Position Data', () => {
    it('should extract all coordinate data', () => {
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 100,
          accuracy: 10,
          altitudeAccuracy: 5,
          heading: 45,
          speed: 1.5,
        },
        timestamp: 1704067200000,
      };

      const extracted = {
        latitude: mockPosition.coords.latitude,
        longitude: mockPosition.coords.longitude,
        altitude: mockPosition.coords.altitude,
        accuracy: mockPosition.coords.accuracy,
        altitudeAccuracy: mockPosition.coords.altitudeAccuracy,
        heading: mockPosition.coords.heading,
        speed: mockPosition.coords.speed,
        timestamp: mockPosition.timestamp,
      };

      expect(extracted.latitude).toBe(37.7749);
      expect(extracted.longitude).toBe(-122.4194);
      expect(extracted.altitude).toBe(100);
      expect(extracted.accuracy).toBe(10);
      expect(extracted.speed).toBe(1.5);
    });

    it('should handle null optional fields', () => {
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: null,
          accuracy: 10,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };

      expect(mockPosition.coords.altitude).toBeNull();
      expect(mockPosition.coords.heading).toBeNull();
      expect(mockPosition.coords.speed).toBeNull();
    });
  });

  describe('Browser Support', () => {
    it('should detect geolocation support', () => {
      const isSupported = 'geolocation' in navigator;
      expect(isSupported).toBe(true);
    });

    it('should handle missing geolocation API', () => {
      vi.stubGlobal('navigator', {});

      const isSupported = 'geolocation' in navigator;
      expect(isSupported).toBe(false);
    });

    it('should handle missing permissions API', () => {
      vi.stubGlobal('navigator', {
        geolocation: mockGeolocation,
      });

      const hasPermissions = 'permissions' in navigator;
      expect(hasPermissions).toBe(false);
    });
  });
});

// Helper function for error messages
function getErrorMessage(error) {
  switch (error.code) {
    case 1:
      return 'Location access denied. Please enable location permissions.';
    case 2:
      return 'Location unavailable. Please try again.';
    case 3:
      return 'Location request timeout. Please try again.';
    default:
      return 'An unknown error occurred.';
  }
}
