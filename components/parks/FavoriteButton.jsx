/**
 * FavoriteButton Component
 * Toggle favorite status for a park
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function FavoriteButton({ parkId, parkCode, size = 'md' }) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      // Only check if we have user and parkId
      if (!user || !parkId) {
        return;
      }

      // Get token from localStorage
      const token = localStorage.getItem('parklookup_auth_token');
      if (!token) {
        return;
      }

      try {
        const response = await fetch(`/api/favorites?parkId=${parkId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          // Use park_id which is the unified ID returned by the API for all park types
          setIsFavorite(data.favorites?.some((f) => f.park_id === parkId));
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavoriteStatus();
  }, [user, parkId]);

  const toggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      // Redirect to login or show login modal
      window.location.href = '/signin';
      return;
    }

    // Get token from localStorage
    const token = localStorage.getItem('parklookup_auth_token');
    if (!token) {
      window.location.href = '/signin';
      return;
    }

    setLoading(true);

    try {
      const authHeaders = {
        Authorization: `Bearer ${token}`,
      };

      if (isFavorite) {
        // Remove from favorites
        const response = await fetch(`/api/favorites/${parkId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (response.ok) {
          setIsFavorite(false);
        }
      } else {
        // Add to favorites
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ parkId }),
        });
        if (response.ok) {
          setIsFavorite(true);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={`
        p-2 rounded-full transition-colors duration-200
        ${isFavorite ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
      `}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        className={sizes[size]}
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}

export default FavoriteButton;