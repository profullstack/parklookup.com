/**
 * Start Tracking Button Component
 *
 * A button that allows pro users to start tracking their activity
 * at a specific park or trail. Shows upgrade prompt for non-pro users.
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTrackingContext } from '@/contexts/TrackingContext';
import UpgradeModal from '@/components/ui/UpgradeModal';

/**
 * Start Tracking Button
 * @param {Object} props
 * @param {string} [props.parkCode] - NPS park code
 * @param {string} [props.parkId] - Park ID (for local parks)
 * @param {string} [props.trailId] - Trail ID
 * @param {string} [props.parkName] - Park name for display
 * @param {string} [props.trailName] - Trail name for display
 * @param {string} [props.variant] - Button variant: 'primary', 'secondary', 'outline'
 * @param {string} [props.size] - Button size: 'sm', 'md', 'lg'
 * @param {string} [props.className] - Additional CSS classes
 */
export default function StartTrackingButton({
  parkCode,
  parkId,
  trailId,
  parkName,
  trailName,
  variant = 'primary',
  size = 'md',
  className = '',
}) {
  const { user, loading: authLoading } = useAuth();
  // Use isPro from TrackingContext to ensure consistency
  const { isTracking, startNewTrack, trackId, isPro, proLoading } = useTrackingContext();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  // Combined loading state - wait for both auth and pro status
  const isLoading = authLoading || proLoading;

  // Build the tracking URL with park/trail context
  const buildTrackingUrl = () => {
    const params = new URLSearchParams();
    params.set('tab', 'tracking');
    if (parkCode) params.set('parkCode', parkCode);
    if (parkId) params.set('parkId', parkId);
    if (trailId) params.set('trailId', trailId);
    if (parkName) params.set('parkName', parkName);
    if (trailName) params.set('trailName', trailName);
    
    return `/tracks?${params.toString()}`;
  };

  const handleClick = async () => {
    console.log('StartTrackingButton handleClick:', {
      isLoading,
      authLoading,
      proLoading,
      user: user?.id,
      isPro,
    });

    // If still loading, don't do anything
    if (isLoading) {
      console.log('StartTrackingButton: Still loading, returning');
      return;
    }

    // If not logged in, redirect to sign in
    if (!user) {
      console.log('StartTrackingButton: No user, redirecting to signin');
      window.location.href = `/signin?redirect=${encodeURIComponent(buildTrackingUrl())}`;
      return;
    }

    // If not pro, show upgrade modal
    if (!isPro) {
      console.log('StartTrackingButton: isPro is false, showing upgrade modal');
      setShowUpgradeModal(true);
      return;
    }

    // If already tracking, go to tracks page
    if (isTracking) {
      window.location.href = '/tracks';
      return;
    }

    // Start tracking with park/trail context
    setStarting(true);
    setError(null);

    try {
      await startNewTrack({
        title: trailName || parkName || 'New Track',
        parkCode,
        parkId,
        trailId,
      });
      
      // Navigate to tracks page
      window.location.href = '/tracks';
    } catch (err) {
      console.error('Failed to start tracking:', err);
      setError(err.message);
      setStarting(false);
    }
  };

  // Variant styles
  const variantStyles = {
    primary: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
    outline: 'border-2 border-green-600 text-green-600 hover:bg-green-50 focus:ring-green-500 dark:hover:bg-green-900/20',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const buttonClasses = `
    inline-flex items-center justify-center gap-2 
    font-medium rounded-lg 
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${className}
  `.trim();

  // Show loading state - wait for both auth and pro status to load
  if (isLoading) {
    return (
      <button className={buttonClasses} disabled>
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        Loading...
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={starting}
        className={buttonClasses}
        title={isTracking ? 'Continue tracking' : 'Start tracking your activity'}
      >
        {starting ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Starting...
          </>
        ) : isTracking ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Continue Tracking
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Start Tracking
            {!isPro && user && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full ml-1">PRO</span>
            )}
          </>
        )}
      </button>

      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}

      {/* Upgrade Modal for non-pro users */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="Trip Tracking"
        description="Track your hikes, bike rides, and drives in real-time. Save your routes, share them with friends, and see detailed statistics about your adventures."
      />
    </>
  );
}
