/**
 * Trip Detail Page
 * View a saved trip with full details and map
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import TripDetail from '@/components/trips/TripDetail';
import TripMap from '@/components/trips/TripMap';
import Card, { CardContent } from '@/components/ui/Card';

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { session, loading: authLoading, isAuthenticated } = useAuth();
  const { isPro, loading: profileLoading } = useProfile();
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /**
   * Fetch trip data
   */
  const fetchTrip = useCallback(async () => {
    if (!session?.access_token || !id) {return;}

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/trips/${id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError({ message: 'Trip not found' });
        } else if (response.status === 401) {
          router.push(`/signin?redirect=/trip/${  id}`);
        } else {
          const data = await response.json();
          setError({ message: data.error || 'Failed to load trip' });
        }
        return;
      }

      const data = await response.json();
      setTrip(data.trip);
    } catch (err) {
      console.error('Error fetching trip:', err);
      setError({ message: 'Failed to load trip' });
    } finally {
      setLoading(false);
    }
  }, [session, id, router]);

  /**
   * Redirect to signin if not authenticated
   */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/signin?redirect=/trip/${id}`);
    }
  }, [authLoading, isAuthenticated, router, id]);

  /**
   * Fetch trip when authenticated
   */
  useEffect(() => {
    if (isAuthenticated && session?.access_token) {
      fetchTrip();
    }
  }, [isAuthenticated, session, fetchTrip]);

  /**
   * Handle regenerate trip
   */
  const handleRegenerate = useCallback(() => {
    router.push('/trip/new');
  }, [router]);

  /**
   * Handle delete trip
   */
  const handleDelete = useCallback(async () => {
    if (!session?.access_token || !id) {return;}

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/trips/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete trip');
      }

      router.push('/trips');
    } catch (err) {
      console.error('Error deleting trip:', err);
      setError({ message: err.message });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [session, id, router]);

  // Show loading while checking auth or loading profile
  if (authLoading || profileLoading || (isAuthenticated && loading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading trip...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 mb-4"
          >
            ← Back to My Trips
          </Link>
          
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">😕</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {error.message}
              </h2>
              <p className="text-gray-600 mb-4">
                The trip you're looking for might have been deleted or doesn't exist.
              </p>
              <Link
                href="/trips"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                View My Trips
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show trip not found
  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Trip not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-green-100 hover:text-white mb-2"
          >
            ← Back to My Trips
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Map */}
        {trip.stops && trip.stops.length > 0 && (
          <div className="mb-8">
            <TripMap
              stops={trip.stops}
              origin={{
                lat: trip.originLat,
                lng: trip.originLng,
              }}
              originName={trip.origin}
            />
          </div>
        )}

        {/* Trip Details */}
        <TripDetail
          trip={trip}
          onRegenerate={handleRegenerate}
          onDelete={() => setShowDeleteConfirm(true)}
          isPro={isPro}
          accessToken={session?.access_token}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Delete Trip?
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "{trip.title}"? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}