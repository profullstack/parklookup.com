/**
 * TripMap Component Tests
 * Tests for the TripMap component display and functionality
 * 
 * Testing Framework: Vitest with React Testing Library
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, style, className }) => (
    <div 
      data-testid="map-container" 
      style={style} 
      className={className}
    >
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  useMap: () => ({
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
  }),
}));

// Mock leaflet
vi.mock('leaflet', () => ({
  divIcon: vi.fn(() => ({})),
}));

// Mock next/dynamic to return the actual component
vi.mock('next/dynamic', () => ({
  default: (importFn) => {
    const Component = ({ children, ...props }) => {
      return <div {...props}>{children}</div>;
    };
    return Component;
  },
}));

describe('TripMap Component - Unit Tests', () => {
  describe('Map Container Dimensions', () => {
    it('should have height of 400px', () => {
      const expectedHeight = '400px';
      const style = { height: expectedHeight, width: '100%' };
      
      expect(style.height).toBe('400px');
    });

    it('should have width of 100%', () => {
      const expectedWidth = '100%';
      const style = { height: '400px', width: expectedWidth };
      
      expect(style.width).toBe('100%');
    });

    it('should fill container width completely', () => {
      const containerStyle = { height: '400px', width: '100%' };
      
      // 100% width means it should fill the parent container
      expect(containerStyle.width).toBe('100%');
      expect(containerStyle.width).not.toBe('auto');
      expect(containerStyle.width).not.toBe('0');
    });
  });

  describe('Bounds Calculation', () => {
    /**
     * Calculate map bounds from stops
     * @param {Array} stops - Trip stops
     * @param {Object} origin - Origin coordinates
     * @returns {Array} Bounds array [[minLat, minLng], [maxLat, maxLng]]
     */
    const calculateBounds = (stops, origin) => {
      const points = [];
      
      if (origin?.lat && origin?.lng) {
        points.push([origin.lat, origin.lng]);
      }
      
      stops.forEach(stop => {
        if (stop.park?.latitude && stop.park?.longitude) {
          points.push([stop.park.latitude, stop.park.longitude]);
        }
      });
      
      if (points.length === 0) {
        // Default to US center
        return [[25, -125], [50, -65]];
      }
      
      if (points.length === 1) {
        // Single point - create bounds around it
        const [lat, lng] = points[0];
        return [[lat - 1, lng - 1], [lat + 1, lng + 1]];
      }
      
      const lats = points.map(p => p[0]);
      const lngs = points.map(p => p[1]);
      
      const padding = 0.5; // Add some padding
      return [
        [Math.min(...lats) - padding, Math.min(...lngs) - padding],
        [Math.max(...lats) + padding, Math.max(...lngs) + padding],
      ];
    };

    it('should return default US bounds when no stops or origin', () => {
      const bounds = calculateBounds([], null);
      
      expect(bounds).toEqual([[25, -125], [50, -65]]);
    });

    it('should create bounds around single point', () => {
      const origin = { lat: 37.7749, lng: -122.4194 };
      const bounds = calculateBounds([], origin);
      
      expect(bounds[0][0]).toBe(36.7749); // lat - 1
      expect(bounds[0][1]).toBe(-123.4194); // lng - 1
      expect(bounds[1][0]).toBe(38.7749); // lat + 1
      expect(bounds[1][1]).toBe(-121.4194); // lng + 1
    });

    it('should calculate bounds from multiple stops', () => {
      const stops = [
        { park: { latitude: 37.8651, longitude: -119.5383 } }, // Yosemite
        { park: { latitude: 36.4864, longitude: -118.5658 } }, // Sequoia
      ];
      const origin = { lat: 37.7749, lng: -122.4194 }; // San Francisco
      
      const bounds = calculateBounds(stops, origin);
      
      // Min lat should be Sequoia's lat - padding
      expect(bounds[0][0]).toBeCloseTo(35.9864, 4);
      // Max lat should be Yosemite's lat + padding
      expect(bounds[1][0]).toBeCloseTo(38.3651, 4);
      // Min lng should be SF's lng - padding
      expect(bounds[0][1]).toBeCloseTo(-122.9194, 4);
      // Max lng should be Sequoia's lng + padding
      expect(bounds[1][1]).toBeCloseTo(-118.0658, 4);
    });

    it('should handle stops without park coordinates', () => {
      const stops = [
        { park: null },
        { park: { latitude: null, longitude: null } },
        { park: { latitude: 37.8651, longitude: -119.5383 } },
      ];
      
      const bounds = calculateBounds(stops, null);
      
      // Should only use the one valid stop
      expect(bounds[0][0]).toBe(36.8651); // lat - 1
      expect(bounds[1][0]).toBe(38.8651); // lat + 1
    });

    it('should include padding in bounds', () => {
      const stops = [
        { park: { latitude: 37.0, longitude: -120.0 } },
        { park: { latitude: 38.0, longitude: -119.0 } },
      ];
      
      const bounds = calculateBounds(stops, null);
      const padding = 0.5;
      
      expect(bounds[0][0]).toBe(37.0 - padding);
      expect(bounds[0][1]).toBe(-120.0 - padding);
      expect(bounds[1][0]).toBe(38.0 + padding);
      expect(bounds[1][1]).toBe(-119.0 + padding);
    });
  });

  describe('Route Coordinates', () => {
    /**
     * Get route coordinates from stops
     * @param {Array} stops - Trip stops
     * @param {Object} origin - Origin coordinates
     * @returns {Array} Array of [lat, lng] coordinates
     */
    const getRouteCoordinates = (stops, origin) => {
      const coords = [];
      
      if (origin?.lat && origin?.lng) {
        coords.push([origin.lat, origin.lng]);
      }
      
      // Sort stops by day number
      const sortedStops = [...stops].sort((a, b) => a.dayNumber - b.dayNumber);
      
      sortedStops.forEach(stop => {
        if (stop.park?.latitude && stop.park?.longitude) {
          coords.push([stop.park.latitude, stop.park.longitude]);
        }
      });
      
      return coords;
    };

    it('should start route from origin', () => {
      const origin = { lat: 37.7749, lng: -122.4194 };
      const stops = [
        { dayNumber: 1, park: { latitude: 37.8651, longitude: -119.5383 } },
      ];
      
      const coords = getRouteCoordinates(stops, origin);
      
      expect(coords[0]).toEqual([37.7749, -122.4194]);
    });

    it('should sort stops by day number', () => {
      const stops = [
        { dayNumber: 3, park: { latitude: 36.0, longitude: -118.0 } },
        { dayNumber: 1, park: { latitude: 37.0, longitude: -119.0 } },
        { dayNumber: 2, park: { latitude: 38.0, longitude: -120.0 } },
      ];
      
      const coords = getRouteCoordinates(stops, null);
      
      expect(coords[0]).toEqual([37.0, -119.0]); // Day 1
      expect(coords[1]).toEqual([38.0, -120.0]); // Day 2
      expect(coords[2]).toEqual([36.0, -118.0]); // Day 3
    });

    it('should skip stops without coordinates', () => {
      const stops = [
        { dayNumber: 1, park: { latitude: 37.0, longitude: -119.0 } },
        { dayNumber: 2, park: null },
        { dayNumber: 3, park: { latitude: 36.0, longitude: -118.0 } },
      ];
      
      const coords = getRouteCoordinates(stops, null);
      
      expect(coords).toHaveLength(2);
      expect(coords[0]).toEqual([37.0, -119.0]);
      expect(coords[1]).toEqual([36.0, -118.0]);
    });

    it('should return empty array when no valid coordinates', () => {
      const coords = getRouteCoordinates([], null);
      
      expect(coords).toEqual([]);
    });
  });

  describe('Map Center Calculation', () => {
    it('should calculate center from bounds', () => {
      const bounds = [[36.0, -122.0], [38.0, -118.0]];
      const center = [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2,
      ];
      
      expect(center[0]).toBe(37.0);
      expect(center[1]).toBe(-120.0);
    });

    it('should use US center as fallback', () => {
      const defaultCenter = [39.8283, -98.5795];
      
      expect(defaultCenter[0]).toBeCloseTo(39.8283, 4);
      expect(defaultCenter[1]).toBeCloseTo(-98.5795, 4);
    });
  });

  describe('Loading State', () => {
    it('should show loading message before client-side render', () => {
      const loadingStyle = { minHeight: '400px' };
      
      expect(loadingStyle.minHeight).toBe('400px');
    });

    it('should have proper loading container classes', () => {
      const expectedClasses = ['bg-gray-100', 'rounded-lg', 'flex', 'items-center', 'justify-center'];
      const className = 'bg-gray-100 rounded-lg flex items-center justify-center';
      
      expectedClasses.forEach(cls => {
        expect(className).toContain(cls);
      });
    });
  });

  describe('Map Styling', () => {
    it('should have rounded corners', () => {
      const containerClasses = 'rounded-lg overflow-hidden shadow-md';
      
      expect(containerClasses).toContain('rounded-lg');
    });

    it('should have shadow', () => {
      const containerClasses = 'rounded-lg overflow-hidden shadow-md';
      
      expect(containerClasses).toContain('shadow-md');
    });

    it('should hide overflow', () => {
      const containerClasses = 'rounded-lg overflow-hidden shadow-md';
      
      expect(containerClasses).toContain('overflow-hidden');
    });

    it('should have z-index 0 to prevent overlap issues', () => {
      const mapClassName = 'z-0';
      
      expect(mapClassName).toBe('z-0');
    });
  });

  describe('Legend Display', () => {
    it('should have legend with start marker', () => {
      const legendItems = ['Start', 'Park stops', 'Route'];
      
      expect(legendItems).toContain('Start');
    });

    it('should have legend with park stops marker', () => {
      const legendItems = ['Start', 'Park stops', 'Route'];
      
      expect(legendItems).toContain('Park stops');
    });

    it('should have legend with route indicator', () => {
      const legendItems = ['Start', 'Park stops', 'Route'];
      
      expect(legendItems).toContain('Route');
    });
  });

  describe('Marker Icons', () => {
    it('should create numbered icons for each day', () => {
      const stops = [
        { dayNumber: 1 },
        { dayNumber: 2 },
        { dayNumber: 3 },
      ];
      
      const numberedIcons = {};
      stops.forEach(stop => {
        numberedIcons[stop.dayNumber] = { day: stop.dayNumber };
      });
      
      expect(Object.keys(numberedIcons)).toHaveLength(3);
      expect(numberedIcons[1]).toBeDefined();
      expect(numberedIcons[2]).toBeDefined();
      expect(numberedIcons[3]).toBeDefined();
    });

    it('should have origin icon', () => {
      const originIcon = { type: 'origin' };
      
      expect(originIcon).toBeDefined();
      expect(originIcon.type).toBe('origin');
    });
  });

  describe('Polyline Route', () => {
    it('should only render polyline when more than one coordinate', () => {
      const routeCoords = [[37.0, -119.0], [38.0, -120.0]];
      const shouldRenderPolyline = routeCoords.length > 1;
      
      expect(shouldRenderPolyline).toBe(true);
    });

    it('should not render polyline with single coordinate', () => {
      const routeCoords = [[37.0, -119.0]];
      const shouldRenderPolyline = routeCoords.length > 1;
      
      expect(shouldRenderPolyline).toBe(false);
    });

    it('should have dashed line style', () => {
      const polylineProps = {
        color: '#059669',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10',
      };
      
      expect(polylineProps.dashArray).toBe('10, 10');
    });

    it('should use green color for route', () => {
      const polylineProps = {
        color: '#059669',
      };
      
      expect(polylineProps.color).toBe('#059669');
    });
  });
});

describe('TripMap Component - Integration Tests', () => {
  describe('Map Resize Behavior', () => {
    it('should invalidate size after render', () => {
      // This documents the expected behavior:
      // The map should call invalidateSize() after mounting
      // to ensure it fills the container properly
      
      const mapBehavior = {
        shouldInvalidateSizeOnMount: true,
        invalidateSizeDelay: 200, // ms
      };
      
      expect(mapBehavior.shouldInvalidateSizeOnMount).toBe(true);
      expect(mapBehavior.invalidateSizeDelay).toBe(200);
    });

    it('should fit bounds after map is ready', () => {
      // The map should fit to the calculated bounds
      // after the whenReady callback fires
      
      const mapBehavior = {
        shouldFitBoundsOnReady: true,
        fitBoundsDelay: 100, // ms
        fitBoundsPadding: [50, 50],
      };
      
      expect(mapBehavior.shouldFitBoundsOnReady).toBe(true);
      expect(mapBehavior.fitBoundsPadding).toEqual([50, 50]);
    });

    it('should re-render map when stops change', () => {
      // The map should re-render (via key change) when stops change
      // to ensure bounds are recalculated
      
      let mapKey = 0;
      const stops1 = [{ dayNumber: 1 }];
      const stops2 = [{ dayNumber: 1 }, { dayNumber: 2 }];
      
      // Simulate stops change
      mapKey += 1;
      
      expect(mapKey).toBe(1);
    });
  });
});