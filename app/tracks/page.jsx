'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProStatus } from '@/hooks/useProStatus';
import { useTrackingContext } from '@/contexts/TrackingContext';
import { getTracks, deleteTrack } from '@/lib/tracking/tracking-client';
import TrackCard from '@/components/tracking/TrackCard';
import LiveTrackMap from '@/components/tracking/LiveTrackMap';
import Link from 'next/link';

/**
 * Tab configuration for tracks page
 */
const TABS = [
  { id: 'my-tracks', label: 'My Tracks' },
  { id: 'tracking', label: 'Tracking' },
];

/**
 * Inner component that uses useSearchParams
 */
function TracksPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, accessToken, loading: authLoading } = useAuth();
  const { isPro, loading: proLoading } = useProStatus();
  const {
    isTracking,
    isPaused,
    status,
    trackId,
    points,
    stats,
    error: trackingError,
    currentPosition,
    detectedActivity,
    startNewTrack,
    stopCurrentTrack,
    pauseCurrentTrack,
    resumeCurrentTrack,
    discardCurrentTrack,
    hasRecoverableSession,
    recoverableSessionInfo,
    recoverSession,
    dismissRecoverableSession,
  } = useTrackingContext();

  // Get active tab from URL or default based on tracking state
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || (isTracking ? 'tracking' : 'my-tracks'));

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState(null);
  const [filter, setFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [startingTrack, setStartingTrack] = useState(false);
  const [startError, setStartError] = useState(null);

  // Get URL params for starting a new track
  const parkCode = searchParams.get('parkCode');
  const parkId = searchParams.get('parkId');
  const localParkId = searchParams.get('localParkId');
  const trailId = searchParams.get('trailId');
  const parkName = searchParams.get('parkName');
  const trailName = searchParams.get('trailName');
  const autoStart = searchParams.get('start') === 'true';

  // Handle starting a new track - defined before useEffect that uses it
  const handleStartTracking = useCallback(async () => {
    if (!user || !isPro || isTracking || startingTrack) return;

    setStartingTrack(true);
    setStartError(null);

    try {
      await startNewTrack({
        title: trailName || parkName || 'New Track',
        parkCode,
        parkId,
        localParkId,
        trailId,
      });
      setActiveTab('tracking');
    } catch (err) {
      console.error('Failed to start tracking:', err);
      setStartError(err.message);
    } finally {
      setStartingTrack(false);
    }
  }, [user, isPro, isTracking, startingTrack, startNewTrack, trailName, parkName, parkCode, parkId, localParkId, trailId]);

  // Update active tab when tracking state changes
  useEffect(() => {
    if (isTracking && activeTab !== 'tracking') {
      setActiveTab('tracking');
    }
  }, [isTracking, activeTab]);

  // Auto-start tracking if URL params indicate it
  useEffect(() => {
    const shouldAutoStart = autoStart && isPro && user && !isTracking && !startingTrack;
    const hasContext = parkCode || parkId || localParkId || trailId;

    console.log('Auto-start check:', {
      autoStart,
      isPro,
      user: user?.id,
      isTracking,
      startingTrack,
      hasContext,
      shouldAutoStart,
    });

    if (shouldAutoStart && hasContext) {
      console.log('Auto-starting tracking with context:', { parkCode, parkId, localParkId, trailId, parkName, trailName });
      handleStartTracking();
    }
  }, [autoStart, isPro, user, isTracking, startingTrack, parkCode, parkId, localParkId, trailId, parkName, trailName, handleStartTracking]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    // Update URL without full page reload
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`/tracks?${params.toString()}`, { scroll: false });
  };

  // Handle stopping the track
  const handleStopTracking = async () => {
    try {
      await stopCurrentTrack();
      // Refresh tracks list and switch to my-tracks tab
      fetchTracks();
      setActiveTab('my-tracks');
    } catch (err) {
      console.error('Failed to stop tracking:', err);
    }
  };

  // Handle discarding the track
  const handleDiscardTracking = async () => {
    if (!confirm('Are you sure you want to discard this track? All recorded data will be lost.')) {
      return;
    }
    try {
      await discardCurrentTrack();
      setActiveTab('my-tracks');
    } catch (err) {
      console.error('Failed to discard tracking:', err);
    }
  };

  // Handle recovering a session
  const handleRecoverSession = async () => {
    setRecovering(true);
    setRecoveryResult(null);
    try {
      const result = await recoverSession();
      if (result.error) {
        setRecoveryResult({ success: false, message: result.error.message });
      } else {
        setRecoveryResult({
          success: true,
          message: `Recovered ${result.recoveredPoints} points from your previous session.`,
        });
        // Refresh tracks list
        fetchTracks();
      }
    } catch (err) {
      setRecoveryResult({ success: false, message: err.message });
    } finally {
      setRecovering(false);
    }
  };

  // Handle dismissing recoverable session
  const handleDismissRecovery = () => {
    if (confirm('Are you sure? Any unsaved tracking data will be lost.')) {
      dismissRecoverableSession();
      setRecoveryResult(null);
    }
  };

  // Fetch tracks
  const fetchTracks = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const options = {
        limit: pagination.limit,
        offset: pagination.offset,
        sortBy,
        sortOrder,
      };

      if (filter !== 'all') {
        options.status = filter;
      }

      if (activityFilter !== 'all') {
        options.activityType = activityFilter;
      }

      const result = await getTracks(accessToken, options);

      if (result.error) {
        setError(result.error.message || 'Failed to load tracks');
      } else {
        setTracks(result.tracks || []);
        if (result.pagination) {
          setPagination((prev) => ({ ...prev, total: result.pagination.total }));
        }
      }
    } catch (err) {
      setError('Failed to load tracks');
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter, activityFilter, sortBy, sortOrder, pagination.limit, pagination.offset]);

  useEffect(() => {
    if (accessToken && isPro && activeTab === 'my-tracks') {
      fetchTracks();
    }
  }, [fetchTracks, accessToken, isPro, activeTab]);

  // Handle delete track
  const handleDelete = async (trackIdToDelete) => {
    if (!confirm('Are you sure you want to delete this track?')) return;

    try {
      const result = await deleteTrack(accessToken, trackIdToDelete);
      if (result.error) {
        alert(result.error.message || 'Failed to delete track');
      } else {
        setTracks((prev) => prev.filter((t) => t.id !== trackIdToDelete));
      }
    } catch (err) {
      alert('Failed to delete track');
    }
  };

  // Handle pagination
  const handleNextPage = () => {
    setPagination((prev) => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  };

  const handlePrevPage = () => {
    setPagination((prev) => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format distance
  const formatDistance = (meters) => {
    if (!meters) return '0 m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  // Show loading state while checking auth and pro status
  const isInitialLoading = authLoading || proLoading;

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tracks</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Sign in to view and manage your recorded tracks
            </p>
            <Link
              href="/signin"
              className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not pro user
  if (user && !isPro) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pro Feature</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Track recording is a Pro feature. Upgrade to record your hikes, bike rides, and drives
              with GPS tracking.
            </p>
            <Link
              href="/payments"
              className="inline-flex items-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Live Tracking Banner - shown when tracking is active */}
      {isTracking && activeTab !== 'tracking' && (
        <div
          className="bg-green-600 text-white cursor-pointer hover:bg-green-700 transition-colors"
          onClick={() => setActiveTab('tracking')}
        >
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Recording Track</span>
                {detectedActivity && (
                  <span className="text-green-200 text-sm capitalize">({detectedActivity})</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>{formatDuration(stats?.duration || 0)}</span>
                <span>{formatDistance(stats?.distance || 0)}</span>
                <span className="underline">View →</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tracks</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.id === 'tracking' && isTracking && (
                <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse"></span>
              )}
            </button>
          ))}
        </div>

        {/* Start Error */}
        {startError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{startError}</p>
          </div>
        )}

        {/* Tracking Error */}
        {trackingError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">
              {typeof trackingError === 'string' ? trackingError : trackingError?.message || 'An error occurred'}
            </p>
          </div>
        )}

        {/* Session Recovery Banner */}
        {hasRecoverableSession && !isTracking && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-6 h-6 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Recoverable Tracking Session Found
                </h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  {recoverableSessionInfo ? (
                    <>
                      Found {recoverableSessionInfo.pointCount} points from a previous session
                      {recoverableSessionInfo.title && ` "${recoverableSessionInfo.title}"`}
                      {recoverableSessionInfo.lastUpdated && (
                        <> (last updated {new Date(recoverableSessionInfo.lastUpdated).toLocaleString()})</>
                      )}
                    </>
                  ) : (
                    'A previous tracking session was interrupted. Would you like to recover it?'
                  )}
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handleRecoverSession}
                    disabled={recovering}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    {recovering ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Recovering...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Recover Session
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDismissRecovery}
                    disabled={recovering}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 text-sm rounded-lg font-medium transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Result */}
        {recoveryResult && (
          <div
            className={`rounded-lg p-4 mb-6 ${
              recoveryResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {recoveryResult.success ? (
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <p
                className={
                  recoveryResult.success
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                {recoveryResult.message}
              </p>
              <button
                onClick={() => setRecoveryResult(null)}
                className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Tracking Tab */}
        {activeTab === 'tracking' && (
          <div className="space-y-6">
            {isTracking ? (
              <>
                {/* Live Map */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                  <div className="h-[400px] md:h-[500px]">
                    <LiveTrackMap
                      points={points}
                      currentPosition={currentPosition}
                      isTracking={isTracking}
                      isPaused={isPaused}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Duration</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatDuration(stats?.duration || 0)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Distance</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatDistance(stats?.distance || 0)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Avg Speed</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.avgSpeed ? `${stats.avgSpeed.toFixed(1)} km/h` : '0 km/h'}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Elevation Gain</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.elevationGain ? `${Math.round(stats.elevationGain)} m` : '0 m'}
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {isPaused ? (
                      <button
                        onClick={resumeCurrentTrack}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={pauseCurrentTrack}
                        className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                        Pause
                      </button>
                    )}

                    <button
                      onClick={handleStopTracking}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z" />
                      </svg>
                      Stop & Save
                    </button>

                    <button
                      onClick={handleDiscardTracking}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Discard
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Not tracking - show start tracking UI */
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                <svg
                  className="w-16 h-16 mx-auto text-green-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {parkName || trailName ? `Track at ${trailName || parkName}` : 'Start a New Track'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  {parkCode || parkId || localParkId || trailId
                    ? 'Click the button below to start recording your activity with GPS tracking.'
                    : 'Go to a park or trail page and click "Start Tracking" to begin recording your activity.'}
                </p>

                {(parkCode || parkId || localParkId || trailId) ? (
                  <button
                    onClick={handleStartTracking}
                    disabled={startingTrack}
                    className="px-8 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-lg flex items-center gap-3 mx-auto"
                  >
                    {startingTrack ? (
                      <>
                        <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Starting...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Start Tracking
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href="/parks"
                    className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Explore Parks
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* My Tracks Tab */}
        {activeTab === 'my-tracks' && (
          <>
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-sm">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="shared">Shared</option>
                    <option value="recording">Recording</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Activity
                  </label>
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="walking">Walking</option>
                    <option value="hiking">Hiking</option>
                    <option value="biking">Biking</option>
                    <option value="driving">Driving</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sort By
                  </label>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortBy(field);
                      setSortOrder(order);
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="created_at-desc">Newest First</option>
                    <option value="created_at-asc">Oldest First</option>
                    <option value="distance_meters-desc">Longest Distance</option>
                    <option value="duration_seconds-desc">Longest Duration</option>
                    <option value="elevation_gain_m-desc">Most Elevation</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading tracks...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={fetchTracks}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Tracks List */}
            {!loading && !error && (
              <>
                {tracks.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                    <svg
                      className="w-16 h-16 mx-auto text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No tracks yet
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Start tracking your adventures at parks and trails
                    </p>
                    <button
                      onClick={() => handleTabChange('tracking')}
                      className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Start Tracking
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      {tracks.map((track) => (
                        <TrackCard
                          key={track.id}
                          track={track}
                          onDelete={() => handleDelete(track.id)}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {pagination.total > pagination.limit && (
                      <div className="flex items-center justify-between mt-6">
                        <button
                          onClick={handlePrevPage}
                          disabled={pagination.offset === 0}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Showing {pagination.offset + 1} -{' '}
                          {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
                          {pagination.total}
                        </span>
                        <button
                          onClick={handleNextPage}
                          disabled={pagination.offset + pagination.limit >= pagination.total}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Tracks page with Suspense boundary for useSearchParams
 */
export default function TracksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <TracksPageContent />
    </Suspense>
  );
}
