/**
 * Tests for Track Statistics Module
 *
 * @module test/lib/tracking/track-stats.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateTotalDistance,
  calculateElevationStats,
  calculateSpeedStats,
  calculateDuration,
  calculateBounds,
  calculateTrackStats,
  formatDistance,
  formatDuration,
  formatSpeed,
  formatElevation,
  formatPace,
  buildGeoJSON,
  simplifyTrack,
} from '../../../lib/tracking/track-stats.js';

describe('Track Statistics Module', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points using Haversine formula', () => {
      // San Francisco to Los Angeles (approximately 559 km)
      const distance = calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);

      // Should be approximately 559 km (559000 meters)
      expect(distance).toBeGreaterThan(550000);
      expect(distance).toBeLessThan(570000);
    });

    it('should return 0 for same point', () => {
      expect(calculateDistance(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
    });

    it('should handle points at equator', () => {
      // 1 degree at equator is approximately 111 km
      const distance = calculateDistance(0, 0, 0, 1);

      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });

    it('should handle points at poles', () => {
      // Near north pole
      const distance = calculateDistance(89, 0, 89, 180);

      // Distance should be small near poles
      expect(distance).toBeLessThan(250000);
    });

    it('should handle negative coordinates', () => {
      // Sydney to Melbourne (approximately 714 km)
      const distance = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);

      // Approximately 714 km
      expect(distance).toBeGreaterThan(700000);
      expect(distance).toBeLessThan(730000);
    });
  });

  describe('calculateTotalDistance', () => {
    it('should return 0 for empty array', () => {
      expect(calculateTotalDistance([])).toBe(0);
    });

    it('should return 0 for single point', () => {
      const points = [{ latitude: 37.7749, longitude: -122.4194 }];
      expect(calculateTotalDistance(points)).toBe(0);
    });

    it('should handle two points', () => {
      const points = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7850, longitude: -122.4094 },
      ];

      const totalDistance = calculateTotalDistance(points);
      const directDistance = calculateDistance(37.7749, -122.4194, 37.7850, -122.4094);

      expect(totalDistance).toBeCloseTo(directDistance, 2);
    });

    it('should sum distances correctly', () => {
      const points = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 38.0, longitude: -122.0 },
        { latitude: 38.5, longitude: -121.5 },
      ];

      const totalDistance = calculateTotalDistance(points);
      const segment1 = calculateDistance(37.7749, -122.4194, 38.0, -122.0);
      const segment2 = calculateDistance(38.0, -122.0, 38.5, -121.5);

      expect(totalDistance).toBeCloseTo(segment1 + segment2, 0);
    });

    it('should handle lat/lng property names', () => {
      const points = [
        { lat: 37.7749, lng: -122.4194 },
        { lat: 37.7850, lng: -122.4094 },
      ];

      const totalDistance = calculateTotalDistance(points);
      expect(totalDistance).toBeGreaterThan(0);
    });
  });

  describe('calculateElevationStats', () => {
    it('should calculate total elevation gain', () => {
      const points = [
        { altitude_m: 100 },
        { altitude_m: 150 },
        { altitude_m: 120 },
        { altitude_m: 200 },
      ];

      const stats = calculateElevationStats(points);

      // 50 (100->150) + 80 (120->200) = 130
      expect(stats.gain).toBe(130);
    });

    it('should calculate total elevation loss', () => {
      const points = [
        { altitude_m: 200 },
        { altitude_m: 150 },
        { altitude_m: 180 },
        { altitude_m: 100 },
      ];

      const stats = calculateElevationStats(points);

      // 50 (200->150) + 80 (180->100) = 130
      expect(stats.loss).toBe(130);
    });

    it('should return 0 for flat terrain', () => {
      const points = [{ altitude_m: 100 }, { altitude_m: 100 }, { altitude_m: 100 }];

      const stats = calculateElevationStats(points);
      expect(stats.gain).toBe(0);
      expect(stats.loss).toBe(0);
    });

    it('should handle missing altitude data', () => {
      const points = [{ altitude_m: 100 }, { altitude_m: null }, { altitude_m: 150 }];

      const stats = calculateElevationStats(points);
      expect(stats.gain).toBeGreaterThanOrEqual(0);
    });

    it('should return zeros for empty array', () => {
      const stats = calculateElevationStats([]);
      expect(stats.gain).toBe(0);
      expect(stats.loss).toBe(0);
      expect(stats.min).toBeNull();
      expect(stats.max).toBeNull();
    });

    it('should calculate min and max elevation', () => {
      const points = [{ altitude_m: 100 }, { altitude_m: 200 }, { altitude_m: 50 }, { altitude_m: 150 }];

      const stats = calculateElevationStats(points);
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(200);
    });
  });

  describe('calculateSpeedStats', () => {
    it('should calculate average speed from points with speed data', () => {
      const points = [{ speed_mps: 2 }, { speed_mps: 4 }, { speed_mps: 6 }];

      const stats = calculateSpeedStats(points);
      expect(stats.avg).toBe(4);
    });

    it('should ignore zero speeds', () => {
      const points = [{ speed_mps: 0 }, { speed_mps: 4 }, { speed_mps: 6 }];

      const stats = calculateSpeedStats(points);
      expect(stats.avg).toBe(5);
    });

    it('should return 0 for empty array', () => {
      const stats = calculateSpeedStats([]);
      expect(stats.avg).toBe(0);
      expect(stats.max).toBe(0);
    });

    it('should handle missing speed data', () => {
      const points = [{ speed_mps: 4 }, { speed_mps: null }, { speed_mps: 6 }];

      const stats = calculateSpeedStats(points);
      expect(stats.avg).toBe(5);
    });

    it('should find maximum speed', () => {
      const points = [{ speed_mps: 2 }, { speed_mps: 8 }, { speed_mps: 4 }];

      const stats = calculateSpeedStats(points);
      expect(stats.max).toBe(8);
    });

    it('should find minimum speed', () => {
      const points = [{ speed_mps: 2 }, { speed_mps: 8 }, { speed_mps: 4 }];

      const stats = calculateSpeedStats(points);
      expect(stats.min).toBe(2);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration from timestamps', () => {
      const points = [
        { recorded_at: '2024-01-01T10:00:00Z' },
        { recorded_at: '2024-01-01T10:30:00Z' },
        { recorded_at: '2024-01-01T11:00:00Z' },
      ];

      const duration = calculateDuration(points);
      expect(duration).toBe(3600); // 1 hour in seconds
    });

    it('should return 0 for empty array', () => {
      expect(calculateDuration([])).toBe(0);
    });

    it('should return 0 for single point', () => {
      const points = [{ recorded_at: '2024-01-01T10:00:00Z' }];
      expect(calculateDuration(points)).toBe(0);
    });
  });

  describe('calculateBounds', () => {
    it('should calculate bounding box for points', () => {
      const points = [
        { latitude: 37.7, longitude: -122.5 },
        { latitude: 37.8, longitude: -122.4 },
        { latitude: 37.75, longitude: -122.3 },
      ];

      const bounds = calculateBounds(points);

      expect(bounds.minLat).toBe(37.7);
      expect(bounds.maxLat).toBe(37.8);
      expect(bounds.minLng).toBe(-122.5);
      expect(bounds.maxLng).toBe(-122.3);
    });

    it('should return nulls for empty array', () => {
      const bounds = calculateBounds([]);
      expect(bounds.minLat).toBeNull();
      expect(bounds.maxLat).toBeNull();
    });

    it('should handle single point', () => {
      const points = [{ latitude: 37.7, longitude: -122.5 }];
      const bounds = calculateBounds(points);

      expect(bounds.minLat).toBe(37.7);
      expect(bounds.maxLat).toBe(37.7);
      expect(bounds.minLng).toBe(-122.5);
      expect(bounds.maxLng).toBe(-122.5);
    });
  });

  describe('calculateTrackStats', () => {
    it('should calculate all stats for a track', () => {
      const points = [
        { latitude: 37.7749, longitude: -122.4194, altitude_m: 100, speed_mps: 2, recorded_at: '2024-01-01T10:00:00Z' },
        { latitude: 37.7850, longitude: -122.4094, altitude_m: 150, speed_mps: 3, recorded_at: '2024-01-01T10:30:00Z' },
        { latitude: 37.7950, longitude: -122.3994, altitude_m: 120, speed_mps: 2.5, recorded_at: '2024-01-01T11:00:00Z' },
      ];

      const stats = calculateTrackStats(points);

      expect(stats.distanceMeters).toBeGreaterThan(0);
      expect(stats.durationSeconds).toBe(3600);
      expect(stats.elevationGainM).toBeGreaterThan(0);
      expect(stats.avgSpeedMps).toBeGreaterThan(0);
      expect(stats.pointCount).toBe(3);
    });
  });

  describe('formatDistance', () => {
    it('should format meters for short distances', () => {
      expect(formatDistance(100)).toBe('100 m');
      expect(formatDistance(500)).toBe('500 m');
      expect(formatDistance(999)).toBe('999 m');
    });

    it('should format meters as kilometers for long distances', () => {
      expect(formatDistance(1000)).toBe('1.00 km');
      expect(formatDistance(5500)).toBe('5.50 km');
      expect(formatDistance(10000)).toBe('10.00 km');
    });

    it('should handle zero', () => {
      expect(formatDistance(0)).toBe('0 m');
    });

    it('should handle null/undefined', () => {
      expect(formatDistance(null)).toBe('0 m');
      expect(formatDistance(undefined)).toBe('0 m');
    });

    it('should format with appropriate precision', () => {
      expect(formatDistance(1234)).toBe('1.23 km');
      expect(formatDistance(12345)).toBe('12.35 km');
    });

    it('should format in imperial units when specified', () => {
      const result = formatDistance(1609.344, 'imperial');
      expect(result).toContain('mi');
      expect(parseFloat(result)).toBeCloseTo(1, 1);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds as minutes:seconds', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(90)).toBe('1:30');
    });

    it('should format with hours when needed', () => {
      expect(formatDuration(3600)).toBe('1:00:00');
      expect(formatDuration(3661)).toBe('1:01:01');
      expect(formatDuration(7200)).toBe('2:00:00');
    });

    it('should pad minutes and seconds', () => {
      expect(formatDuration(61)).toBe('1:01');
      expect(formatDuration(3601)).toBe('1:00:01');
    });

    it('should handle null/undefined', () => {
      expect(formatDuration(null)).toBe('0:00');
      expect(formatDuration(undefined)).toBe('0:00');
    });
  });

  describe('formatSpeed', () => {
    it('should format speed in km/h by default', () => {
      // 10 m/s = 36 km/h
      const result = formatSpeed(10);
      expect(result).toContain('km/h');
      expect(parseFloat(result)).toBeCloseTo(36, 0);
    });

    it('should format speed in mph when specified', () => {
      // 10 m/s ≈ 22.4 mph
      const result = formatSpeed(10, 'imperial');
      expect(result).toContain('mph');
      expect(parseFloat(result)).toBeCloseTo(22.4, 0);
    });

    it('should handle zero', () => {
      expect(formatSpeed(0)).toBe('0.0 km/h');
    });

    it('should handle null/undefined', () => {
      expect(formatSpeed(null)).toBe('0');
      expect(formatSpeed(undefined)).toBe('0');
    });
  });

  describe('formatElevation', () => {
    it('should format elevation in meters', () => {
      expect(formatElevation(100)).toBe('100 m');
      expect(formatElevation(1500)).toBe('1500 m');
    });

    it('should format elevation in feet when specified', () => {
      // 100 m ≈ 328 ft
      const result = formatElevation(100, 'imperial');
      expect(result).toContain('ft');
      expect(parseInt(result)).toBeCloseTo(328, -1);
    });

    it('should handle zero', () => {
      expect(formatElevation(0)).toBe('0 m');
    });

    it('should handle null/undefined', () => {
      expect(formatElevation(null)).toBe('0');
      expect(formatElevation(undefined)).toBe('0');
    });
  });

  describe('formatPace', () => {
    it('should format pace in min/km by default', () => {
      // 3 m/s = 5:33/km
      const result = formatPace(3);
      expect(result).toContain('/km');
    });

    it('should format pace in min/mi when specified', () => {
      const result = formatPace(3, 'imperial');
      expect(result).toContain('/mi');
    });

    it('should handle zero speed', () => {
      expect(formatPace(0)).toBe('--:--');
    });

    it('should handle null/undefined', () => {
      expect(formatPace(null)).toBe('--:--');
      expect(formatPace(undefined)).toBe('--:--');
    });
  });

  describe('buildGeoJSON', () => {
    it('should convert points to GeoJSON LineString', () => {
      const points = [
        { latitude: 37.7, longitude: -122.5, altitude_m: 100 },
        { latitude: 37.8, longitude: -122.4, altitude_m: 150 },
      ];

      const geojson = buildGeoJSON(points);

      expect(geojson.type).toBe('LineString');
      expect(geojson.coordinates).toHaveLength(2);
      expect(geojson.coordinates[0]).toEqual([-122.5, 37.7, 100]);
    });

    it('should handle points without altitude', () => {
      const points = [
        { latitude: 37.7, longitude: -122.5 },
        { latitude: 37.8, longitude: -122.4 },
      ];

      const geojson = buildGeoJSON(points);

      expect(geojson.coordinates[0]).toHaveLength(2);
    });

    it('should return null for empty array', () => {
      const geojson = buildGeoJSON([]);
      expect(geojson).toBeNull();
    });

    it('should return null for single point', () => {
      const points = [{ latitude: 37.7, longitude: -122.5 }];
      const geojson = buildGeoJSON(points);
      expect(geojson).toBeNull();
    });
  });

  describe('simplifyTrack', () => {
    it('should return same points for small arrays', () => {
      const points = [
        { latitude: 37.7, longitude: -122.5 },
        { latitude: 37.8, longitude: -122.4 },
      ];

      const simplified = simplifyTrack(points);
      expect(simplified).toHaveLength(2);
    });

    it('should reduce number of points', () => {
      // Create a track with many points on a straight line
      const points = [];
      for (let i = 0; i < 100; i++) {
        points.push({
          latitude: 37.7 + i * 0.001,
          longitude: -122.5 + i * 0.001,
        });
      }

      const simplified = simplifyTrack(points, 0.0001);
      expect(simplified.length).toBeLessThan(points.length);
    });

    it('should preserve start and end points', () => {
      const points = [
        { latitude: 37.7, longitude: -122.5 },
        { latitude: 37.75, longitude: -122.45 },
        { latitude: 37.8, longitude: -122.4 },
      ];

      const simplified = simplifyTrack(points);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should handle null/undefined', () => {
      expect(simplifyTrack(null)).toBeNull();
      expect(simplifyTrack(undefined)).toBeUndefined();
    });
  });
});
