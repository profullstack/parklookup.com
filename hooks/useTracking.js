/**
 * useTracking Hook
 *
 * React hook for GPS track recording that combines geolocation,
 * activity detection, and track management.
 *
 * @module hooks/useTracking
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeolocation } from './useGeolocation';
import { ActivityDetector } from '@/lib/tracking/activity-detection';
import { calculateTrackStats } from '@/lib/tracking/track-stats';
import {
  createTrack,
  addTrackPoints,
  updateTrack,
  finalizeTrack,
} from '@/lib/tracking/tracking-client';

/**
 * Tracking states
 */
export const TRACKING_STATE = {
  IDLE: 'idle',
  STARTING: 'starting',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  ERROR: 'error',
};

/**
 * Default tracking options
 */
const DEFAULT_OPTIONS = {
  // Geolocation options
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,

  // Tracking options
  minDistanceMeters: 5, // Minimum distance between points
  maxPointsPerBatch: 50, // Points to batch before uploading
  uploadIntervalMs: 30000, // Upload interval in milliseconds
  autoDetectActivity: true, // Auto-detect activity type
};

/**
 * useTracking hook
 *
 * @param {Object} options - Hook options
 * @param {string} options.accessToken - User's access token
 * @param {Object} [options.trackConfig] - Initial track configuration
 * @param {Function} [options.onTrackCreated] - Callback when track is created
 * @param {Function} [options.onPointsUploaded] - Callback when points are uploaded
 * @param {Function} [options.onTrackCompleted] - Callback when track is completed
 * @param {Function} [options.onError] - Callback for errors
 * @returns {Object} Tracking state and controls
 */
export const useTracking = (options = {}) => {
  const {
    accessToken,
    trackConfig = {},
    onTrackCreated,
    onPointsUploaded,
    onTrackCompleted,
    onError,
    ...geoOptions
  } = options;

  const mergedOptions = { ...DEFAULT_OPTIONS, ...geoOptions };

  // State
  const [trackingState, setTrackingState] = useState(TRACKING_STATE.IDLE);
  const [track, setTrack] = useState(null);
  const [points, setPoints] = useState([]);
  const [pendingPoints, setPendingPoints] = useState([]);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Refs
  const activityDetectorRef = useRef(new ActivityDetector());
  const lastPositionRef = useRef(null);
  const sequenceNumRef = useRef(0);
  const uploadTimerRef = useRef(null);
  const onTrackCreatedRef = useRef(onTrackCreated);
  const onPointsUploadedRef = useRef(onPointsUploaded);
  const onTrackCompletedRef = useRef(onTrackCompleted);
  const onErrorRef = useRef(onError);

  // Keep callbacks up to date
  useEffect(() => {
    onTrackCreatedRef.current = onTrackCreated;
    onPointsUploadedRef.current = onPointsUploaded;
    onTrackCompletedRef.current = onTrackCompleted;
    onErrorRef.current = onError;
  }, [onTrackCreated, onPointsUploaded, onTrackCompleted, onError]);

  /**
   * Calculate distance between two positions
   */
  const calculateDistance = (pos1, pos2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
    const dLng = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pos1.latitude * Math.PI) / 180) *
        Math.cos((pos2.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Handle new position from geolocation
   */
  const handlePosition = useCallback(
    (position) => {
      if (trackingState !== TRACKING_STATE.RECORDING) {
        return;
      }

      // Check minimum distance
      if (lastPositionRef.current) {
        const distance = calculateDistance(lastPositionRef.current, position);
        if (distance < mergedOptions.minDistanceMeters) {
          return; // Skip this point
        }
      }

      // Create point object
      const point = {
        latitude: position.latitude,
        longitude: position.longitude,
        altitudeM: position.altitude,
        accuracyM: position.accuracy,
        altitudeAccuracyM: position.altitudeAccuracy,
        speedMps: position.speed,
        heading: position.heading,
        sequenceNum: sequenceNumRef.current++,
        recordedAt: new Date(position.timestamp).toISOString(),
      };

      // Update activity detection
      if (mergedOptions.autoDetectActivity && position.speed != null) {
        const detection = activityDetectorRef.current.addSpeed(position.speed);
        setActivity(detection);
      }

      // Add to points arrays
      setPoints((prev) => [...prev, point]);
      setPendingPoints((prev) => [...prev, point]);

      // Update last position
      lastPositionRef.current = position;

      // Update stats
      setStats((prev) => {
        const allPoints = prev ? [...points, point] : [point];
        return calculateTrackStats(allPoints);
      });
    },
    [trackingState, points, mergedOptions.minDistanceMeters, mergedOptions.autoDetectActivity]
  );

  /**
   * Handle geolocation error
   */
  const handleGeoError = useCallback((err) => {
    console.error('Geolocation error:', err);
    setError(err);
    if (onErrorRef.current) {
      onErrorRef.current(err);
    }
  }, []);

  // Use geolocation hook
  const geo = useGeolocation({
    enableHighAccuracy: mergedOptions.enableHighAccuracy,
    timeout: mergedOptions.timeout,
    maximumAge: mergedOptions.maximumAge,
    watch: trackingState === TRACKING_STATE.RECORDING,
    onPosition: handlePosition,
    onError: handleGeoError,
  });

  /**
   * Upload pending points to server
   */
  const uploadPoints = useCallback(async () => {
    if (!track?.id || pendingPoints.length === 0 || isUploading || !accessToken) {
      return;
    }

    setIsUploading(true);

    try {
      const result = await addTrackPoints(accessToken, track.id, pendingPoints);

      if (result.error) {
        console.error('Failed to upload points:', result.error);
        // Keep points in pending for retry
      } else {
        // Clear uploaded points from pending
        setPendingPoints([]);

        if (onPointsUploadedRef.current) {
          onPointsUploadedRef.current(result);
        }
      }
    } catch (err) {
      console.error('Error uploading points:', err);
    } finally {
      setIsUploading(false);
    }
  }, [track?.id, pendingPoints, isUploading, accessToken]);

  /**
   * Start tracking
   */
  const startTracking = useCallback(
    async (config = {}) => {
      if (!accessToken) {
        const err = { message: 'Access token required' };
        setError(err);
        if (onErrorRef.current) {
          onErrorRef.current(err);
        }
        return { error: err };
      }

      setTrackingState(TRACKING_STATE.STARTING);
      setError(null);

      try {
        // Create track on server
        const result = await createTrack(accessToken, {
          ...trackConfig,
          ...config,
        });

        if (result.error) {
          setTrackingState(TRACKING_STATE.ERROR);
          setError(result.error);
          if (onErrorRef.current) {
            onErrorRef.current(result.error);
          }
          return result;
        }

        // Initialize tracking state
        setTrack(result.track);
        setPoints([]);
        setPendingPoints([]);
        setStats(null);
        sequenceNumRef.current = 0;
        lastPositionRef.current = null;
        activityDetectorRef.current.reset();

        // Start recording
        setTrackingState(TRACKING_STATE.RECORDING);

        // Start upload timer
        uploadTimerRef.current = setInterval(() => {
          uploadPoints();
        }, mergedOptions.uploadIntervalMs);

        if (onTrackCreatedRef.current) {
          onTrackCreatedRef.current(result.track);
        }

        return result;
      } catch (err) {
        setTrackingState(TRACKING_STATE.ERROR);
        setError({ message: err.message });
        if (onErrorRef.current) {
          onErrorRef.current({ message: err.message });
        }
        return { error: { message: err.message } };
      }
    },
    [accessToken, trackConfig, mergedOptions.uploadIntervalMs, uploadPoints]
  );

  /**
   * Pause tracking
   */
  const pauseTracking = useCallback(async () => {
    if (trackingState !== TRACKING_STATE.RECORDING) {
      return;
    }

    // Upload any pending points
    await uploadPoints();

    // Update track status on server
    if (track?.id && accessToken) {
      await updateTrack(accessToken, track.id, { status: 'paused' });
    }

    setTrackingState(TRACKING_STATE.PAUSED);

    // Clear upload timer
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
  }, [trackingState, track?.id, accessToken, uploadPoints]);

  /**
   * Resume tracking
   */
  const resumeTracking = useCallback(async () => {
    if (trackingState !== TRACKING_STATE.PAUSED) {
      return;
    }

    // Update track status on server
    if (track?.id && accessToken) {
      await updateTrack(accessToken, track.id, { status: 'recording' });
    }

    setTrackingState(TRACKING_STATE.RECORDING);

    // Restart upload timer
    uploadTimerRef.current = setInterval(() => {
      uploadPoints();
    }, mergedOptions.uploadIntervalMs);
  }, [trackingState, track?.id, accessToken, mergedOptions.uploadIntervalMs, uploadPoints]);

  /**
   * Stop tracking and finalize
   */
  const stopTracking = useCallback(async () => {
    if (trackingState === TRACKING_STATE.IDLE) {
      return { error: { message: 'Not tracking' } };
    }

    setTrackingState(TRACKING_STATE.STOPPING);

    // Clear upload timer
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }

    try {
      // Upload any remaining points
      if (pendingPoints.length > 0 && track?.id && accessToken) {
        await addTrackPoints(accessToken, track.id, pendingPoints);
        setPendingPoints([]);
      }

      // Finalize track on server
      if (track?.id && accessToken) {
        const result = await finalizeTrack(accessToken, track.id);

        if (result.error) {
          setError(result.error);
          setTrackingState(TRACKING_STATE.ERROR);
          return result;
        }

        setTrack(result.track);

        if (onTrackCompletedRef.current) {
          onTrackCompletedRef.current(result.track);
        }
      }

      setTrackingState(TRACKING_STATE.IDLE);

      return { track, points, stats };
    } catch (err) {
      setError({ message: err.message });
      setTrackingState(TRACKING_STATE.ERROR);
      return { error: { message: err.message } };
    }
  }, [trackingState, track, points, stats, pendingPoints, accessToken]);

  /**
   * Discard tracking without saving
   */
  const discardTracking = useCallback(async () => {
    // Clear upload timer
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }

    // Delete track on server if it exists
    if (track?.id && accessToken) {
      await updateTrack(accessToken, track.id, { status: 'deleted' });
    }

    // Reset state
    setTrack(null);
    setPoints([]);
    setPendingPoints([]);
    setStats(null);
    setActivity(null);
    setError(null);
    setTrackingState(TRACKING_STATE.IDLE);
    sequenceNumRef.current = 0;
    lastPositionRef.current = null;
    activityDetectorRef.current.reset();
  }, [track?.id, accessToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uploadTimerRef.current) {
        clearInterval(uploadTimerRef.current);
      }
    };
  }, []);

  // Auto-upload when pending points reach threshold
  useEffect(() => {
    if (pendingPoints.length >= mergedOptions.maxPointsPerBatch) {
      uploadPoints();
    }
  }, [pendingPoints.length, mergedOptions.maxPointsPerBatch, uploadPoints]);

  return {
    // State
    trackingState,
    isIdle: trackingState === TRACKING_STATE.IDLE,
    isStarting: trackingState === TRACKING_STATE.STARTING,
    isRecording: trackingState === TRACKING_STATE.RECORDING,
    isPaused: trackingState === TRACKING_STATE.PAUSED,
    isStopping: trackingState === TRACKING_STATE.STOPPING,
    hasError: trackingState === TRACKING_STATE.ERROR,

    // Track data
    track,
    points,
    pendingPointsCount: pendingPoints.length,
    stats,
    activity,
    error,
    isUploading,

    // Geolocation state
    currentPosition: geo.position,
    geoError: geo.error,
    isGeoLoading: geo.isLoading,
    permissionState: geo.permissionState,
    isGeoSupported: geo.isSupported,

    // Actions
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    discardTracking,
    uploadPoints,

    // Geolocation actions
    getCurrentPosition: geo.getCurrentPosition,
  };
};

export default useTracking;
