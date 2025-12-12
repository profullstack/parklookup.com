/**
 * useProfile Hook
 * Fetches and manages user profile data including pro status
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { isProUser } from '@/lib/subscription/pro-status';

/**
 * Hook to fetch and manage user profile
 * @returns {Object} Profile state and methods
 */
export function useProfile() {
  const { session, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch user profile from API
   */
  const fetchProfile = useCallback(async () => {
    if (!session?.access_token) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data.profile);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  /**
   * Fetch profile when authenticated
   */
  useEffect(() => {
    if (isAuthenticated && session?.access_token) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [isAuthenticated, session, fetchProfile]);

  /**
   * Check if user is a pro subscriber
   * Uses centralized pro status utility
   */
  const isPro = isProUser(profile);

  /**
   * Refresh profile data
   */
  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    isPro,
    refreshProfile,
  };
}

export default useProfile;