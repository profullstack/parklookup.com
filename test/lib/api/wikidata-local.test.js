/**
 * Wikidata Local Parks Matching Service Tests
 *
 * Tests for matching local parks with Wikidata entities and fetching photos
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  buildParkMatchQuery,
  buildPhotoQuery,
  parseWikidataResult,
  parseCommonsImage,
  calculateDistance,
  findBestMatch,
  fetchParkMatch,
  fetchCommonsImages,
} from '../../../lib/api/wikidata-local.js';

describe('Wikidata Local Parks Matching Service', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points in kilometers', () => {
      // San Francisco to Los Angeles (~559 km)
      const distance = calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);
      expect(distance).to.be.closeTo(559, 10);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(distance).to.equal(0);
    });

    it('should handle null coordinates', () => {
      expect(calculateDistance(null, -122.4194, 34.0522, -118.2437)).to.be.null;
      expect(calculateDistance(37.7749, null, 34.0522, -118.2437)).to.be.null;
      expect(calculateDistance(37.7749, -122.4194, null, -118.2437)).to.be.null;
      expect(calculateDistance(37.7749, -122.4194, 34.0522, null)).to.be.null;
    });
  });

  describe('buildParkMatchQuery', () => {
    it('should build a SPARQL query for park matching', () => {
      const query = buildParkMatchQuery({
        name: 'Central Park',
        latitude: 40.7829,
        longitude: -73.9654,
        radiusKm: 10,
      });

      expect(query).to.be.a('string');
      expect(query).to.include('Central Park');
      expect(query).to.include('40.7829');
      expect(query).to.include('-73.9654');
      expect(query).to.include('10'); // radius
    });

    it('should escape special characters in park name', () => {
      const query = buildParkMatchQuery({
        name: "O'Brien's Park & Recreation",
        latitude: 40.0,
        longitude: -74.0,
      });

      expect(query).to.not.include("'Brien");
      expect(query).to.include('OBriens Park');
    });

    it('should use default radius if not specified', () => {
      const query = buildParkMatchQuery({
        name: 'Test Park',
        latitude: 40.0,
        longitude: -74.0,
      });

      expect(query).to.include('5'); // default 5km radius
    });
  });

  describe('buildPhotoQuery', () => {
    it('should build a SPARQL query for fetching photos by Wikidata ID', () => {
      const query = buildPhotoQuery('Q160409');

      expect(query).to.be.a('string');
      expect(query).to.include('Q160409');
      expect(query).to.include('P18'); // image property
      expect(query).to.include('P373'); // Commons category
    });
  });

  describe('parseWikidataResult', () => {
    const mockResult = {
      park: { value: 'http://www.wikidata.org/entity/Q160409' },
      parkLabel: { value: 'Central Park' },
      coord: { value: 'Point(-73.9654 40.7829)' },
      image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Central_Park.jpg' },
      commonsCat: { value: 'Central Park, New York City' },
    };

    it('should parse Wikidata ID from URI', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.wikidata_id).to.equal('Q160409');
    });

    it('should parse park label', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.label).to.equal('Central Park');
    });

    it('should parse coordinates', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.latitude).to.be.closeTo(40.7829, 0.001);
      expect(result.longitude).to.be.closeTo(-73.9654, 0.001);
    });

    it('should parse image URL', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.image_url).to.include('Central_Park.jpg');
    });

    it('should parse Commons category', () => {
      const result = parseWikidataResult(mockResult);
      expect(result.commons_category).to.equal('Central Park, New York City');
    });

    it('should handle missing optional fields', () => {
      const minimalResult = {
        park: { value: 'http://www.wikidata.org/entity/Q12345' },
        parkLabel: { value: 'Test Park' },
      };
      const result = parseWikidataResult(minimalResult);
      expect(result.wikidata_id).to.equal('Q12345');
      expect(result.image_url).to.be.null;
      expect(result.commons_category).to.be.null;
    });
  });

  describe('parseCommonsImage', () => {
    const mockImageInfo = {
      title: 'File:Central Park.jpg',
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Central_Park.jpg',
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Central_Park.jpg/300px-Central_Park.jpg',
          width: 4000,
          height: 3000,
          extmetadata: {
            LicenseShortName: { value: 'CC BY-SA 4.0' },
            Artist: { value: '<a href="...">John Doe</a>' },
          },
        },
      ],
    };

    it('should parse image URL', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.image_url).to.include('Central_Park.jpg');
    });

    it('should parse thumbnail URL', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.thumb_url).to.include('300px');
    });

    it('should parse dimensions', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.width).to.equal(4000);
      expect(result.height).to.equal(3000);
    });

    it('should parse license', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.license).to.equal('CC BY-SA 4.0');
    });

    it('should parse title', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.title).to.equal('Central Park.jpg');
    });

    it('should set source as wikimedia', () => {
      const result = parseCommonsImage(mockImageInfo);
      expect(result.source).to.equal('wikimedia');
    });

    it('should handle missing imageinfo', () => {
      const result = parseCommonsImage({ title: 'File:Test.jpg' });
      expect(result).to.be.null;
    });
  });

  describe('findBestMatch', () => {
    const parkData = {
      name: 'Central Park',
      latitude: 40.7829,
      longitude: -73.9654,
    };

    const candidates = [
      {
        wikidata_id: 'Q160409',
        label: 'Central Park',
        latitude: 40.7829,
        longitude: -73.9654,
      },
      {
        wikidata_id: 'Q12345',
        label: 'Central Park Zoo',
        latitude: 40.7678,
        longitude: -73.9718,
      },
      {
        wikidata_id: 'Q67890',
        label: 'Some Other Park',
        latitude: 41.0,
        longitude: -74.0,
      },
    ];

    it('should return the best matching candidate', () => {
      const match = findBestMatch(parkData, candidates);
      expect(match).to.not.be.null;
      expect(match.wikidata_id).to.equal('Q160409');
    });

    it('should prefer exact name matches', () => {
      const match = findBestMatch(parkData, candidates);
      expect(match.label).to.equal('Central Park');
    });

    it('should return null for empty candidates', () => {
      const match = findBestMatch(parkData, []);
      expect(match).to.be.null;
    });

    it('should return null if no good match found', () => {
      const farPark = {
        name: 'Completely Different Park',
        latitude: 0,
        longitude: 0,
      };
      const match = findBestMatch(farPark, candidates, { maxDistanceKm: 1 });
      expect(match).to.be.null;
    });
  });

  describe('fetchParkMatch (integration)', () => {
    it.skip('should fetch matching Wikidata entity for a park', async () => {
      const result = await fetchParkMatch({
        name: 'Central Park',
        latitude: 40.7829,
        longitude: -73.9654,
      });

      expect(result).to.not.be.null;
      expect(result.wikidata_id).to.equal('Q160409');
    });
  });

  describe('fetchCommonsImages (integration)', () => {
    it.skip('should fetch images from Commons category', async () => {
      const images = await fetchCommonsImages('Central Park, New York City', { limit: 5 });

      expect(images).to.be.an('array');
      expect(images.length).to.be.at.most(5);
      if (images.length > 0) {
        expect(images[0]).to.have.property('image_url');
        expect(images[0]).to.have.property('thumb_url');
        expect(images[0]).to.have.property('license');
      }
    });
  });
});