/**
 * Tests for Activity Detection Module
 *
 * @module test/lib/tracking/activity-detection.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ActivityDetector,
  detectActivityFromSpeed,
  getActivityIcon,
  getActivityColor,
  getActivityDisplayName,
  getActivityBgColor,
  getDominantActivity,
  calculateRollingAverage,
  detectActivityFromSpeeds,
  mpsToMph,
  mphToMps,
  mpsToKph,
  ACTIVITY_TYPES,
  SPEED_THRESHOLDS,
} from '../../../lib/tracking/activity-detection.js';

describe('Activity Detection Module', () => {
  describe('ACTIVITY_TYPES', () => {
    it('should define all expected activity types', () => {
      expect(ACTIVITY_TYPES).toHaveProperty('STATIONARY');
      expect(ACTIVITY_TYPES).toHaveProperty('WALKING');
      expect(ACTIVITY_TYPES).toHaveProperty('HIKING');
      expect(ACTIVITY_TYPES).toHaveProperty('BIKING');
      expect(ACTIVITY_TYPES).toHaveProperty('DRIVING');
    });

    it('should have correct string values', () => {
      expect(ACTIVITY_TYPES.STATIONARY).toBe('stationary');
      expect(ACTIVITY_TYPES.WALKING).toBe('walking');
      expect(ACTIVITY_TYPES.HIKING).toBe('hiking');
      expect(ACTIVITY_TYPES.BIKING).toBe('biking');
      expect(ACTIVITY_TYPES.DRIVING).toBe('driving');
    });
  });

  describe('SPEED_THRESHOLDS', () => {
    it('should define speed thresholds in meters per second', () => {
      expect(SPEED_THRESHOLDS).toHaveProperty('STATIONARY_MAX');
      expect(SPEED_THRESHOLDS).toHaveProperty('WALKING_MAX');
      expect(SPEED_THRESHOLDS).toHaveProperty('BIKING_MAX');
    });

    it('should have reasonable threshold values', () => {
      // Stationary max should be around 0.5 m/s
      expect(SPEED_THRESHOLDS.STATIONARY_MAX).toBeGreaterThan(0);
      expect(SPEED_THRESHOLDS.STATIONARY_MAX).toBeLessThan(1);

      // Walking max should be around 6 mph (2.68 m/s)
      expect(SPEED_THRESHOLDS.WALKING_MAX).toBeGreaterThan(2);
      expect(SPEED_THRESHOLDS.WALKING_MAX).toBeLessThan(4);

      // Biking max should be around 20 mph (8.94 m/s)
      expect(SPEED_THRESHOLDS.BIKING_MAX).toBeGreaterThan(8);
      expect(SPEED_THRESHOLDS.BIKING_MAX).toBeLessThan(10);
    });

    it('should have thresholds in ascending order', () => {
      expect(SPEED_THRESHOLDS.STATIONARY_MAX).toBeLessThan(SPEED_THRESHOLDS.WALKING_MAX);
      expect(SPEED_THRESHOLDS.WALKING_MAX).toBeLessThan(SPEED_THRESHOLDS.BIKING_MAX);
    });
  });

  describe('Unit Conversions', () => {
    it('should convert m/s to mph correctly', () => {
      expect(mpsToMph(1)).toBeCloseTo(2.237, 2);
      expect(mpsToMph(10)).toBeCloseTo(22.37, 1);
    });

    it('should convert mph to m/s correctly', () => {
      expect(mphToMps(2.237)).toBeCloseTo(1, 2);
      expect(mphToMps(22.37)).toBeCloseTo(10, 1);
    });

    it('should convert m/s to km/h correctly', () => {
      expect(mpsToKph(1)).toBeCloseTo(3.6, 2);
      expect(mpsToKph(10)).toBeCloseTo(36, 1);
    });
  });

  describe('detectActivityFromSpeed', () => {
    it('should detect stationary for very slow speeds', () => {
      expect(detectActivityFromSpeed(0)).toBe('stationary');
      expect(detectActivityFromSpeed(0.3)).toBe('stationary');
      expect(detectActivityFromSpeed(0.49)).toBe('stationary');
    });

    it('should detect walking for slow speeds', () => {
      expect(detectActivityFromSpeed(0.6)).toBe('walking');
      expect(detectActivityFromSpeed(1)).toBe('walking');
      expect(detectActivityFromSpeed(2)).toBe('walking');
    });

    it('should detect biking for medium speeds', () => {
      expect(detectActivityFromSpeed(4)).toBe('biking');
      expect(detectActivityFromSpeed(6)).toBe('biking');
      expect(detectActivityFromSpeed(8)).toBe('biking');
    });

    it('should detect driving for high speeds', () => {
      expect(detectActivityFromSpeed(10)).toBe('driving');
      expect(detectActivityFromSpeed(20)).toBe('driving');
      expect(detectActivityFromSpeed(30)).toBe('driving');
    });

    it('should handle edge cases at thresholds', () => {
      // At stationary max threshold
      const stationaryMax = SPEED_THRESHOLDS.STATIONARY_MAX;
      expect(detectActivityFromSpeed(stationaryMax - 0.01)).toBe('stationary');
      expect(detectActivityFromSpeed(stationaryMax + 0.01)).toBe('walking');

      // At walking max threshold
      const walkingMax = SPEED_THRESHOLDS.WALKING_MAX;
      expect(detectActivityFromSpeed(walkingMax - 0.01)).toBe('walking');
      expect(detectActivityFromSpeed(walkingMax + 0.01)).toBe('biking');

      // At biking max threshold
      const bikingMax = SPEED_THRESHOLDS.BIKING_MAX;
      expect(detectActivityFromSpeed(bikingMax - 0.01)).toBe('biking');
      expect(detectActivityFromSpeed(bikingMax + 0.01)).toBe('driving');
    });

    it('should handle null and undefined speeds as stationary', () => {
      expect(detectActivityFromSpeed(null)).toBe('stationary');
      expect(detectActivityFromSpeed(undefined)).toBe('stationary');
    });

    it('should handle negative speeds as stationary', () => {
      expect(detectActivityFromSpeed(-1)).toBe('stationary');
      expect(detectActivityFromSpeed(-10)).toBe('stationary');
    });
  });

  describe('calculateRollingAverage', () => {
    it('should calculate average of speeds', () => {
      expect(calculateRollingAverage([2, 4, 6])).toBe(4);
      expect(calculateRollingAverage([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should return 0 for empty array', () => {
      expect(calculateRollingAverage([])).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(calculateRollingAverage(null)).toBe(0);
      expect(calculateRollingAverage(undefined)).toBe(0);
    });

    it('should filter out null/undefined/NaN values', () => {
      expect(calculateRollingAverage([2, null, 4, undefined, 6, NaN])).toBe(4);
    });

    it('should respect window size', () => {
      const speeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // Window of 3 should only use last 3 values: 8, 9, 10
      expect(calculateRollingAverage(speeds, 3)).toBe(9);
    });
  });

  describe('detectActivityFromSpeeds', () => {
    it('should detect activity from array of speeds', () => {
      // Average of [1, 2, 3] = 2, which is walking
      expect(detectActivityFromSpeeds([1, 2, 3])).toBe('walking');

      // Average of [5, 6, 7] = 6, which is biking
      expect(detectActivityFromSpeeds([5, 6, 7])).toBe('biking');

      // Average of [15, 20, 25] = 20, which is driving
      expect(detectActivityFromSpeeds([15, 20, 25])).toBe('driving');
    });

    it('should return stationary for empty array', () => {
      expect(detectActivityFromSpeeds([])).toBe('stationary');
    });
  });

  describe('getActivityIcon', () => {
    it('should return correct icon for each activity type', () => {
      expect(getActivityIcon('walking')).toBe('🚶');
      expect(getActivityIcon('hiking')).toBe('🥾');
      expect(getActivityIcon('biking')).toBe('🚴');
      expect(getActivityIcon('driving')).toBe('🚗');
      expect(getActivityIcon('stationary')).toBe('📍');
    });

    it('should return stationary icon for unknown activity', () => {
      expect(getActivityIcon('unknown')).toBe('📍');
      expect(getActivityIcon('')).toBe('📍');
      expect(getActivityIcon(null)).toBe('📍');
    });
  });

  describe('getActivityDisplayName', () => {
    it('should return correct display name for each activity type', () => {
      expect(getActivityDisplayName('walking')).toBe('Walking');
      expect(getActivityDisplayName('hiking')).toBe('Hiking');
      expect(getActivityDisplayName('biking')).toBe('Biking');
      expect(getActivityDisplayName('driving')).toBe('Driving');
      expect(getActivityDisplayName('stationary')).toBe('Stationary');
    });

    it('should return Unknown for unknown activity', () => {
      expect(getActivityDisplayName('unknown')).toBe('Unknown');
    });
  });

  describe('getActivityColor', () => {
    it('should return Tailwind color class for each activity type', () => {
      expect(getActivityColor('walking')).toBe('text-green-600');
      expect(getActivityColor('hiking')).toBe('text-emerald-600');
      expect(getActivityColor('biking')).toBe('text-blue-600');
      expect(getActivityColor('driving')).toBe('text-amber-600');
      expect(getActivityColor('stationary')).toBe('text-gray-500');
    });

    it('should return different colors for different activities', () => {
      const colors = [
        getActivityColor('walking'),
        getActivityColor('hiking'),
        getActivityColor('biking'),
        getActivityColor('driving'),
        getActivityColor('stationary'),
      ];
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(5);
    });

    it('should return default color for unknown activity', () => {
      expect(getActivityColor('unknown')).toBe('text-gray-500');
    });
  });

  describe('getActivityBgColor', () => {
    it('should return Tailwind background color class for each activity type', () => {
      expect(getActivityBgColor('walking')).toBe('bg-green-100');
      expect(getActivityBgColor('hiking')).toBe('bg-emerald-100');
      expect(getActivityBgColor('biking')).toBe('bg-blue-100');
      expect(getActivityBgColor('driving')).toBe('bg-amber-100');
      expect(getActivityBgColor('stationary')).toBe('bg-gray-100');
    });
  });

  describe('getDominantActivity', () => {
    it('should return walking for empty array', () => {
      expect(getDominantActivity([])).toBe('walking');
    });

    it('should return walking for null', () => {
      expect(getDominantActivity(null)).toBe('walking');
    });

    it('should return dominant activity from points', () => {
      const walkingPoints = [
        { speed_mps: 1 },
        { speed_mps: 1.5 },
        { speed_mps: 2 },
        { speed_mps: 1.8 },
      ];
      expect(getDominantActivity(walkingPoints)).toBe('walking');

      const bikingPoints = [
        { speed_mps: 5 },
        { speed_mps: 6 },
        { speed_mps: 7 },
        { speed_mps: 5.5 },
      ];
      expect(getDominantActivity(bikingPoints)).toBe('biking');
    });

    it('should ignore stationary points', () => {
      const mixedPoints = [
        { speed_mps: 0 }, // stationary - ignored
        { speed_mps: 0.1 }, // stationary - ignored
        { speed_mps: 5 }, // biking
        { speed_mps: 6 }, // biking
      ];
      expect(getDominantActivity(mixedPoints)).toBe('biking');
    });
  });

  describe('ActivityDetector class', () => {
    let detector;

    beforeEach(() => {
      detector = new ActivityDetector();
    });

    describe('constructor', () => {
      it('should initialize with default options', () => {
        expect(detector).toBeDefined();
        expect(detector.getCurrentActivity()).toBe('stationary');
      });

      it('should accept custom window size', () => {
        const customDetector = new ActivityDetector({ windowSize: 10 });
        expect(customDetector).toBeDefined();
        expect(customDetector.windowSize).toBe(10);
      });

      it('should accept custom stability threshold', () => {
        const customDetector = new ActivityDetector({ stabilityThreshold: 5 });
        expect(customDetector).toBeDefined();
        expect(customDetector.stabilityThreshold).toBe(5);
      });
    });

    describe('addSpeed', () => {
      it('should accept speed values', () => {
        expect(() => detector.addSpeed(5)).not.toThrow();
      });

      it('should return an object with activity info', () => {
        const result = detector.addSpeed(5);
        expect(typeof result).toBe('object');
        expect(result).toHaveProperty('activity');
        expect(result).toHaveProperty('rawActivity');
        expect(result).toHaveProperty('avgSpeedMps');
        expect(result).toHaveProperty('avgSpeedMph');
        expect(result).toHaveProperty('avgSpeedKph');
        expect(result).toHaveProperty('isStable');
        expect(result).toHaveProperty('confidence');
      });

      it('should handle multiple speed values', () => {
        detector.addSpeed(1);
        detector.addSpeed(2);
        detector.addSpeed(3);
        expect(detector.getCurrentActivity()).toBeDefined();
      });
    });

    describe('getCurrentActivity', () => {
      it('should return stationary by default', () => {
        expect(detector.getCurrentActivity()).toBe('stationary');
      });

      it('should update based on speed samples', () => {
        // Add multiple high-speed samples
        for (let i = 0; i < 10; i++) {
          detector.addSpeed(15); // Driving speed
        }
        expect(detector.getCurrentActivity()).toBe('driving');
      });

      it('should use rolling average for stability', () => {
        // Add walking speeds
        for (let i = 0; i < 5; i++) {
          detector.addSpeed(1.5);
        }
        expect(detector.getCurrentActivity()).toBe('walking');

        // Add one high speed - should not immediately change due to stability
        detector.addSpeed(20);
        // Activity might still be walking due to rolling average and stability threshold
      });
    });

    describe('getAverageSpeed', () => {
      it('should return 0 with no samples', () => {
        expect(detector.getAverageSpeed()).toBe(0);
      });

      it('should calculate correct average', () => {
        detector.addSpeed(2);
        detector.addSpeed(4);
        detector.addSpeed(6);
        expect(detector.getAverageSpeed()).toBe(4);
      });

      it('should respect window size', () => {
        const smallWindowDetector = new ActivityDetector({ windowSize: 3 });
        smallWindowDetector.addSpeed(10);
        smallWindowDetector.addSpeed(10);
        smallWindowDetector.addSpeed(10);
        smallWindowDetector.addSpeed(1);
        smallWindowDetector.addSpeed(1);
        smallWindowDetector.addSpeed(1);
        // Only last 3 samples should be considered
        expect(smallWindowDetector.getAverageSpeed()).toBe(1);
      });
    });

    describe('reset', () => {
      it('should clear all samples', () => {
        detector.addSpeed(10);
        detector.addSpeed(20);
        detector.reset();
        expect(detector.getAverageSpeed()).toBe(0);
      });

      it('should reset activity to stationary', () => {
        for (let i = 0; i < 10; i++) {
          detector.addSpeed(15);
        }
        expect(detector.getCurrentActivity()).toBe('driving');
        detector.reset();
        expect(detector.getCurrentActivity()).toBe('stationary');
      });
    });

    describe('activity stability', () => {
      it('should not change activity on single outlier', () => {
        // Establish walking
        for (let i = 0; i < 5; i++) {
          detector.addSpeed(1.5);
        }
        const activityBefore = detector.getCurrentActivity();

        // Add single outlier
        detector.addSpeed(20);

        // Activity should remain stable
        expect(detector.getCurrentActivity()).toBe(activityBefore);
      });

      it('should change activity after sustained speed change', () => {
        // Establish walking
        for (let i = 0; i < 5; i++) {
          detector.addSpeed(1.5);
        }

        // Sustained high speed
        for (let i = 0; i < 10; i++) {
          detector.addSpeed(15);
        }

        expect(detector.getCurrentActivity()).toBe('driving');
      });
    });

    describe('edge cases', () => {
      it('should handle zero speed as stationary', () => {
        detector.addSpeed(0);
        expect(detector.getCurrentActivity()).toBe('stationary');
      });

      it('should handle very high speeds', () => {
        for (let i = 0; i < 10; i++) {
          detector.addSpeed(100);
        }
        expect(detector.getCurrentActivity()).toBe('driving');
      });

      it('should handle decimal speeds', () => {
        detector.addSpeed(2.5);
        detector.addSpeed(2.7);
        detector.addSpeed(2.3);
        expect(detector.getAverageSpeed()).toBeCloseTo(2.5, 1);
      });
    });
  });
});
