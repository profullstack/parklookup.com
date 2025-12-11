/**
 * Trips List Page
 * Display all user trips with empty state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import TripCard, { TripCardSkeleton } from '@/components/trips/TripCard';
import Button from '@/components/ui/Button';

/**
 * Handle upgrade to Pro - redirect to Stripe checkout
 */
const handleUpgrade = async (session, setError) => {
  if (!session?.access_token) {
    window.location.href = '/signin?redirect=/trips';
    return;
  }

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to start checkout');
    }

    const { url } = await response.json();
    if (url) {
      window.location.href = url;
    }
  } catch (err) {
    console.error('Checkout error:', err);
    setError(err.message);
  }
};

export default function TripsPage() {
  const router = useRouter();
  const { session, loading: authLoading, isAuthenticated } = useAuth();
  
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  /**
   * Fetch user trips
   */
  const fetchTrips = useCallback(async () => {
    if (!session?.access_token) {return;}

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/trips', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/signin?redirect=/trips');
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to load trips');
      }

      const data = await response.json();
      setTrips(data.trips || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, router]);

  /**
   * Redirect to signin if not authenticated
   */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/signin?redirect=/trips');
    }
  }, [authLoading, isAuthenticated, router]);

  /**
   * Fetch trips when authenticated
   */
  useEffect(() => {
    if (isAuthenticated && session?.access_token) {
      fetchTrips();
    }
  }, [isAuthenticated, session, fetchTrips]);

  /**
   * Handle delete trip
   */
  const handleDeleteTrip = useCallback(async (tripId) => {
    if (!session?.access_token) {return;}

    if (!confirm('Are you sure you want to delete this trip?')) {
      return;
    }

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete trip');
      }

      // Remove from local state
      setTrips(prev => prev.filter(t => t.id !== tripId));
    } catch (err) {
      console.error('Error deleting trip:', err);
      alert(err.message);
    }
  }, [session]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">🧭 My Trips</h1>
              <p className="mt-1 text-green-100">
                Your AI-generated park itineraries
              </p>
            </div>
            <Link href="/trip/new">
              <Button className="bg-white text-green-700 hover:bg-green-50">
                + Create New Trip
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-red-500">❌</span>
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={fetchTrips}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && trips.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-5xl">🏕️</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No trips yet
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first AI-powered trip itinerary and start exploring national parks!
            </p>
            <Link href="/trip/new">
              <Button>
                🧭 Create Your First Trip
              </Button>
            </Link>

            {/* Features */}
            <div className="mt-12 grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl">🤖</span>
                </div>
                <h3 className="font-medium text-gray-900">AI-Powered</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Get personalized itineraries based on your interests
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl">📍</span>
                </div>
                <h3 className="font-medium text-gray-900">Location-Based</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Find parks near your starting location
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl">📋</span>
                </div>
                <h3 className="font-medium text-gray-900">Complete Plans</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Day-by-day schedules with packing lists
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Trips Grid */}
        {!loading && trips.length > 0 && (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onDelete={handleDeleteTrip}
                />
              ))}
            </div>

            {/* Pagination Info */}
            {pagination && (
              <div className="mt-8 text-center text-sm text-gray-500">
                Showing {trips.length} of {pagination.total} trip{pagination.total !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}

        {/* Free Tier Notice */}
        {!loading && trips.length > 0 && trips.length >= 1 && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <span className="text-3xl">💡</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900">
                  Want to create more trips?
                </h3>
                <p className="text-sm text-green-700">
                  Upgrade to Pro for unlimited trip creation and premium features
                </p>
              </div>
              <Button
                className="flex-shrink-0 bg-green-600 hover:bg-green-700"
                onClick={() => handleUpgrade(session, setError)}
              >
                Upgrade
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}