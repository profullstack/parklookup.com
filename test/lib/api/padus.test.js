/**
 * Local Parks API Client Tests
 *
 * Tests for the OpenStreetMap Overpass API client for local parks
 * Note: Originally PAD-US, now uses OpenStreetMap Overpass API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OVERPASS_API_URL,
  MANAGER_TYPES,
  ACCESS_TYPES,
  buildQueryParams,
  parseFeature,
  generateSlug,
} from '@/lib/api/padus.js';

describe('Local Parks API Client (Overpass)', () => {
  describe('Constants', () => {
    it('should export the Overpass API URL', () => {
      expect(typeof OVERPASS_API_URL).toBe('string');
      expect(OVERPASS_API_URL).toContain('overpass');
    });

    it('should export manager types for filtering', () => {
      expect(typeof MANAGER_TYPES).toBe('object');
      expect(MANAGER_TYPES.COUNTY).toBe('CNTY');
      expect(MANAGER_TYPES.LOCAL).toBe('LOC');
      expect(MANAGER_TYPES.CITY).toBe('CITY');
      expect(MANAGER_TYPES.REGIONAL).toBe('REG');
    });

    it('should export access types for filtering', () => {
      expect(typeof ACCESS_TYPES).toBe('object');
      expect(ACCESS_TYPES.OPEN).toBe('OA');
      expect(ACCESS_TYPES.RESTRICTED).toBe('RA');
      expect(ACCESS_TYPES.UNKNOWN).toBe('UK');
    });
  });

  describe('generateSlug', () => {
    it('should convert name to lowercase slug', () => {
      expect(generateSlug('Central Park')).toBe('central-park');
    });

    it('should handle special characters', () => {
      expect(generateSlug("O'Brien's Park")).toBe('obriens-park');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('Big   Open   Space')).toBe('big-open-space');
    });

    it('should handle leading/trailing spaces', () => {
      expect(generateSlug('  Park Name  ')).toBe('park-name');
    });

    it('should handle numbers', () => {
      expect(generateSlug('Park 123')).toBe('park-123');
    });

    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(generateSlug(null)).toBe('');
      expect(generateSlug(undefined)).toBe('');
    });
  });

  describe('buildQueryParams', () => {
    it('should build default query params', () => {
      const params = buildQueryParams();
      expect(params).toContain('f=geojson');
      expect(params).toContain('outFields=*');
      expect(params).toContain('resultRecordCount=1000');
    });

    it('should include where clause for manager types', () => {
      const params = buildQueryParams({
        managerTypes: ['CNTY', 'LOC'],
      });
      expect(params).toContain('Mang_Type');
      expect(params).toContain('CNTY');
      expect(params).toContain('LOC');
    });

    it('should include where clause for access type', () => {
      const params = buildQueryParams({
        accessType: 'OA',
      });
      expect(params).toContain('Access');
      expect(params).toContain('OA');
    });

    it('should include state filter', () => {
      const params = buildQueryParams({
        stateCode: 'CA',
      });
      expect(params).toContain('State_Nm');
      expect(params).toContain('CA');
    });

    it('should handle pagination offset', () => {
      const params = buildQueryParams({
        offset: 1000,
      });
      expect(params).toContain('resultOffset=1000');
    });

    it('should handle custom limit', () => {
      const params = buildQueryParams({
        limit: 500,
      });
      expect(params).toContain('resultRecordCount=500');
    });
  });

  describe('parseFeature', () => {
    const mockFeature = {
      type: 'Feature',
      properties: {
        Unit_Nm: 'Test County Park',
        Mang_Name: 'Test County Parks Department',
        Mang_Type: 'CNTY',
        State_Nm: 'CA',
        Access: 'OA',
        OBJECTID: 12345,
        GIS_Acres: 150.5,
      },
      geometry: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749],
      },
    };

    it('should parse feature name', () => {
      const result = parseFeature(mockFeature);
      expect(result.name).toBe('Test County Park');
    });

    it('should generate slug from name', () => {
      const result = parseFeature(mockFeature);
      expect(result.slug).toBe('test-county-park');
    });

    it('should parse managing agency', () => {
      const result = parseFeature(mockFeature);
      expect(result.managing_agency).toBe('Test County Parks Department');
    });

    it('should map manager type to park_type', () => {
      const result = parseFeature(mockFeature);
      expect(result.park_type).toBe('county');

      const cityFeature = { ...mockFeature, properties: { ...mockFeature.properties, Mang_Type: 'CITY' } };
      const cityResult = parseFeature(cityFeature);
      expect(cityResult.park_type).toBe('city');

      const localFeature = { ...mockFeature, properties: { ...mockFeature.properties, Mang_Type: 'LOC' } };
      const localResult = parseFeature(localFeature);
      expect(localResult.park_type).toBe('municipal');

      const regFeature = { ...mockFeature, properties: { ...mockFeature.properties, Mang_Type: 'REG' } };
      const regResult = parseFeature(regFeature);
      expect(regResult.park_type).toBe('regional');
    });

    it('should parse state code', () => {
      const result = parseFeature(mockFeature);
      expect(result.state_code).toBe('CA');
    });

    it('should map access type', () => {
      const result = parseFeature(mockFeature);
      expect(result.access).toBe('Open');

      const restrictedFeature = { ...mockFeature, properties: { ...mockFeature.properties, Access: 'RA' } };
      const restrictedResult = parseFeature(restrictedFeature);
      expect(restrictedResult.access).toBe('Restricted');

      const unknownFeature = { ...mockFeature, properties: { ...mockFeature.properties, Access: 'UK' } };
      const unknownResult = parseFeature(unknownFeature);
      expect(unknownResult.access).toBe('Unknown');
    });

    it('should extract coordinates from Point geometry', () => {
      const result = parseFeature(mockFeature);
      expect(result.longitude).toBe(-122.4194);
      expect(result.latitude).toBe(37.7749);
    });

    it('should extract centroid from Polygon geometry', () => {
      const polygonFeature = {
        ...mockFeature,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.5, 37.8],
            [-122.4, 37.8],
            [-122.4, 37.7],
            [-122.5, 37.7],
            [-122.5, 37.8],
          ]],
        },
      };
      const result = parseFeature(polygonFeature);
      expect(result.longitude).toBeCloseTo(-122.45, 1);
      expect(result.latitude).toBeCloseTo(37.75, 1);
    });

    it('should store PAD-US ID', () => {
      const result = parseFeature(mockFeature);
      expect(result.padus_id).toBe('12345');
    });

    it('should store raw data', () => {
      const result = parseFeature(mockFeature);
      expect(result.raw_data).toEqual(mockFeature.properties);
    });

    it('should handle missing properties gracefully', () => {
      const minimalFeature = {
        type: 'Feature',
        properties: {
          Unit_Nm: 'Minimal Park',
        },
        geometry: null,
      };
      const result = parseFeature(minimalFeature);
      expect(result.name).toBe('Minimal Park');
      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
      expect(result.access).toBe('Unknown');
    });
  });

  describe('fetchParks (integration)', () => {
    // These tests require network access - skip in CI
    it.skip('should fetch parks from PAD-US API', async () => {
      const { fetchParks } = await import('@/lib/api/padus.js');
      const result = await fetchParks({
        managerTypes: [MANAGER_TYPES.COUNTY],
        accessType: ACCESS_TYPES.OPEN,
        stateCode: 'CA',
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('name');
        expect(result[0]).toHaveProperty('slug');
        expect(result[0]).toHaveProperty('park_type');
        expect(result[0]).toHaveProperty('state_code');
      }
    });
  });

  describe('fetchParksByState (integration)', () => {
    it.skip('should fetch all parks for a state', async () => {
      const { fetchParksByState } = await import('@/lib/api/padus.js');
      const result = await fetchParksByState('WY', {
        managerTypes: [MANAGER_TYPES.COUNTY, MANAGER_TYPES.CITY],
        accessType: ACCESS_TYPES.OPEN,
      });

      expect(Array.isArray(result)).toBe(true);
      result.forEach((park) => {
        expect(park.state_code).toBe('WY');
      });
    });
  });
});