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
  const { isPro, loading: proLoading, profile, refetch: refetchProStatus } = useProStatus();
  const [activeTrackConfig, setActiveTrackConfig] = useState(null);
  const [showTrackingPanel, setShowTrackingPanel] = useState(false);

  // Use refs to track current values for async operations
  const proLoadingRef = useRef(proLoading);
  const isProRef = useRef(isPro);
  const profileRef = useRef(profile);

  // Keep refs in sync with state
  useEffect(() => {
    proLoadingRef.current = proLoading;
    isProRef.current = isPro;
    profileRef.current = profile;
  }, [proLoading, isPro, profile]);

  // Debug logging for pro status (using console.warn to avoid production stripping)
  if (typeof window !== 'undefined') {
    console.warn('[TrackingProvider] render:', {
      user: user?.id,
      isPro,
      proLoading,
      profile: profile ? {
        is_pro: profile.is_pro,
        subscription_status: profile.subscription_status,
        subscription_tier: profile.subscription_tier,
      } : null,
    });
  }

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
        isPro: isProRef.current,
        proLoading: proLoadingRef.current,
        profile: profileRef.current ? {
          is_pro: profileRef.current.is_pro,
          subscription_status: profileRef.current.subscription_status,
          subscription_tier: profileRef.current.subscription_tier,
        } : null,
        config,
      });

      if (!user) {
        throw new Error('You must be signed in to track');
      }

      // If pro status is still loading, wait for it with a timeout using refs
      if (proLoadingRef.current) {
        console.log('TrackingContext: Pro status still loading, waiting...');
        // Try to refetch pro status first
        if (refetchProStatus) {
          try {
            await refetchProStatus();
          } catch (err) {
            console.warn('TrackingContext: Failed to refetch pro status:', err);
          }
        }
        
        // Wait up to 5 seconds for pro status to load (checking ref)
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5 seconds
        while (proLoadingRef.current && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        console.log('TrackingContext: Done waiting for pro status, proLoading:', proLoadingRef.current, 'isPro:', isProRef.current);
      }

      // Check pro status using refs for current values
      const currentProfile = profileRef.current;
      const isUserPro = isProRef.current || currentProfile?.is_pro || currentProfile?.subscription_status === 'active';
      if (!isUserPro) {
        console.log('TrackingContext: User is not pro, throwing error. Profile:', currentProfile);
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
    [user, refetchProStatus, tracking]
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
    isTracking: tracking.isRecording,
    isPaused: tracking.isPaused,
    status: tracking.trackingState,
    trackId: tracking.track?.id,
    points: tracking.points,
    stats: tracking.stats,
    error: tracking.error,
    currentPosition: tracking.currentPosition,
    detectedActivity: tracking.activity,
    activeTrackConfig,
    showTrackingPanel,
    canTrack,
    isPro,
    proLoading,
    pendingPointsCount: tracking.pendingPointsCount,
    isUploading: tracking.isUploading,

    // Recovery state
    hasRecoverableSession: tracking.hasRecoverableSession,
    recoverableSessionInfo: tracking.recoverableSessionInfo,

    // Actions
    startNewTrack,
    stopCurrentTrack,
    pauseCurrentTrack,
    resumeCurrentTrack,
    discardCurrentTrack,
    toggleTrackingPanel,
    setShowTrackingPanel,

    // Recovery actions
    recoverSession: tracking.recoverSession,
    dismissRecoverableSession: tracking.dismissRecoverableSession,
    checkRecoverableSession: tracking.checkRecoverableSession,
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
