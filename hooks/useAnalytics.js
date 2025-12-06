'use client';

/**
 * Datafast Analytics Hook
 * Provides methods for tracking custom events and goals
 */

import { useCallback } from 'react';

/**
 * Track a custom event with Datafast
 * @param {string} eventName - The name of the event to track
 * @param {Object} properties - Optional properties to include with the event
 */
export const trackEvent = (eventName, properties = {}) => {
  if (typeof window !== 'undefined' && window.datafast) {
    window.datafast(eventName, properties);
  }
};

/**
 * Custom hook for analytics tracking
 * @returns {Object} Analytics methods
 */
export const useAnalytics = () => {
  /**
   * Track a page view
   * @param {string} pageName - Name of the page
   * @param {Object} properties - Additional properties
   */
  const trackPageView = useCallback((pageName, properties = {}) => {
    trackEvent('page_view', { page: pageName, ...properties });
  }, []);

  /**
   * Track a park view
   * @param {Object} park - Park data
   */
  const trackParkView = useCallback((park) => {
    trackEvent('park_view', {
      park_code: park.park_code,
      park_name: park.full_name,
      state: park.states,
    });
  }, []);

  /**
   * Track a search
   * @param {string} query - Search query
   * @param {number} resultsCount - Number of results
   */
  const trackSearch = useCallback((query, resultsCount) => {
    trackEvent('search', {
      query,
      results_count: resultsCount,
    });
  }, []);

  /**
   * Track adding a favorite
   * @param {Object} park - Park data
   */
  const trackAddFavorite = useCallback((park) => {
    trackEvent('add_favorite', {
      park_code: park.park_code,
      park_name: park.full_name,
    });
  }, []);

  /**
   * Track removing a favorite
   * @param {Object} park - Park data
   */
  const trackRemoveFavorite = useCallback((park) => {
    trackEvent('remove_favorite', {
      park_code: park.park_code,
      park_name: park.full_name,
    });
  }, []);

  /**
   * Track user sign up
   * @param {Object} user - User data
   */
  const trackSignUp = useCallback((user) => {
    trackEvent('sign_up', {
      email: user.email,
    });
  }, []);

  /**
   * Track user sign in
   * @param {Object} user - User data
   */
  const trackSignIn = useCallback((user) => {
    trackEvent('sign_in', {
      email: user.email,
    });
  }, []);

  /**
   * Track nearby parks search
   * @param {Object} location - Location data
   * @param {number} resultsCount - Number of results
   */
  const trackNearbySearch = useCallback((location, resultsCount) => {
    trackEvent('nearby_search', {
      latitude: location.lat,
      longitude: location.lng,
      results_count: resultsCount,
    });
  }, []);

  /**
   * Track a custom goal/conversion
   * @param {string} goalName - Name of the goal
   * @param {Object} properties - Goal properties
   */
  const trackGoal = useCallback((goalName, properties = {}) => {
    trackEvent(goalName, properties);
  }, []);

  return {
    trackPageView,
    trackParkView,
    trackSearch,
    trackAddFavorite,
    trackRemoveFavorite,
    trackSignUp,
    trackSignIn,
    trackNearbySearch,
    trackGoal,
    trackEvent,
  };
};

export default useAnalytics;