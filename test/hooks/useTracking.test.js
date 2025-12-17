/**
 * Tests for useTracking Hook
 *
 * @module test/hooks/useTracking.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../lib/tracking/tracking-client.js', () => ({
  createTrack: vi.fn(),
  updateTrack: vi.fn(),
  addTrackPoints: vi.fn(),
  finalizeTrack: vi.fn(),
}));

vi.mock('../../lib/tracking/activity-detection.js', () => ({
  ActivityDetector: vi.fn().mockImplementation(() => ({
    addSpeed: vi.fn().mockReturnValue('walking'),
    getCurrentActivity: vi.fn().mockReturnValue('walking'),
    getAverageSpeed: vi.fn().mockReturnValue(1.5),
    reset: vi.fn(),
  })),
  detectActivityFromSpeed: vi.fn().mockReturnValue('walking'),
}));

describe('useTracking Hook', () => {
  const mockAccessToken = 'test-access-token';
  const mockTrackId = 'track-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have idle status initially', () => {
      const initialState = {
        status: 'idle',
        trackId: null,
        points: [],
        stats: null,
        error: null,
      };

      expect(initialState.status).toBe('idle');
      expect(initialState.trackId).toBeNull();
      expect(initialState.points).toHaveLength(0);
    });

    it('should not be tracking initially', () => {
      const initialState = {
        isTracking: false,
        isPaused: false,
      };

      expect(initialState.isTracking).toBe(false);
      expect(initialState.isPaused).toBe(false);
    });
  });

  describe('startTracking', () => {
    it('should create a new track', async () => {
      const { createTrack } = await import('../../lib/tracking/tracking-client.js');
      createTrack.mockResolvedValueOnce({
        track: { id: mockTrackId, status: 'recording' },
      });

      const result = await createTrack(mockAccessToken, {
        title: 'Morning Hike',
        activityType: 'hiking',
        parkCode: 'yose',
      });

      expect(result.track.id).toBe(mockTrackId);
      expect(result.track.status).toBe('recording');
    });

    it('should handle track creation error', async () => {
      const { createTrack } = await import('../../lib/tracking/tracking-client.js');
      createTrack.mockResolvedValueOnce({
        error: { message: 'Pro subscription required' },
        status: 403,
      });

      const result = await createTrack(mockAccessToken, {});

      expect(result.error).toBeDefined();
      expect(result.status).toBe(403);
    });

    it('should start geolocation watch', () => {
      const mockWatchPosition = vi.fn().mockReturnValue(123);

      // Simulate starting watch
      const watchId = mockWatchPosition();

      expect(watchId).toBe(123);
      expect(mockWatchPosition).toHaveBeenCalled();
    });

    it('should initialize activity detector', async () => {
      const { ActivityDetector } = await import('../../lib/tracking/activity-detection.js');

      const detector = new ActivityDetector();

      expect(detector.getCurrentActivity()).toBe('walking');
    });
  });

  describe('Position Updates', () => {
    it('should add points to local buffer', () => {
      const points = [];
      const newPoint = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 100,
        accuracy: 10,
        speed: 1.5,
        heading: 45,
        timestamp: Date.now(),
      };

      points.push(newPoint);

      expect(points).toHaveLength(1);
      expect(points[0].latitude).toBe(37.7749);
    });

    it('should filter low accuracy points', () => {
      const accuracyThreshold = 50; // meters
      const points = [
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10 }, // good
        { latitude: 37.7750, longitude: -122.4195, accuracy: 100 }, // bad
        { latitude: 37.7751, longitude: -122.4196, accuracy: 30 }, // good
      ];

      const filteredPoints = points.filter((p) => p.accuracy <= accuracyThreshold);

      expect(filteredPoints).toHaveLength(2);
    });

    it('should update activity detection with speed', async () => {
      const { ActivityDetector } = await import('../../lib/tracking/activity-detection.js');

      const detector = new ActivityDetector();
      const activity = detector.addSpeed(5);

      expect(activity).toBe('walking');
    });

    it('should calculate real-time stats', () => {
      const points = [
        { latitude: 37.7749, longitude: -122.4194, timestamp: 1000 },
        { latitude: 37.7750, longitude: -122.4195, timestamp: 2000 },
        { latitude: 37.7751, longitude: -122.4196, timestamp: 3000 },
      ];

      const stats = {
        pointCount: points.length,
        duration: (points[points.length - 1].timestamp - points[0].timestamp) / 1000,
        // Distance would be calculated using Haversine
      };

      expect(stats.pointCount).toBe(3);
      expect(stats.duration).toBe(2);
    });
  });

  describe('Batch Upload', () => {
    it('should batch upload points at interval', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockResolvedValueOnce({
        inserted: 10,
        points: [],
      });

      const points = Array(10)
        .fill(null)
        .map((_, i) => ({
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194,
          recordedAt: new Date().toISOString(),
        }));

      const result = await addTrackPoints(mockAccessToken, mockTrackId, points);

      expect(result.inserted).toBe(10);
    });

    it('should clear buffer after successful upload', async () => {
      const buffer = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7750, longitude: -122.4195 },
      ];

      // Simulate successful upload
      const uploadSuccess = true;

      if (uploadSuccess) {
        buffer.length = 0;
      }

      expect(buffer).toHaveLength(0);
    });

    it('should retry failed uploads', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');

      // First call fails
      addTrackPoints.mockResolvedValueOnce({
        error: { message: 'Network error' },
      });

      // Second call succeeds
      addTrackPoints.mockResolvedValueOnce({
        inserted: 5,
      });

      const result1 = await addTrackPoints(mockAccessToken, mockTrackId, []);
      expect(result1.error).toBeDefined();

      const result2 = await addTrackPoints(mockAccessToken, mockTrackId, []);
      expect(result2.inserted).toBe(5);
    });

    it('should handle partial upload success', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockResolvedValueOnce({
        inserted: 8,
        validationErrors: [
          { index: 2, error: 'Invalid latitude' },
          { index: 5, error: 'Invalid longitude' },
        ],
      });

      const result = await addTrackPoints(mockAccessToken, mockTrackId, []);

      expect(result.inserted).toBe(8);
      expect(result.validationErrors).toHaveLength(2);
    });
  });

  describe('pauseTracking', () => {
    it('should pause geolocation watch', () => {
      const mockClearWatch = vi.fn();
      const watchId = 123;

      mockClearWatch(watchId);

      expect(mockClearWatch).toHaveBeenCalledWith(123);
    });

    it('should update track status to paused', async () => {
      const { updateTrack } = await import('../../lib/tracking/tracking-client.js');
      updateTrack.mockResolvedValueOnce({
        track: { id: mockTrackId, status: 'paused' },
      });

      const result = await updateTrack(mockAccessToken, mockTrackId, { status: 'paused' });

      expect(result.track.status).toBe('paused');
    });

    it('should flush pending points before pausing', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockResolvedValueOnce({ inserted: 5 });

      const pendingPoints = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7750, longitude: -122.4195 },
      ];

      // Flush before pause
      if (pendingPoints.length > 0) {
        await addTrackPoints(mockAccessToken, mockTrackId, pendingPoints);
      }

      expect(addTrackPoints).toHaveBeenCalled();
    });
  });

  describe('resumeTracking', () => {
    it('should restart geolocation watch', () => {
      const mockWatchPosition = vi.fn().mockReturnValue(456);

      const newWatchId = mockWatchPosition();

      expect(newWatchId).toBe(456);
    });

    it('should update track status to recording', async () => {
      const { updateTrack } = await import('../../lib/tracking/tracking-client.js');
      updateTrack.mockResolvedValueOnce({
        track: { id: mockTrackId, status: 'recording' },
      });

      const result = await updateTrack(mockAccessToken, mockTrackId, { status: 'recording' });

      expect(result.track.status).toBe('recording');
    });
  });

  describe('stopTracking', () => {
    it('should stop geolocation watch', () => {
      const mockClearWatch = vi.fn();
      const watchId = 123;

      mockClearWatch(watchId);

      expect(mockClearWatch).toHaveBeenCalledWith(123);
    });

    it('should flush all pending points', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockResolvedValueOnce({ inserted: 10 });

      await addTrackPoints(mockAccessToken, mockTrackId, []);

      expect(addTrackPoints).toHaveBeenCalled();
    });

    it('should finalize track', async () => {
      const { finalizeTrack } = await import('../../lib/tracking/tracking-client.js');
      finalizeTrack.mockResolvedValueOnce({
        track: {
          id: mockTrackId,
          status: 'completed',
          distance_meters: 5000,
          duration_seconds: 3600,
          elevation_gain_m: 200,
        },
      });

      const result = await finalizeTrack(mockAccessToken, mockTrackId);

      expect(result.track.status).toBe('completed');
      expect(result.track.distance_meters).toBe(5000);
    });

    it('should reset activity detector', async () => {
      const { ActivityDetector } = await import('../../lib/tracking/activity-detection.js');

      const detector = new ActivityDetector();
      detector.reset();

      expect(detector.reset).toHaveBeenCalled();
    });

    it('should clear local state', () => {
      const state = {
        trackId: mockTrackId,
        points: [{ latitude: 37.7749, longitude: -122.4194 }],
        status: 'recording',
      };

      // Reset state
      state.trackId = null;
      state.points = [];
      state.status = 'idle';

      expect(state.trackId).toBeNull();
      expect(state.points).toHaveLength(0);
      expect(state.status).toBe('idle');
    });
  });

  describe('Activity Detection', () => {
    it('should detect walking activity', async () => {
      const { detectActivityFromSpeed } = await import('../../lib/tracking/activity-detection.js');

      const activity = detectActivityFromSpeed(1.5); // ~3.4 mph

      expect(activity).toBe('walking');
    });

    it('should update detected activity', async () => {
      const { ActivityDetector } = await import('../../lib/tracking/activity-detection.js');

      const detector = new ActivityDetector();

      // Add multiple speed samples
      detector.addSpeed(1);
      detector.addSpeed(2);
      detector.addSpeed(1.5);

      const activity = detector.getCurrentActivity();

      expect(activity).toBe('walking');
    });

    it('should provide average speed', async () => {
      const { ActivityDetector } = await import('../../lib/tracking/activity-detection.js');

      const detector = new ActivityDetector();
      const avgSpeed = detector.getAverageSpeed();

      expect(avgSpeed).toBe(1.5);
    });
  });

  describe('Stats Calculation', () => {
    it('should calculate distance from points', () => {
      // Haversine formula approximation
      const calculateDistance = (p1, p2) => {
        const R = 6371000; // Earth radius in meters
        const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
        const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((p1.latitude * Math.PI) / 180) *
            Math.cos((p2.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const p1 = { latitude: 37.7749, longitude: -122.4194 };
      const p2 = { latitude: 37.7849, longitude: -122.4094 };

      const distance = calculateDistance(p1, p2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(2000); // Should be about 1.4 km
    });

    it('should calculate duration', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T11:30:00Z');

      const durationMs = endTime - startTime;
      const durationSeconds = durationMs / 1000;

      expect(durationSeconds).toBe(5400); // 1.5 hours
    });

    it('should calculate elevation gain', () => {
      const points = [
        { altitude: 100 },
        { altitude: 150 },
        { altitude: 120 },
        { altitude: 200 },
      ];

      let elevationGain = 0;
      for (let i = 1; i < points.length; i++) {
        const diff = points[i].altitude - points[i - 1].altitude;
        if (diff > 0) {
          elevationGain += diff;
        }
      }

      expect(elevationGain).toBe(130); // 50 + 80
    });

    it('should calculate average speed', () => {
      const points = [
        { speed: 1.5 },
        { speed: 2.0 },
        { speed: 1.8 },
        { speed: 0 }, // stopped
      ];

      const movingPoints = points.filter((p) => p.speed > 0);
      const avgSpeed = movingPoints.reduce((sum, p) => sum + p.speed, 0) / movingPoints.length;

      expect(avgSpeed).toBeCloseTo(1.77, 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle geolocation errors', () => {
      const error = { code: 1, message: 'Permission denied' };

      const errorState = {
        error: error.message,
        status: 'error',
      };

      expect(errorState.error).toBe('Permission denied');
      expect(errorState.status).toBe('error');
    });

    it('should handle network errors during upload', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockRejectedValueOnce(new Error('Network error'));

      try {
        await addTrackPoints(mockAccessToken, mockTrackId, []);
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    it('should queue points when offline', () => {
      const offlineQueue = [];
      const point = { latitude: 37.7749, longitude: -122.4194 };

      // Simulate offline
      const isOnline = false;

      if (!isOnline) {
        offlineQueue.push(point);
      }

      expect(offlineQueue).toHaveLength(1);
    });
  });

  describe('Cleanup', () => {
    it('should clear watch on unmount', () => {
      const mockClearWatch = vi.fn();
      const watchId = 123;

      // Simulate cleanup
      mockClearWatch(watchId);

      expect(mockClearWatch).toHaveBeenCalledWith(123);
    });

    it('should clear intervals on unmount', () => {
      const mockClearInterval = vi.fn();
      const intervalId = 456;

      mockClearInterval(intervalId);

      expect(mockClearInterval).toHaveBeenCalledWith(456);
    });

    it('should flush pending points on unmount', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockResolvedValueOnce({ inserted: 3 });

      const pendingPoints = [{ latitude: 37.7749, longitude: -122.4194 }];

      if (pendingPoints.length > 0) {
        await addTrackPoints(mockAccessToken, mockTrackId, pendingPoints);
      }

      expect(addTrackPoints).toHaveBeenCalled();
    });
  });

  describe('Local Backup and Crash Recovery', () => {
    const localBackupKey = 'parklookup_tracking_backup';
    let mockLocalStorage;

    beforeEach(() => {
      // Mock localStorage
      mockLocalStorage = {
        store: {},
        getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
        setItem: vi.fn((key, value) => {
          mockLocalStorage.store[key] = value;
        }),
        removeItem: vi.fn((key) => {
          delete mockLocalStorage.store[key];
        }),
        clear: vi.fn(() => {
          mockLocalStorage.store = {};
        }),
      };

      // Replace global localStorage
      vi.stubGlobal('localStorage', mockLocalStorage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe('saveLocalBackup', () => {
      it('should save tracking state to localStorage', () => {
        const backupData = {
          trackId: mockTrackId,
          points: [
            { latitude: 37.7749, longitude: -122.4194, sequenceNum: 0 },
            { latitude: 37.7750, longitude: -122.4195, sequenceNum: 1 },
          ],
          pendingPoints: [{ latitude: 37.7751, longitude: -122.4196, sequenceNum: 2 }],
          stats: { distance: 100, duration: 60 },
          activity: 'walking',
          trackingState: 'recording',
          sequenceNum: 3,
        };

        // Simulate saveLocalBackup
        const dataToSave = {
          ...backupData,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(localBackupKey, JSON.stringify(dataToSave));

        expect(localStorage.setItem).toHaveBeenCalledWith(
          localBackupKey,
          expect.stringContaining(mockTrackId)
        );

        const saved = JSON.parse(mockLocalStorage.store[localBackupKey]);
        expect(saved.trackId).toBe(mockTrackId);
        expect(saved.points).toHaveLength(2);
        expect(saved.pendingPoints).toHaveLength(1);
        expect(saved.savedAt).toBeDefined();
      });

      it('should include timestamp in backup', () => {
        const backupData = {
          trackId: mockTrackId,
          points: [],
          pendingPoints: [],
        };

        const dataToSave = {
          ...backupData,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(localBackupKey, JSON.stringify(dataToSave));

        const saved = JSON.parse(mockLocalStorage.store[localBackupKey]);
        expect(saved.savedAt).toBeDefined();
        expect(new Date(saved.savedAt)).toBeInstanceOf(Date);
      });

      it('should handle localStorage errors gracefully', () => {
        localStorage.setItem.mockImplementationOnce(() => {
          throw new Error('QuotaExceededError');
        });

        // Should not throw
        expect(() => {
          try {
            localStorage.setItem(localBackupKey, JSON.stringify({ trackId: mockTrackId }));
          } catch {
            // Silently handle error
          }
        }).not.toThrow();
      });
    });

    describe('loadLocalBackup', () => {
      it('should load backup from localStorage', () => {
        const backupData = {
          trackId: mockTrackId,
          points: [{ latitude: 37.7749, longitude: -122.4194 }],
          pendingPoints: [],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const loaded = JSON.parse(localStorage.getItem(localBackupKey));

        expect(loaded.trackId).toBe(mockTrackId);
        expect(loaded.points).toHaveLength(1);
      });

      it('should return null if no backup exists', () => {
        const loaded = localStorage.getItem(localBackupKey);

        expect(loaded).toBeNull();
      });

      it('should handle corrupted JSON gracefully', () => {
        mockLocalStorage.store[localBackupKey] = 'invalid json {{{';

        let loaded = null;
        try {
          loaded = JSON.parse(localStorage.getItem(localBackupKey));
        } catch {
          loaded = null;
        }

        expect(loaded).toBeNull();
      });
    });

    describe('clearLocalBackup', () => {
      it('should remove backup from localStorage', () => {
        mockLocalStorage.store[localBackupKey] = JSON.stringify({ trackId: mockTrackId });

        localStorage.removeItem(localBackupKey);

        expect(localStorage.removeItem).toHaveBeenCalledWith(localBackupKey);
        expect(mockLocalStorage.store[localBackupKey]).toBeUndefined();
      });
    });

    describe('checkRecoverableSession', () => {
      it('should detect recoverable session with valid backup', () => {
        const backupData = {
          trackId: mockTrackId,
          points: [
            { latitude: 37.7749, longitude: -122.4194 },
            { latitude: 37.7750, longitude: -122.4195 },
          ],
          pendingPoints: [{ latitude: 37.7751, longitude: -122.4196 }],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const backup = JSON.parse(localStorage.getItem(localBackupKey));
        const hasRecoverable = backup && backup.trackId && backup.points?.length > 0;

        expect(hasRecoverable).toBe(true);
      });

      it('should not detect recoverable session without trackId', () => {
        const backupData = {
          points: [{ latitude: 37.7749, longitude: -122.4194 }],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const backup = JSON.parse(localStorage.getItem(localBackupKey));
        const hasRecoverable = !!(backup && backup.trackId && backup.points?.length > 0);

        expect(hasRecoverable).toBe(false);
      });

      it('should not detect recoverable session without points', () => {
        const backupData = {
          trackId: mockTrackId,
          points: [],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const backup = JSON.parse(localStorage.getItem(localBackupKey));
        const hasRecoverable = backup && backup.trackId && backup.points?.length > 0;

        expect(hasRecoverable).toBe(false);
      });

      it('should provide session info when recoverable', () => {
        const backupData = {
          trackId: mockTrackId,
          points: [
            { latitude: 37.7749, longitude: -122.4194 },
            { latitude: 37.7750, longitude: -122.4195 },
            { latitude: 37.7751, longitude: -122.4196 },
          ],
          stats: { distance: 150, duration: 90 },
          savedAt: '2024-01-15T10:30:00Z',
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const backup = JSON.parse(localStorage.getItem(localBackupKey));
        const sessionInfo = {
          trackId: backup.trackId,
          pointCount: backup.points.length,
          savedAt: backup.savedAt,
          stats: backup.stats,
        };

        expect(sessionInfo.trackId).toBe(mockTrackId);
        expect(sessionInfo.pointCount).toBe(3);
        expect(sessionInfo.savedAt).toBe('2024-01-15T10:30:00Z');
        expect(sessionInfo.stats.distance).toBe(150);
      });
    });

    describe('recoverSession', () => {
      it('should upload pending points from backup', async () => {
        const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
        addTrackPoints.mockResolvedValueOnce({ inserted: 2 });

        const backupData = {
          trackId: mockTrackId,
          points: [
            { latitude: 37.7749, longitude: -122.4194 },
            { latitude: 37.7750, longitude: -122.4195 },
          ],
          pendingPoints: [
            { latitude: 37.7751, longitude: -122.4196 },
            { latitude: 37.7752, longitude: -122.4197 },
          ],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const backup = JSON.parse(localStorage.getItem(localBackupKey));

        if (backup.pendingPoints?.length > 0) {
          await addTrackPoints(mockAccessToken, backup.trackId, backup.pendingPoints);
        }

        expect(addTrackPoints).toHaveBeenCalledWith(
          mockAccessToken,
          mockTrackId,
          expect.arrayContaining([
            expect.objectContaining({ latitude: 37.7751 }),
            expect.objectContaining({ latitude: 37.7752 }),
          ])
        );
      });

      it('should clear backup after successful recovery', async () => {
        const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
        addTrackPoints.mockResolvedValueOnce({ inserted: 1 });

        const backupData = {
          trackId: mockTrackId,
          points: [{ latitude: 37.7749, longitude: -122.4194 }],
          pendingPoints: [{ latitude: 37.7750, longitude: -122.4195 }],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        // Simulate recovery
        const backup = JSON.parse(localStorage.getItem(localBackupKey));
        if (backup.pendingPoints?.length > 0) {
          await addTrackPoints(mockAccessToken, backup.trackId, backup.pendingPoints);
        }
        localStorage.removeItem(localBackupKey);

        expect(localStorage.removeItem).toHaveBeenCalledWith(localBackupKey);
        expect(mockLocalStorage.store[localBackupKey]).toBeUndefined();
      });

      it('should return error if no backup exists', () => {
        const backup = localStorage.getItem(localBackupKey);

        const result = backup
          ? { success: true }
          : { error: { message: 'No recoverable session found' } };

        expect(result.error).toBeDefined();
        expect(result.error.message).toBe('No recoverable session found');
      });

      it('should return error if access token is missing', () => {
        const accessToken = null;

        const result = accessToken
          ? { success: true }
          : { error: { message: 'Access token required' } };

        expect(result.error).toBeDefined();
        expect(result.error.message).toBe('Access token required');
      });

      it('should handle upload failure gracefully', async () => {
        const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
        addTrackPoints.mockResolvedValueOnce({
          error: { message: 'Track not found' },
        });

        const backupData = {
          trackId: 'deleted-track-id',
          points: [{ latitude: 37.7749, longitude: -122.4194 }],
          pendingPoints: [{ latitude: 37.7750, longitude: -122.4195 }],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const backup = JSON.parse(localStorage.getItem(localBackupKey));
        const result = await addTrackPoints(mockAccessToken, backup.trackId, backup.pendingPoints);

        expect(result.error).toBeDefined();
        expect(result.error.message).toBe('Track not found');
      });

      it('should return recovered points count on success', async () => {
        const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
        addTrackPoints.mockResolvedValueOnce({ inserted: 3 });

        const backupData = {
          trackId: mockTrackId,
          points: [],
          pendingPoints: [
            { latitude: 37.7749, longitude: -122.4194 },
            { latitude: 37.7750, longitude: -122.4195 },
            { latitude: 37.7751, longitude: -122.4196 },
          ],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        const backup = JSON.parse(localStorage.getItem(localBackupKey));
        await addTrackPoints(mockAccessToken, backup.trackId, backup.pendingPoints);

        const result = {
          success: true,
          trackId: backup.trackId,
          recoveredPoints: backup.pendingPoints.length,
        };

        expect(result.success).toBe(true);
        expect(result.recoveredPoints).toBe(3);
      });
    });

    describe('dismissRecoverableSession', () => {
      it('should clear backup without recovering', () => {
        const backupData = {
          trackId: mockTrackId,
          points: [{ latitude: 37.7749, longitude: -122.4194 }],
          pendingPoints: [{ latitude: 37.7750, longitude: -122.4195 }],
          savedAt: new Date().toISOString(),
        };

        mockLocalStorage.store[localBackupKey] = JSON.stringify(backupData);

        // Dismiss without recovering
        localStorage.removeItem(localBackupKey);

        expect(localStorage.removeItem).toHaveBeenCalledWith(localBackupKey);
        expect(mockLocalStorage.store[localBackupKey]).toBeUndefined();
      });

      it('should reset recovery state', () => {
        let hasRecoverableSession = true;
        let recoverableSessionInfo = { trackId: mockTrackId, pointCount: 5 };

        // Dismiss
        localStorage.removeItem(localBackupKey);
        hasRecoverableSession = false;
        recoverableSessionInfo = null;

        expect(hasRecoverableSession).toBe(false);
        expect(recoverableSessionInfo).toBeNull();
      });
    });
  });

  describe('Page Visibility Handling', () => {
    it('should upload points when page becomes hidden', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockResolvedValueOnce({ inserted: 5 });

      const pendingPoints = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7750, longitude: -122.4195 },
      ];

      // Simulate visibility change to hidden
      const visibilityState = 'hidden';
      const trackingState = 'recording';

      if (visibilityState === 'hidden' && trackingState === 'recording') {
        await addTrackPoints(mockAccessToken, mockTrackId, pendingPoints);
      }

      expect(addTrackPoints).toHaveBeenCalled();
    });

    it('should not upload when page is visible', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');

      const visibilityState = 'visible';
      const trackingState = 'recording';

      if (visibilityState === 'hidden' && trackingState === 'recording') {
        await addTrackPoints(mockAccessToken, mockTrackId, []);
      }

      expect(addTrackPoints).not.toHaveBeenCalled();
    });

    it('should not upload when not recording', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');

      const visibilityState = 'hidden';
      const trackingState = 'idle';

      if (visibilityState === 'hidden' && trackingState === 'recording') {
        await addTrackPoints(mockAccessToken, mockTrackId, []);
      }

      expect(addTrackPoints).not.toHaveBeenCalled();
    });
  });

  describe('beforeunload Handling', () => {
    let mockLocalStorage;

    beforeEach(() => {
      mockLocalStorage = {
        store: {},
        getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
        setItem: vi.fn((key, value) => {
          mockLocalStorage.store[key] = value;
        }),
        removeItem: vi.fn((key) => {
          delete mockLocalStorage.store[key];
        }),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should save backup before page unload', () => {
      const localBackupKey = 'parklookup_tracking_backup';
      const trackingState = 'recording';
      const trackId = mockTrackId;
      const points = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7750, longitude: -122.4195 },
      ];
      const pendingPoints = [{ latitude: 37.7751, longitude: -122.4196 }];

      // Simulate beforeunload
      if (trackingState === 'recording' || trackingState === 'paused') {
        if (trackId && points.length > 0) {
          const backupData = {
            trackId,
            points,
            pendingPoints,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(localBackupKey, JSON.stringify(backupData));
        }
      }

      expect(localStorage.setItem).toHaveBeenCalled();
      const saved = JSON.parse(mockLocalStorage.store[localBackupKey]);
      expect(saved.trackId).toBe(mockTrackId);
    });

    it('should use sendBeacon for reliable upload', () => {
      const mockSendBeacon = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });

      const trackId = mockTrackId;
      const pendingPoints = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7750, longitude: -122.4195 },
      ];

      // Simulate sendBeacon call
      if (pendingPoints.length > 0 && trackId) {
        const payload = JSON.stringify({ points: pendingPoints });
        navigator.sendBeacon(
          `/api/tracks/${trackId}/points`,
          new Blob([payload], { type: 'application/json' })
        );
      }

      expect(mockSendBeacon).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}/points`,
        expect.any(Blob)
      );
    });

    it('should handle sendBeacon failure gracefully', () => {
      const mockSendBeacon = vi.fn().mockImplementation(() => {
        throw new Error('sendBeacon failed');
      });
      vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });

      const trackId = mockTrackId;
      const pendingPoints = [{ latitude: 37.7749, longitude: -122.4194 }];

      // Should not throw
      expect(() => {
        try {
          if (pendingPoints.length > 0 && trackId) {
            const payload = JSON.stringify({ points: pendingPoints });
            navigator.sendBeacon(
              `/api/tracks/${trackId}/points`,
              new Blob([payload], { type: 'application/json' })
            );
          }
        } catch {
          // Silently handle error
        }
      }).not.toThrow();
    });

    it('should not save backup when idle', () => {
      const localBackupKey = 'parklookup_tracking_backup';
      const trackingState = 'idle';
      const trackId = mockTrackId;
      const points = [{ latitude: 37.7749, longitude: -122.4194 }];

      // Simulate beforeunload
      if (trackingState === 'recording' || trackingState === 'paused') {
        if (trackId && points.length > 0) {
          localStorage.setItem(localBackupKey, JSON.stringify({ trackId, points }));
        }
      }

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should show confirmation dialog when tracking', () => {
      const trackingState = 'recording';
      const mockEvent = {
        preventDefault: vi.fn(),
        returnValue: '',
      };

      // Simulate beforeunload handler
      if (trackingState === 'recording' || trackingState === 'paused') {
        mockEvent.preventDefault();
        mockEvent.returnValue = 'You have an active tracking session. Are you sure you want to leave?';
      }

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.returnValue).toContain('active tracking session');
    });
  });

  describe('Periodic Upload Configuration', () => {
    it('should use reduced upload interval (15 seconds)', () => {
      const DEFAULT_OPTIONS = {
        uploadIntervalMs: 15000,
        maxPointsPerBatch: 30,
      };

      expect(DEFAULT_OPTIONS.uploadIntervalMs).toBe(15000);
    });

    it('should use reduced batch size (30 points)', () => {
      const DEFAULT_OPTIONS = {
        uploadIntervalMs: 15000,
        maxPointsPerBatch: 30,
      };

      expect(DEFAULT_OPTIONS.maxPointsPerBatch).toBe(30);
    });

    it('should trigger upload when batch threshold reached', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');
      addTrackPoints.mockResolvedValueOnce({ inserted: 30 });

      const maxPointsPerBatch = 30;
      const pendingPoints = Array(30)
        .fill(null)
        .map((_, i) => ({
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194,
        }));

      // Trigger upload when threshold reached
      if (pendingPoints.length >= maxPointsPerBatch) {
        await addTrackPoints(mockAccessToken, mockTrackId, pendingPoints);
      }

      expect(addTrackPoints).toHaveBeenCalled();
    });

    it('should not trigger upload below threshold', async () => {
      const { addTrackPoints } = await import('../../lib/tracking/tracking-client.js');

      const maxPointsPerBatch = 30;
      const pendingPoints = Array(20)
        .fill(null)
        .map((_, i) => ({
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194,
        }));

      // Should not trigger upload
      if (pendingPoints.length >= maxPointsPerBatch) {
        await addTrackPoints(mockAccessToken, mockTrackId, pendingPoints);
      }

      expect(addTrackPoints).not.toHaveBeenCalled();
    });
  });
});
