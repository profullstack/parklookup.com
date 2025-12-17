'use client';

import { useState, useCallback } from 'react';
import { useTrackingContext } from '@/contexts/TrackingContext';
import { getActivityIcon } from '@/lib/tracking/activity-detection';
import { formatDistance, formatDuration, formatSpeed } from '@/lib/tracking/track-stats';

/**
 * Tracking Controls Component
 * Provides UI controls for starting, pausing, resuming, and stopping track recording
 */
export default function TrackingControls({
  parkCode,
  parkId,
  trailId,
  localParkId,
  parkName,
  trailName,
  onTrackComplete,
  className = '',
}) {
  const {
    isTracking,
    isPaused,
    status,
    trackId,
    points,
    stats,
    error,
    currentPosition,
    detectedActivity,
    canTrack,
    startNewTrack,
    stopCurrentTrack,
    pauseCurrentTrack,
    resumeCurrentTrack,
    discardCurrentTrack,
  } = useTrackingContext();

  const [activityType, setActivityType] = useState('hiking');
  const [title, setTitle] = useState('');
  const [showStartForm, setShowStartForm] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  /**
   * Handle start tracking
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setLocalError(null);

    try {
      await startNewTrack({
        title: title || `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} at ${parkName || trailName || 'Park'}`,
        activityType,
        parkCode,
        parkId,
        trailId,
        localParkId,
      });
      setShowStartForm(false);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [startNewTrack, title, activityType, parkCode, parkId, trailId, localParkId, parkName, trailName]);

  /**
   * Handle stop tracking
   */
  const handleStop = useCallback(async () => {
    setIsLoading(true);
    setLocalError(null);

    try {
      const result = await stopCurrentTrack();
      if (result?.track && onTrackComplete) {
        onTrackComplete(result.track);
      }
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [stopCurrentTrack, onTrackComplete]);

  /**
   * Handle pause tracking
   */
  const handlePause = useCallback(async () => {
    setIsLoading(true);
    try {
      await pauseCurrentTrack();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [pauseCurrentTrack]);

  /**
   * Handle resume tracking
   */
  const handleResume = useCallback(async () => {
    setIsLoading(true);
    try {
      await resumeCurrentTrack();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [resumeCurrentTrack]);

  /**
   * Handle discard tracking
   */
  const handleDiscard = useCallback(async () => {
    setIsLoading(true);
    try {
      await discardCurrentTrack();
      setShowConfirmDiscard(false);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [discardCurrentTrack]);

  // Activity type options
  const activityOptions = [
    { value: 'walking', label: 'Walking', icon: '🚶' },
    { value: 'hiking', label: 'Hiking', icon: '🥾' },
    { value: 'biking', label: 'Biking', icon: '🚴' },
    { value: 'driving', label: 'Driving', icon: '🚗' },
  ];

  // If user can't track, show upgrade prompt
  if (!canTrack) {
    return (
      <div className={`bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">Track Your Adventure</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Upgrade to Pro to record your hikes, bike rides, and drives with GPS tracking.
            </p>
          </div>
          <a
            href="/payments"
            className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
          >
            Upgrade
          </a>
        </div>
      </div>
    );
  }

  // Start form
  if (showStartForm && !isTracking) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg ${className}`}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Start Tracking</h3>

        {/* Activity Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Activity Type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {activityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setActivityType(option.value)}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                  activityType === option.value
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="text-2xl mb-1">{option.icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${activityType.charAt(0).toUpperCase() + activityType.slice(1)} at ${parkName || trailName || 'Park'}`}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Error Message */}
        {(localError || error) && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{localError || error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Starting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Tracking
              </>
            )}
          </button>
          <button
            onClick={() => setShowStartForm(false)}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Active tracking controls
  if (isTracking) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden ${className}`}>
        {/* Status Bar */}
        <div className={`px-4 py-2 flex items-center justify-between ${isPaused ? 'bg-amber-500' : 'bg-green-500'}`}>
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">{getActivityIcon(detectedActivity || activityType)}</span>
            <span className="font-medium capitalize">{detectedActivity || activityType}</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            {isPaused ? (
              <span className="text-sm font-medium">PAUSED</span>
            ) : (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <span className="text-sm font-medium">RECORDING</span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Distance */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.distance_meters ? formatDistance(stats.distance_meters) : '0 m'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
            </div>

            {/* Duration */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.duration_seconds ? formatDuration(stats.duration_seconds) : '0:00'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
            </div>

            {/* Speed */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentPosition?.speed ? formatSpeed(currentPosition.speed) : '0 km/h'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Speed</p>
            </div>
          </div>

          {/* Points count */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            {points.length} GPS points recorded
          </div>

          {/* Error Message */}
          {(localError || error) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{localError || error}</p>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-3">
            {/* Pause/Resume Button */}
            {isPaused ? (
              <button
                onClick={handleResume}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pause
              </button>
            )}

            {/* Stop Button */}
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
              Stop
            </button>
          </div>

          {/* Discard Button */}
          <button
            onClick={() => setShowConfirmDiscard(true)}
            disabled={isLoading}
            className="w-full mt-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-sm font-medium transition-colors"
          >
            Discard Track
          </button>
        </div>

        {/* Confirm Discard Modal */}
        {showConfirmDiscard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Discard Track?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This will permanently delete all recorded data for this track. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDiscard}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {isLoading ? 'Discarding...' : 'Discard'}
                </button>
                <button
                  onClick={() => setShowConfirmDiscard(false)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: Start button
  return (
    <button
      onClick={() => setShowStartForm(true)}
      className={`w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${className}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Start Tracking
    </button>
  );
}
