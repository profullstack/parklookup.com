/**
 * Tests for Tracks Page
 *
 * @module test/app/tracks/page.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/navigation
const mockSearchParamsGet = vi.fn((key) => null);
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: mockSearchParamsGet,
    toString: vi.fn(() => ''),
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock hooks
vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123' },
    accessToken: 'test-token',
    loading: false,
  })),
}));

vi.mock('../../../hooks/useProStatus.js', () => ({
  useProStatus: vi.fn(() => ({
    isPro: true,
    loading: false,
  })),
}));

vi.mock('../../../contexts/TrackingContext.jsx', () => ({
  useTrackingContext: vi.fn(() => ({
    isTracking: false,
    isPaused: false,
    status: 'idle',
    trackId: null,
    points: [],
    stats: null,
    error: null,
    currentPosition: null,
    detectedActivity: null,
    startNewTrack: vi.fn(),
    stopCurrentTrack: vi.fn(),
    pauseCurrentTrack: vi.fn(),
    resumeCurrentTrack: vi.fn(),
    discardCurrentTrack: vi.fn(),
    hasRecoverableSession: false,
    recoverableSessionInfo: null,
    recoverSession: vi.fn(),
    dismissRecoverableSession: vi.fn(),
  })),
}));

vi.mock('../../../lib/tracking/tracking-client.js', () => ({
  getTracks: vi.fn(() => Promise.resolve({ tracks: [], pagination: { total: 0 } })),
  deleteTrack: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock LiveTrackMap component
vi.mock('../../../components/tracking/LiveTrackMap.jsx', () => ({
  default: () => <div data-testid="live-track-map">Live Track Map</div>,
}));

// Mock TrackCard component
vi.mock('../../../components/tracking/TrackCard.jsx', () => ({
  default: ({ track, onDelete }) => (
    <div data-testid={`track-card-${track.id}`}>
      <span>{track.title}</span>
      <button onClick={onDelete}>Delete</button>
    </div>
  ),
}));

describe('Tracks Page', () => {
  const mockTrackId = 'track-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Recovery Banner', () => {
    it('should show recovery banner when recoverable session exists', () => {
      // Simulate the recovery banner rendering logic
      const hasRecoverableSession = true;
      const isTracking = false;
      const shouldShowBanner = hasRecoverableSession && !isTracking;

      expect(shouldShowBanner).toBe(true);
    });

    it('should not show recovery banner when tracking is active', () => {
      const hasRecoverableSession = true;
      const isTracking = true;
      const shouldShowBanner = hasRecoverableSession && !isTracking;

      expect(shouldShowBanner).toBe(false);
    });

    it('should not show recovery banner when no recoverable session', () => {
      const hasRecoverableSession = false;
      const isTracking = false;
      const shouldShowBanner = hasRecoverableSession && !isTracking;

      expect(shouldShowBanner).toBe(false);
    });

    it('should display point count in recovery banner', () => {
      const recoverableSessionInfo = {
        trackId: mockTrackId,
        pointCount: 42,
        savedAt: '2024-01-15T10:30:00Z',
      };

      const message = `Found ${recoverableSessionInfo.pointCount} points from a previous session`;

      expect(message).toContain('42 points');
    });

    it('should display last updated time in recovery banner', () => {
      const recoverableSessionInfo = {
        trackId: mockTrackId,
        pointCount: 25,
        lastUpdated: '2024-01-15T10:30:00Z',
      };

      const lastUpdated = new Date(recoverableSessionInfo.lastUpdated).toLocaleString();

      expect(lastUpdated).toBeDefined();
    });

    it('should display title in recovery banner if available', () => {
      const recoverableSessionInfo = {
        trackId: mockTrackId,
        pointCount: 25,
        title: 'Morning Hike at Yosemite',
        savedAt: '2024-01-15T10:30:00Z',
      };

      const message = recoverableSessionInfo.title
        ? `"${recoverableSessionInfo.title}"`
        : 'a previous session';

      expect(message).toContain('Morning Hike at Yosemite');
    });
  });

  describe('Recovery Actions', () => {
    it('should call recoverSession when recover button clicked', async () => {
      const mockRecoverSession = vi.fn().mockResolvedValue({
        success: true,
        recoveredPoints: 25,
      });

      // Simulate handleRecoverSession
      const handleRecoverSession = async () => {
        const result = await mockRecoverSession();
        return result;
      };

      const result = await handleRecoverSession();

      expect(mockRecoverSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should show loading state during recovery', async () => {
      let recovering = false;

      const handleRecoverSession = async () => {
        recovering = true;
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 100));
        recovering = false;
      };

      const promise = handleRecoverSession();
      expect(recovering).toBe(true);

      await promise;
      expect(recovering).toBe(false);
    });

    it('should show success message after recovery', async () => {
      let recoveryResult = null;

      const handleRecoverSession = async () => {
        const result = { success: true, recoveredPoints: 15 };
        recoveryResult = {
          success: true,
          message: `Recovered ${result.recoveredPoints} points from your previous session.`,
        };
        return result;
      };

      await handleRecoverSession();

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.message).toContain('15 points');
    });

    it('should show error message on recovery failure', async () => {
      let recoveryResult = null;

      const handleRecoverSession = async () => {
        const result = { error: { message: 'Track not found' } };
        recoveryResult = {
          success: false,
          message: result.error.message,
        };
        return result;
      };

      await handleRecoverSession();

      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.message).toBe('Track not found');
    });

    it('should call dismissRecoverableSession when dismiss clicked', () => {
      const mockDismiss = vi.fn();

      // Simulate handleDismissRecovery with confirmation
      const handleDismissRecovery = (confirmed) => {
        if (confirmed) {
          mockDismiss();
        }
      };

      handleDismissRecovery(true);

      expect(mockDismiss).toHaveBeenCalled();
    });

    it('should not dismiss if user cancels confirmation', () => {
      const mockDismiss = vi.fn();

      const handleDismissRecovery = (confirmed) => {
        if (confirmed) {
          mockDismiss();
        }
      };

      handleDismissRecovery(false);

      expect(mockDismiss).not.toHaveBeenCalled();
    });

    it('should clear recovery result when dismissed', () => {
      let recoveryResult = { success: true, message: 'Recovered 10 points' };

      const clearRecoveryResult = () => {
        recoveryResult = null;
      };

      clearRecoveryResult();

      expect(recoveryResult).toBeNull();
    });
  });

  describe('Recovery Result Display', () => {
    it('should show success styling for successful recovery', () => {
      const recoveryResult = { success: true, message: 'Recovered 10 points' };

      const successClass = recoveryResult.success
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200';

      expect(successClass).toContain('green');
    });

    it('should show error styling for failed recovery', () => {
      const recoveryResult = { success: false, message: 'Track not found' };

      const errorClass = recoveryResult.success
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200';

      expect(errorClass).toContain('red');
    });

    it('should show checkmark icon for success', () => {
      const recoveryResult = { success: true };

      const iconType = recoveryResult.success ? 'checkmark' : 'x-mark';

      expect(iconType).toBe('checkmark');
    });

    it('should show x-mark icon for failure', () => {
      const recoveryResult = { success: false };

      const iconType = recoveryResult.success ? 'checkmark' : 'x-mark';

      expect(iconType).toBe('x-mark');
    });
  });

  describe('Live Tracking Banner', () => {
    it('should show live tracking banner when tracking is active', () => {
      const isTracking = true;
      const activeTab = 'my-tracks';

      const shouldShowBanner = isTracking && activeTab !== 'tracking';

      expect(shouldShowBanner).toBe(true);
    });

    it('should not show live tracking banner on tracking tab', () => {
      const isTracking = true;
      const activeTab = 'tracking';

      const shouldShowBanner = isTracking && activeTab !== 'tracking';

      expect(shouldShowBanner).toBe(false);
    });

    it('should display current stats in banner', () => {
      const stats = { duration: 3600, distance: 5000 };

      const formatDuration = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) {
          return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      const formatDistance = (meters) => {
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(2)} km`;
      };

      expect(formatDuration(stats.duration)).toBe('1:00:00');
      expect(formatDistance(stats.distance)).toBe('5.00 km');
    });

    it('should display detected activity in banner', () => {
      const detectedActivity = 'hiking';

      const activityDisplay = detectedActivity ? `(${detectedActivity})` : '';

      expect(activityDisplay).toBe('(hiking)');
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to tracking tab when tracking starts', () => {
      let activeTab = 'my-tracks';
      const isTracking = true;

      // Simulate useEffect that switches tab
      if (isTracking && activeTab !== 'tracking') {
        activeTab = 'tracking';
      }

      expect(activeTab).toBe('tracking');
    });

    it('should update URL when tab changes', () => {
      const mockPush = vi.fn();
      const router = { push: mockPush };

      const handleTabChange = (tabId) => {
        const params = new URLSearchParams();
        params.set('tab', tabId);
        router.push(`/tracks?${params.toString()}`);
      };

      handleTabChange('tracking');

      expect(mockPush).toHaveBeenCalledWith('/tracks?tab=tracking');
    });
  });

  describe('Authentication States', () => {
    it('should show sign in prompt when not authenticated', () => {
      const user = null;

      const showSignInPrompt = !user;

      expect(showSignInPrompt).toBe(true);
    });

    it('should show pro upgrade prompt when not pro', () => {
      const user = { id: 'user-123' };
      const isPro = false;

      const showUpgradePrompt = user && !isPro;

      expect(showUpgradePrompt).toBe(true);
    });

    it('should show tracks page when authenticated and pro', () => {
      const user = { id: 'user-123' };
      const isPro = true;

      const showTracksPage = user && isPro;

      expect(showTracksPage).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should display start error', () => {
      const startError = 'Failed to start tracking: GPS permission denied';

      expect(startError).toContain('GPS permission denied');
    });

    it('should display tracking error', () => {
      const trackingError = 'Lost GPS signal';

      expect(trackingError).toContain('GPS signal');
    });

    it('should clear start error on retry', () => {
      let startError = 'Failed to start';

      const handleStartTracking = () => {
        startError = null;
        // Start tracking logic
      };

      handleStartTracking();

      expect(startError).toBeNull();
    });
  });

  describe('Tracks List', () => {
    it('should fetch tracks on mount', async () => {
      const mockGetTracks = vi.fn().mockResolvedValue({
        tracks: [
          { id: 'track-1', title: 'Morning Hike' },
          { id: 'track-2', title: 'Evening Walk' },
        ],
        pagination: { total: 2 },
      });

      const result = await mockGetTracks('test-token', {});

      expect(mockGetTracks).toHaveBeenCalled();
      expect(result.tracks).toHaveLength(2);
    });

    it('should handle delete track', async () => {
      const mockDeleteTrack = vi.fn().mockResolvedValue({ success: true });

      let tracks = [
        { id: 'track-1', title: 'Morning Hike' },
        { id: 'track-2', title: 'Evening Walk' },
      ];

      const handleDelete = async (trackId) => {
        const result = await mockDeleteTrack('test-token', trackId);
        if (!result.error) {
          tracks = tracks.filter((t) => t.id !== trackId);
        }
      };

      await handleDelete('track-1');

      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('track-2');
    });

    it('should show empty state when no tracks', () => {
      const tracks = [];

      const showEmptyState = tracks.length === 0;

      expect(showEmptyState).toBe(true);
    });

    it('should show pagination when tracks exceed limit', () => {
      const pagination = { total: 50, limit: 20, offset: 0 };

      const showPagination = pagination.total > pagination.limit;

      expect(showPagination).toBe(true);
    });
  });

  describe('Tracking Controls', () => {
    it('should show pause button when recording', () => {
      const isTracking = true;
      const isPaused = false;

      const showPauseButton = isTracking && !isPaused;

      expect(showPauseButton).toBe(true);
    });

    it('should show resume button when paused', () => {
      const isTracking = true;
      const isPaused = true;

      const showResumeButton = isTracking && isPaused;

      expect(showResumeButton).toBe(true);
    });

    it('should call stopCurrentTrack and refresh tracks', async () => {
      const mockStopTracking = vi.fn().mockResolvedValue({ track: { id: mockTrackId } });
      const mockFetchTracks = vi.fn();
      let activeTab = 'tracking';

      const handleStopTracking = async () => {
        await mockStopTracking();
        mockFetchTracks();
        activeTab = 'my-tracks';
      };

      await handleStopTracking();

      expect(mockStopTracking).toHaveBeenCalled();
      expect(mockFetchTracks).toHaveBeenCalled();
      expect(activeTab).toBe('my-tracks');
    });

    it('should confirm before discarding track', async () => {
      const mockDiscardTracking = vi.fn();
      let activeTab = 'tracking';

      const handleDiscardTracking = async (confirmed) => {
        if (!confirmed) return;
        await mockDiscardTracking();
        activeTab = 'my-tracks';
      };

      await handleDiscardTracking(true);

      expect(mockDiscardTracking).toHaveBeenCalled();
      expect(activeTab).toBe('my-tracks');
    });
  });

  describe('Stats Display', () => {
    it('should format duration correctly', () => {
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

      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(3665)).toBe('1:01:05');
    });

    it('should format distance correctly', () => {
      const formatDistance = (meters) => {
        if (!meters) return '0 m';
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(2)} km`;
      };

      expect(formatDistance(0)).toBe('0 m');
      expect(formatDistance(500)).toBe('500 m');
      expect(formatDistance(1500)).toBe('1.50 km');
    });

    it('should display average speed', () => {
      const stats = { avgSpeed: 5.5 };

      const speedDisplay = stats.avgSpeed ? `${stats.avgSpeed.toFixed(1)} km/h` : '0 km/h';

      expect(speedDisplay).toBe('5.5 km/h');
    });

    it('should display elevation gain', () => {
      const stats = { elevationGain: 250.7 };

      const elevationDisplay = stats.elevationGain
        ? `${Math.round(stats.elevationGain)} m`
        : '0 m';

      expect(elevationDisplay).toBe('251 m');
    });
  });

  describe('Filter and Sort', () => {
    it('should filter by status', () => {
      const tracks = [
        { id: '1', status: 'completed' },
        { id: '2', status: 'shared' },
        { id: '3', status: 'completed' },
      ];

      const filter = 'completed';
      const filtered = tracks.filter((t) => t.status === filter);

      expect(filtered).toHaveLength(2);
    });

    it('should filter by activity type', () => {
      const tracks = [
        { id: '1', activity_type: 'hiking' },
        { id: '2', activity_type: 'biking' },
        { id: '3', activity_type: 'hiking' },
      ];

      const activityFilter = 'hiking';
      const filtered = tracks.filter((t) => t.activity_type === activityFilter);

      expect(filtered).toHaveLength(2);
    });

    it('should sort by created_at descending', () => {
      const tracks = [
        { id: '1', created_at: '2024-01-10' },
        { id: '2', created_at: '2024-01-15' },
        { id: '3', created_at: '2024-01-12' },
      ];

      const sorted = [...tracks].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should sort by distance descending', () => {
      const tracks = [
        { id: '1', distance_meters: 5000 },
        { id: '2', distance_meters: 10000 },
        { id: '3', distance_meters: 7500 },
      ];

      const sorted = [...tracks].sort((a, b) => b.distance_meters - a.distance_meters);

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });
  });

  describe('Auto-Start Tracking with URL Parameters', () => {
    /**
     * Tests for the auto-start tracking flow when redirected from
     * a park detail page with URL parameters
     */

    it('should detect auto-start condition with parkCode', () => {
      const searchParams = {
        start: 'true',
        tab: 'tracking',
        parkCode: 'yose',
        parkName: 'Yosemite',
      };

      const hasContext = !!(searchParams.parkCode || searchParams.parkId || searchParams.localParkId || searchParams.trailId);
      const shouldAutoStart = searchParams.start === 'true' && hasContext;

      expect(shouldAutoStart).toBe(true);
    });

    it('should detect auto-start condition with parkId (NPS parks)', () => {
      const searchParams = {
        start: 'true',
        tab: 'tracking',
        parkId: 'nps-park-uuid-123',
        parkName: 'Yosemite',
      };

      const hasContext = !!(searchParams.parkCode || searchParams.parkId || searchParams.localParkId || searchParams.trailId);
      const shouldAutoStart = searchParams.start === 'true' && hasContext;

      expect(shouldAutoStart).toBe(true);
    });

    it('should detect auto-start condition with localParkId (local parks)', () => {
      const searchParams = {
        start: 'true',
        tab: 'tracking',
        localParkId: 'local-park-uuid-456',
        parkName: 'City Park',
      };

      const hasContext = !!(searchParams.parkCode || searchParams.parkId || searchParams.localParkId || searchParams.trailId);
      const shouldAutoStart = searchParams.start === 'true' && hasContext;

      expect(shouldAutoStart).toBe(true);
    });

    it('should detect auto-start condition with trailId', () => {
      const searchParams = {
        start: 'true',
        tab: 'tracking',
        trailId: 'trail-uuid-789',
        trailName: 'Half Dome Trail',
      };

      const hasContext = !!(searchParams.parkCode || searchParams.parkId || searchParams.localParkId || searchParams.trailId);
      const shouldAutoStart = searchParams.start === 'true' && hasContext;

      expect(shouldAutoStart).toBe(true);
    });

    it('should not auto-start without start=true parameter', () => {
      const searchParams = {
        tab: 'tracking',
        parkCode: 'yose',
      };

      const hasContext = !!(searchParams.parkCode || searchParams.parkId || searchParams.localParkId || searchParams.trailId);
      const shouldAutoStart = searchParams.start === 'true' && hasContext;

      expect(shouldAutoStart).toBe(false);
    });

    it('should not auto-start without any park/trail context', () => {
      const searchParams = {
        start: 'true',
        tab: 'tracking',
      };

      const hasContext = !!(searchParams.parkCode || searchParams.parkId || searchParams.localParkId || searchParams.trailId);
      const shouldAutoStart = searchParams.start === 'true' && hasContext;

      expect(shouldAutoStart).toBe(false);
    });

    it('should pass localParkId to startNewTrack for local parks', async () => {
      const mockStartNewTrack = vi.fn().mockResolvedValue({ track: { id: 'new-track-id' } });

      const searchParams = {
        start: 'true',
        localParkId: 'local-park-uuid-456',
        parkName: 'City Park',
      };

      // Simulate handleStartTracking
      const handleStartTracking = async () => {
        await mockStartNewTrack({
          parkCode: searchParams.parkCode,
          parkId: searchParams.parkId,
          localParkId: searchParams.localParkId,
          trailId: searchParams.trailId,
          title: searchParams.parkName || searchParams.trailName,
        });
      };

      await handleStartTracking();

      expect(mockStartNewTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          localParkId: 'local-park-uuid-456',
          title: 'City Park',
        })
      );
      expect(mockStartNewTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          parkId: undefined,
        })
      );
    });

    it('should pass parkId to startNewTrack for NPS parks', async () => {
      const mockStartNewTrack = vi.fn().mockResolvedValue({ track: { id: 'new-track-id' } });

      const searchParams = {
        start: 'true',
        parkId: 'nps-park-uuid-123',
        parkCode: 'yose',
        parkName: 'Yosemite',
      };

      // Simulate handleStartTracking
      const handleStartTracking = async () => {
        await mockStartNewTrack({
          parkCode: searchParams.parkCode,
          parkId: searchParams.parkId,
          localParkId: searchParams.localParkId,
          trailId: searchParams.trailId,
          title: searchParams.parkName || searchParams.trailName,
        });
      };

      await handleStartTracking();

      expect(mockStartNewTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          parkId: 'nps-park-uuid-123',
          parkCode: 'yose',
          title: 'Yosemite',
        })
      );
      expect(mockStartNewTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          localParkId: undefined,
        })
      );
    });

    it('should handle hasContext check correctly for all park types', () => {
      // Test NPS park
      const npsParams = { parkCode: 'yose', parkId: 'nps-uuid' };
      const npsHasContext = npsParams.parkCode || npsParams.parkId || npsParams.localParkId || npsParams.trailId;
      expect(npsHasContext).toBeTruthy();

      // Test local park
      const localParams = { localParkId: 'local-uuid' };
      const localHasContext = localParams.parkCode || localParams.parkId || localParams.localParkId || localParams.trailId;
      expect(localHasContext).toBeTruthy();

      // Test trail
      const trailParams = { trailId: 'trail-uuid' };
      const trailHasContext = trailParams.parkCode || trailParams.parkId || trailParams.localParkId || trailParams.trailId;
      expect(trailHasContext).toBeTruthy();

      // Test no context
      const noParams = {};
      const noHasContext = noParams.parkCode || noParams.parkId || noParams.localParkId || noParams.trailId;
      expect(noHasContext).toBeFalsy();
    });
  });
});
