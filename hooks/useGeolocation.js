/**
 * useGeolocation Hook
 *
 * React hook for accessing the Geolocation API with support for
 * continuous tracking, error handling, and permission management.
 *
 * @module hooks/useGeolocation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Geolocation error codes
 */
export const GEO_ERROR = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
  NOT_SUPPORTED: 4,
};

/**
 * Default geolocation options
 */
const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

/**
 * Check if geolocation is supported
 * @returns {boolean} True if geolocation is supported
 */
export const isGeolocationSupported = () => {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
};

/**
 * Request geolocation permission
 * @returns {Promise<string>} Permission state ('granted', 'denied', 'prompt')
 */
export const requestGeolocationPermission = async () => {
  if (!isGeolocationSupported()) {
    return 'denied';
  }

  try {
    // Try to use the Permissions API if available
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    }

    // Fallback: try to get position to trigger permission prompt
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => {
          if (error.code === GEO_ERROR.PERMISSION_DENIED) {
            resolve('denied');
          } else {
            resolve('prompt');
          }
        },
        { timeout: 5000 }
      );
    });
  } catch {
    return 'prompt';
  }
};

/**
 * useGeolocation hook
 *
 * @param {Object} options - Hook options
 * @param {boolean} [options.enableHighAccuracy=true] - Use high accuracy mode
 * @param {number} [options.timeout=10000] - Timeout in milliseconds
 * @param {number} [options.maximumAge=0] - Maximum age of cached position
 * @param {boolean} [options.watch=false] - Enable continuous tracking
 * @param {Function} [options.onPosition] - Callback for new positions
 * @param {Function} [options.onError] - Callback for errors
 * @returns {Object} Geolocation state and controls
 */
export const useGeolocation = (options = {}) => {
  const {
    enableHighAccuracy = DEFAULT_OPTIONS.enableHighAccuracy,
    timeout = DEFAULT_OPTIONS.timeout,
    maximumAge = DEFAULT_OPTIONS.maximumAge,
    watch = false,
    onPosition,
    onError,
  } = options;

  // State
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt');

  // Refs
  const watchIdRef = useRef(null);
  const onPositionRef = useRef(onPosition);
  const onErrorRef = useRef(onError);

  // Keep callbacks up to date
  useEffect(() => {
    onPositionRef.current = onPosition;
    onErrorRef.current = onError;
  }, [onPosition, onError]);

  // Geolocation options
  const geoOptions = {
    enableHighAccuracy,
    timeout,
    maximumAge,
  };

  /**
   * Handle successful position
   */
  const handleSuccess = useCallback((pos) => {
    const newPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
      altitudeAccuracy: pos.coords.altitudeAccuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    };

    setPosition(newPosition);
    setError(null);
    setIsLoading(false);

    if (onPositionRef.current) {
      onPositionRef.current(newPosition);
    }
  }, []);

  /**
   * Handle geolocation error
   */
  const handleError = useCallback((err) => {
    const errorInfo = {
      code: err.code,
      message: err.message,
      isPermissionDenied: err.code === GEO_ERROR.PERMISSION_DENIED,
      isPositionUnavailable: err.code === GEO_ERROR.POSITION_UNAVAILABLE,
      isTimeout: err.code === GEO_ERROR.TIMEOUT,
    };

    setError(errorInfo);
    setIsLoading(false);

    if (err.code === GEO_ERROR.PERMISSION_DENIED) {
      setPermissionState('denied');
    }

    if (onErrorRef.current) {
      onErrorRef.current(errorInfo);
    }
  }, []);

  /**
   * Get current position once
   */
  const getCurrentPosition = useCallback(() => {
    if (!isGeolocationSupported()) {
      const err = {
        code: GEO_ERROR.NOT_SUPPORTED,
        message: 'Geolocation is not supported by this browser',
        isPermissionDenied: false,
        isPositionUnavailable: false,
        isTimeout: false,
        isNotSupported: true,
      };
      setError(err);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
  }, [handleSuccess, handleError, geoOptions]);

  /**
   * Start watching position
   */
  const startWatching = useCallback(() => {
    if (!isGeolocationSupported()) {
      const err = {
        code: GEO_ERROR.NOT_SUPPORTED,
        message: 'Geolocation is not supported by this browser',
        isNotSupported: true,
      };
      setError(err);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setIsLoading(true);
    setError(null);
    setIsWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
  }, [handleSuccess, handleError, geoOptions]);

  /**
   * Stop watching position
   */
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
    setIsLoading(false);
  }, []);

  /**
   * Clear position and error state
   */
  const clearState = useCallback(() => {
    setPosition(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // Check permission state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPermission = async () => {
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionState(result.state);

          // Listen for permission changes
          result.addEventListener('change', () => {
            setPermissionState(result.state);
          });
        } catch {
          // Permissions API not fully supported
        }
      }
    };

    checkPermission();
  }, []);

  // Auto-start watching if watch option is true
  useEffect(() => {
    if (watch && !isWatching) {
      startWatching();
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [watch, isWatching, startWatching]);

  return {
    // State
    position,
    error,
    isLoading,
    isWatching,
    permissionState,
    isSupported: isGeolocationSupported(),

    // Actions
    getCurrentPosition,
    startWatching,
    stopWatching,
    clearState,

    // Convenience getters
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    altitude: position?.altitude ?? null,
    accuracy: position?.accuracy ?? null,
    speed: position?.speed ?? null,
    heading: position?.heading ?? null,
    timestamp: position?.timestamp ?? null,
  };
};

export default useGeolocation;
