'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProStatus } from '@/hooks/useProStatus';
import { useTracking } from '@/hooks/useTracking';

/**
 * Tracking Context
 * Provides global tracking state and controls across the application
 */
const TrackingContext = createContext(null);

/**
 * Tracking Provider Component
 * Wraps the application to provide tracking functionality
 */
export function TrackingProvider({ children }) {
  const { user, accessToken } = useAuth();
  const { isPro, loading: proLoading, profile } = useProStatus();
  const [activeTrackConfig, setActiveTrackConfig] = useState(null);
  const [showTrackingPanel, setShowTrackingPanel] = useState(false);

  // Debug logging for pro status
  console.log('TrackingProvider render:', {
    user: user?.id,
    isPro,
    proLoading,
    profile: profile ? {
      is_pro: profile.is_pro,
      subscription_status: profile.subscription_status,
      subscription_tier: profile.subscription_tier,
    } : null,
  });

  // Use the tracking hook
  const tracking = useTracking({
    accessToken,
    enabled: !!activeTrackConfig,
    ...activeTrackConfig,
  });

  /**
   * Start a new tracking session
   * @param {Object} config - Track configuration
   * @param {string} [config.title] - Track title
   * @param {string} [config.activityType] - Activity type (walking, hiking, biking, driving)
   * @param {string} [config.parkCode] - NPS park code
   * @param {string} [config.parkId] - NPS park ID
   * @param {string} [config.trailId] - Trail ID
   * @param {string} [config.localParkId] - Local park ID
   */
  const startNewTrack = useCallback(
    async (config) => {
      console.log('TrackingContext.startNewTrack called:', {
        user: user?.id,
        isPro,
        proLoading,
        config,
      });

      if (!user) {
        throw new Error('You must be signed in to track');
      }

      if (!isPro) {
        console.log('TrackingContext: isPro is false, throwing error');
        throw new Error('Trip tracking is a Pro feature');
      }

      // Validate that at least one association is provided
      if (!config.parkCode && !config.parkId && !config.trailId && !config.localParkId) {
        throw new Error('Track must be associated with a park or trail');
      }

      setActiveTrackConfig(config);
      setShowTrackingPanel(true);

      // The useTracking hook will automatically start when enabled
      return tracking.startTracking(config);
    },
    [user, isPro, tracking]
  );

  /**
   * Stop the current tracking session
   */
  const stopCurrentTrack = useCallback(async () => {
    const result = await tracking.stopTracking();
    setActiveTrackConfig(null);
    return result;
  }, [tracking]);

  /**
   * Pause the current tracking session
   */
  const pauseCurrentTrack = useCallback(async () => {
    return tracking.pauseTracking();
  }, [tracking]);

  /**
   * Resume the current tracking session
   */
  const resumeCurrentTrack = useCallback(async () => {
    return tracking.resumeTracking();
  }, [tracking]);

  /**
   * Discard the current tracking session
   */
  const discardCurrentTrack = useCallback(async () => {
    await tracking.discardTracking();
    setActiveTrackConfig(null);
    setShowTrackingPanel(false);
  }, [tracking]);

  /**
   * Toggle the tracking panel visibility
   */
  const toggleTrackingPanel = useCallback(() => {
    setShowTrackingPanel((prev) => !prev);
  }, []);

  /**
   * Check if user can start tracking
   */
  const canTrack = user && isPro && !proLoading;

  const value = {
    // State
    isTracking: tracking.isTracking,
    isPaused: tracking.isPaused,
    status: tracking.status,
    trackId: tracking.trackId,
    points: tracking.points,
    stats: tracking.stats,
    error: tracking.error,
    currentPosition: tracking.currentPosition,
    detectedActivity: tracking.detectedActivity,
    activeTrackConfig,
    showTrackingPanel,
    canTrack,
    isPro,
    proLoading,

    // Actions
    startNewTrack,
    stopCurrentTrack,
    pauseCurrentTrack,
    resumeCurrentTrack,
    discardCurrentTrack,
    toggleTrackingPanel,
    setShowTrackingPanel,
  };

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

/**
 * Hook to access tracking context
 * @returns {Object} Tracking context value
 */
export function useTrackingContext() {
  const context = useContext(TrackingContext);

  if (!context) {
    throw new Error('useTrackingContext must be used within a TrackingProvider');
  }

  return context;
}

export default TrackingContext;
