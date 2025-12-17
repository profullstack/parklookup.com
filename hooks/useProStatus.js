/**
 * useProStatus Hook
 * Provides pro subscription status for the current user
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { isProUser } from '@/lib/subscription/pro-status';

/**
 * Hook to check if the current user has pro subscription
 * @returns {Object} Pro status state
 */
export function useProStatus() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!user || !accessToken) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data.profile);
      setError(null);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user, accessToken]);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [authLoading, fetchProfile]);

  const isPro = isProUser(profile);

  return {
    isPro,
    profile,
    loading: authLoading || loading,
    error,
    refetch: fetchProfile,
  };
}

export default useProStatus;
