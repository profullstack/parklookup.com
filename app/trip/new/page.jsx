/**
 * New Trip Page
 * Trip creation with AI generation and streaming progress
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import useTripStream from '@/hooks/useTripStream';
import TripForm from '@/components/trips/TripForm';
import TripGenerationProgress from '@/components/trips/TripGenerationProgress';
import UpgradeModal from '@/components/ui/UpgradeModal';
import Card, { CardContent } from '@/components/ui/Card';

export default function NewTripPage() {
  const router = useRouter();
  const { user, session, loading: authLoading, isAuthenticated } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const {
    status,
    progress,
    completedDays,
    error,
    tripId,
    location,
    parkCount,
    isIdle,
    isLoading,
    isComplete,
    isError,
    isFreeTierLimit,
    generateTrip,
    reset,
    cancel,
  } = useTripStream();

  /**
   * Redirect to signin if not authenticated
   */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/signin?redirect=/trip/new');
    }
  }, [authLoading, isAuthenticated, router]);

  /**
   * Redirect to trip page on completion
   */
  useEffect(() => {
    if (isComplete && tripId) {
      const timer = setTimeout(() => {
        router.push(`/trip/${tripId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, tripId, router]);

  /**
   * Show upgrade modal on free tier limit
   */
  useEffect(() => {
    if (isFreeTierLimit) {
      setShowUpgradeModal(true);
    }
  }, [isFreeTierLimit]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (formData) => {
    if (!session?.access_token) {
      router.push('/signin?redirect=/trip/new');
      return;
    }

    await generateTrip(formData, session.access_token);
  }, [session, generateTrip, router]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  /**
   * Handle try again
   */
  const handleTryAgain = useCallback(() => {
    reset();
  }, [reset]);

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
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-green-100 hover:text-white mb-4"
          >
            ← Back to My Trips
          </Link>
          <h1 className="text-3xl font-bold">🧭 Create AI Trip</h1>
          <p className="mt-2 text-green-100">
            Let AI plan your perfect national park adventure
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Show form when idle or on error (non-free-tier) */}
        {(isIdle || (isError && !isFreeTierLimit)) && (
          <Card>
            <CardContent className="p-6">
              {/* Error message */}
              {isError && !isFreeTierLimit && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">❌</span>
                    <div>
                      <p className="font-medium text-red-900">
                        {error?.message || 'Something went wrong'}
                      </p>
                      {error?.details && (
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                          {error.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={handleTryAgain}
                        className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Form */}
              <TripForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
                disabled={isLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* Show progress during generation */}
        {isLoading && (
          <Card>
            <CardContent className="p-6">
              <TripGenerationProgress
                status={status}
                progress={progress}
                completedDays={completedDays}
                location={location}
                parkCount={parkCount}
                onCancel={handleCancel}
              />
            </CardContent>
          </Card>
        )}

        {/* Show success message */}
        {isComplete && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Trip Created!
              </h2>
              <p className="text-gray-600 mb-4">
                Redirecting to your trip...
              </p>
              <div className="animate-pulse">
                <div className="h-2 bg-green-200 rounded-full w-32 mx-auto" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips section */}
        {isIdle && (
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <span className="text-2xl">💡</span>
              <h3 className="font-medium text-gray-900 mt-2">Be Specific</h3>
              <p className="text-sm text-gray-600 mt-1">
                Enter a specific city or zip code for better park recommendations
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <span className="text-2xl">🎯</span>
              <h3 className="font-medium text-gray-900 mt-2">Choose Interests</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select activities you enjoy for a personalized itinerary
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <span className="text-2xl">📏</span>
              <h3 className="font-medium text-gray-900 mt-2">Adjust Radius</h3>
              <p className="text-sm text-gray-600 mt-1">
                Increase the radius to discover more parks in your region
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          reset();
        }}
        title="Upgrade to Create More Trips"
        message="You've already created your free trip! Upgrade to Pro for unlimited trip creation and premium features."
      />
    </div>
  );
}