/**
 * PAD-US API Client Tests
 *
 * Tests for the USGS Protected Areas Database API client
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  PADUS_FEATURE_SERVICE_URL,
  MANAGER_TYPES,
  ACCESS_TYPES,
  buildQueryParams,
  parseFeature,
  generateSlug,
  fetchParks,
  fetchParksByState,
  fetchAllParks,
} from '../../../lib/api/padus.js';

describe('PAD-US API Client', () => {
  describe('Constants', () => {
    it('should export the correct feature service URL', () => {
      expect(PADUS_FEATURE_SERVICE_URL).to.be.a('string');
      expect(PADUS_FEATURE_SERVICE_URL).to.include('arcgis.com');
    });

    it('should export manager types for filtering', () => {
      expect(MANAGER_TYPES).to.be.an('object');
      expect(MANAGER_TYPES.COUNTY).to.equal('CNTY');
      expect(MANAGER_TYPES.LOCAL).to.equal('LOC');
      expect(MANAGER_TYPES.CITY).to.equal('CITY');
      expect(MANAGER_TYPES.REGIONAL).to.equal('REG');
    });

    it('should export access types for filtering', () => {
      expect(ACCESS_TYPES).to.be.an('object');
      expect(ACCESS_TYPES.OPEN).to.equal('OA');
      expect(ACCESS_TYPES.RESTRICTED).to.equal('RA');
      expect(ACCESS_TYPES.UNKNOWN).to.equal('UK');
    });
  });

  describe('generateSlug', () => {
    it('should convert name to lowercase slug', () => {
      expect(generateSlug('Central Park')).to.equal('central-park');
    });

    it('should handle special characters', () => {
      expect(generateSlug("O'Brien's Park")).to.equal('obriens-park');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('Big   Open   Space')).to.equal('big-open-space');
    });

    it('should handle leading/trailing spaces', () => {
      expect(generateSlug('  Park Name  ')).to.equal('park-name');
    });

    it('should handle numbers', () => {
      expect(generateSlug('Park 123')).to.equal('park-123');
    });

    it('should handle empty string', () => {
      expect(generateSlug('')).to.equal('');
    });

    it('should handle null/undefined', () => {
      expect(generateSlug(null)).to.equal('');
      expect(generateSlug(undefined)).to.equal('');
    });
  });

  describe('buildQueryParams', () => {
    it('should build default query params', () => {
      const params = buildQueryParams();
      expect(params).to.include('f=geojson');
      expect(params).to.include('outFields=*');
      expect(params).to.include('resultRecordCount=1000');
    });

    it('should include where clause for manager types', () => {
      const params = buildQueryParams({
        managerTypes: ['CNTY', 'LOC'],
      });
      expect(params).to.include('Mang_Type');
      expect(params).to.include('CNTY');
      expect(params).to.include('LOC');
    });

    it('should include where clause for access type', () => {
      const params = buildQueryParams({
        accessType: 'OA',
      });
      expect(params).to.include('Access');
      expect(params).to.include('OA');
    });

    it('should include state filter', () => {
      const params = buildQueryParams({
        stateCode: 'CA',
      });
      expect(params).to.include('State_Nm');
      expect(params).to.include('CA');
    });

    it('should handle pagination offset', () => {
      const params = buildQueryParams({
        offset: 1000,
      });
      expect(params).to.include('resultOffset=1000');
    });

    it('should handle custom limit', () => {
      const params = buildQueryParams({
        limit: 500,
      });
      expect(params).to.include('resultRecordCount=500');
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
      expect(result.name).to.equal('Test County Park');
    });

    it('should generate slug from name', () => {
      const result = parseFeature(mockFeature);
      expect(result.slug).to.equal('test-county-park');
    });

    it('should parse managing agency', () => {
      const result = parseFeature(mockFeature);
      expect(result.managing_agency).to.equal('Test County Parks Department');
    });

    it('should map manager type to park_type', () => {
      const result = parseFeature(mockFeature);
      expect(result.park_type).to.equal('county');

      const cityFeature = { ...mockFeature, properties: { ...mockFeature.properties, Mang_Type: 'CITY' } };
      const cityResult = parseFeature(cityFeature);
      expect(cityResult.park_type).to.equal('city');

      const localFeature = { ...mockFeature, properties: { ...mockFeature.properties, Mang_Type: 'LOC' } };
      const localResult = parseFeature(localFeature);
      expect(localResult.park_type).to.equal('municipal');

      const regFeature = { ...mockFeature, properties: { ...mockFeature.properties, Mang_Type: 'REG' } };
      const regResult = parseFeature(regFeature);
      expect(regResult.park_type).to.equal('regional');
    });

    it('should parse state code', () => {
      const result = parseFeature(mockFeature);
      expect(result.state_code).to.equal('CA');
    });

    it('should map access type', () => {
      const result = parseFeature(mockFeature);
      expect(result.access).to.equal('Open');

      const restrictedFeature = { ...mockFeature, properties: { ...mockFeature.properties, Access: 'RA' } };
      const restrictedResult = parseFeature(restrictedFeature);
      expect(restrictedResult.access).to.equal('Restricted');

      const unknownFeature = { ...mockFeature, properties: { ...mockFeature.properties, Access: 'UK' } };
      const unknownResult = parseFeature(unknownFeature);
      expect(unknownResult.access).to.equal('Unknown');
    });

    it('should extract coordinates from Point geometry', () => {
      const result = parseFeature(mockFeature);
      expect(result.longitude).to.equal(-122.4194);
      expect(result.latitude).to.equal(37.7749);
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
      expect(result.longitude).to.be.closeTo(-122.45, 0.01);
      expect(result.latitude).to.be.closeTo(37.75, 0.01);
    });

    it('should store PAD-US ID', () => {
      const result = parseFeature(mockFeature);
      expect(result.padus_id).to.equal('12345');
    });

    it('should store raw data', () => {
      const result = parseFeature(mockFeature);
      expect(result.raw_data).to.deep.equal(mockFeature.properties);
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
      expect(result.name).to.equal('Minimal Park');
      expect(result.latitude).to.be.null;
      expect(result.longitude).to.be.null;
      expect(result.access).to.equal('Unknown');
    });
  });

  describe('fetchParks (integration)', () => {
    // These tests require network access - skip in CI if needed
    it.skip('should fetch parks from PAD-US API', async () => {
      const result = await fetchParks({
        managerTypes: [MANAGER_TYPES.COUNTY],
        accessType: ACCESS_TYPES.OPEN,
        stateCode: 'CA',
        limit: 10,
      });

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.most(10);
      if (result.length > 0) {
        expect(result[0]).to.have.property('name');
        expect(result[0]).to.have.property('slug');
        expect(result[0]).to.have.property('park_type');
        expect(result[0]).to.have.property('state_code');
      }
    });
  });

  describe('fetchParksByState (integration)', () => {
    it.skip('should fetch all parks for a state', async () => {
      const result = await fetchParksByState('WY', {
        managerTypes: [MANAGER_TYPES.COUNTY, MANAGER_TYPES.CITY],
        accessType: ACCESS_TYPES.OPEN,
      });

      expect(result).to.be.an('array');
      result.forEach((park) => {
        expect(park.state_code).to.equal('WY');
      });
    });
  });
});