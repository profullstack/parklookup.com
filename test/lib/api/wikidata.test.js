/**
 * Tests for Wikidata SPARQL data fetcher
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Wikidata SPARQL Fetcher', () => {
  const mockWikidataResponse = {
    results: {
      bindings: [
        {
          park: { type: 'uri', value: 'http://www.wikidata.org/entity/Q180402' },
          parkLabel: { type: 'literal', value: 'Yellowstone National Park' },
          image: {
            type: 'uri',
            value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Grand%20Prismatic%20Spring.jpg',
          },
          stateLabel: { type: 'literal', value: 'Wyoming' },
          coord: { type: 'literal', value: 'Point(-110.5885 44.428)' },
          website: { type: 'uri', value: 'https://www.nps.gov/yell/' },
          area: { type: 'literal', value: '8983.18' },
          areaUnitLabel: { type: 'literal', value: 'square kilometre' },
          elev: { type: 'literal', value: '2400' },
          elevUnitLabel: { type: 'literal', value: 'metre' },
          inception: { type: 'literal', value: '1872-03-01T00:00:00Z' },
          managingOrgLabel: { type: 'literal', value: 'National Park Service' },
          commonsCat: { type: 'literal', value: 'Yellowstone National Park' },
        },
        {
          park: { type: 'uri', value: 'http://www.wikidata.org/entity/Q180544' },
          parkLabel: { type: 'literal', value: 'Yosemite National Park' },
          stateLabel: { type: 'literal', value: 'California' },
          coord: { type: 'literal', value: 'Point(-119.5571873 37.84883288)' },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchWikidataParks', () => {
    it('should fetch parks from Wikidata SPARQL endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWikidataResponse),
      });

      const { fetchWikidataParks } = await import('@/lib/api/wikidata.js');
      const result = await fetchWikidataParks({ limit: 50, offset: 0 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://query.wikidata.org/sparql'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/sparql-results+json',
          }),
        })
      );
      expect(result).toHaveLength(2);
    });

    it('should handle pagination with offset', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWikidataResponse),
      });

      const { fetchWikidataParks } = await import('@/lib/api/wikidata.js');
      await fetchWikidataParks({ limit: 50, offset: 100 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET%20100'),
        expect.any(Object)
      );
    });

    it('should throw error when API returns non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { fetchWikidataParks } = await import('@/lib/api/wikidata.js');

      await expect(fetchWikidataParks()).rejects.toThrow(
        'Wikidata SPARQL error: 500 Internal Server Error'
      );
    });

    it('should throw error when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { fetchWikidataParks } = await import('@/lib/api/wikidata.js');

      await expect(fetchWikidataParks()).rejects.toThrow('Network error');
    });
  });

  describe('fetchAllWikidataParks', () => {
    it('should fetch all parks with pagination', async () => {
      const page1Response = { ...mockWikidataResponse };
      const page2Response = {
        results: {
          bindings: [mockWikidataResponse.results.bindings[0]],
        },
      };
      const emptyResponse = { results: { bindings: [] } };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page1Response),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page2Response),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(emptyResponse),
        });

      const { fetchAllWikidataParks } = await import('@/lib/api/wikidata.js');
      const result = await fetchAllWikidataParks();

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it('should call onProgress callback during pagination', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWikidataResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ results: { bindings: [] } }),
        });

      const onProgress = vi.fn();
      const { fetchAllWikidataParks } = await import('@/lib/api/wikidata.js');
      await fetchAllWikidataParks({ onProgress });

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('parseCoordinates', () => {
    it('should parse Point coordinates correctly', async () => {
      const { parseCoordinates } = await import('@/lib/api/wikidata.js');

      const result = parseCoordinates('Point(-110.5885 44.428)');

      expect(result).toEqual({
        latitude: 44.428,
        longitude: -110.5885,
      });
    });

    it('should return null for invalid coordinates', async () => {
      const { parseCoordinates } = await import('@/lib/api/wikidata.js');

      expect(parseCoordinates(null)).toBeNull();
      expect(parseCoordinates(undefined)).toBeNull();
      expect(parseCoordinates('invalid')).toBeNull();
    });
  });

  describe('extractWikidataId', () => {
    it('should extract Wikidata ID from URI', async () => {
      const { extractWikidataId } = await import('@/lib/api/wikidata.js');

      const result = extractWikidataId('http://www.wikidata.org/entity/Q180402');

      expect(result).toBe('Q180402');
    });

    it('should return empty string for invalid URI', async () => {
      const { extractWikidataId } = await import('@/lib/api/wikidata.js');

      expect(extractWikidataId(null)).toBe('');
      expect(extractWikidataId('')).toBe('');
    });
  });

  describe('transformWikidataResult', () => {
    it('should transform Wikidata SPARQL result to database format', async () => {
      const { transformWikidataResult } = await import('@/lib/api/wikidata.js');
      const transformed = transformWikidataResult(mockWikidataResponse.results.bindings[0]);

      expect(transformed).toEqual({
        wikidata_id: 'Q180402',
        label: 'Yellowstone National Park',
        image_url:
          'http://commons.wikimedia.org/wiki/Special:FilePath/Grand%20Prismatic%20Spring.jpg',
        state: 'Wyoming',
        latitude: 44.428,
        longitude: -110.5885,
        website: 'https://www.nps.gov/yell/',
        area: 8983.18,
        area_unit: 'square kilometre',
        elevation: 2400,
        elevation_unit: 'metre',
        inception: '1872-03-01',
        managing_org: 'National Park Service',
        commons_category: 'Yellowstone National Park',
      });
    });

    it('should handle missing optional fields', async () => {
      const { transformWikidataResult } = await import('@/lib/api/wikidata.js');
      const minimalResult = {
        park: { value: 'http://www.wikidata.org/entity/Q12345' },
        parkLabel: { value: 'Test Park' },
      };

      const transformed = transformWikidataResult(minimalResult);

      expect(transformed.wikidata_id).toBe('Q12345');
      expect(transformed.label).toBe('Test Park');
      expect(transformed.image_url).toBeNull();
      expect(transformed.latitude).toBeNull();
      expect(transformed.longitude).toBeNull();
    });

    it('should parse inception date correctly', async () => {
      const { transformWikidataResult } = await import('@/lib/api/wikidata.js');
      const result = {
        park: { value: 'http://www.wikidata.org/entity/Q12345' },
        parkLabel: { value: 'Test Park' },
        inception: { value: '1872-03-01T00:00:00Z' },
      };

      const transformed = transformWikidataResult(result);

      expect(transformed.inception).toBe('1872-03-01');
    });
  });

  describe('WIKIDATA_SPARQL_ENDPOINT', () => {
    it('should export the correct endpoint URL', async () => {
      const { WIKIDATA_SPARQL_ENDPOINT } = await import('@/lib/api/wikidata.js');

      expect(WIKIDATA_SPARQL_ENDPOINT).toBe('https://query.wikidata.org/sparql');
    });
  });

  describe('PARK_TYPES', () => {
    it('should export park type constants', async () => {
      const { PARK_TYPES } = await import('@/lib/api/wikidata.js');

      expect(PARK_TYPES.NATIONAL_PARK).toBe('Q46169');
      expect(PARK_TYPES.STATE_PARK).toBe('Q15243209');
    });
  });

  describe('buildSparqlQuery', () => {
    it('should build a valid SPARQL query with limit and offset (defaults to " State " name filter)', async () => {
      const { buildSparqlQuery } = await import('@/lib/api/wikidata.js');

      const query = buildSparqlQuery({ limit: 50, offset: 100 });

      expect(query).toContain('LIMIT 50');
      expect(query).toContain('OFFSET 100');
      expect(query).toContain('REGEX(?parkLabel, " State ", "i")'); // Name-based filter with spaces
      expect(query).toContain('wd:Q22698'); // Park base class
      expect(query).toContain('wdt:P17 wd:Q30'); // Country: USA
    });

    it('should allow custom name filters', async () => {
      const { buildSparqlQuery } = await import('@/lib/api/wikidata.js');

      const query = buildSparqlQuery({
        limit: 50,
        offset: 0,
        nameFilter: 'National Park',
      });

      expect(query).toContain('REGEX(?parkLabel, "National Park", "i")');
    });

    it('should use " State " as default name filter to match State Park, State Beach, etc.', async () => {
      const { buildSparqlQuery } = await import('@/lib/api/wikidata.js');

      const query = buildSparqlQuery({ limit: 50, offset: 0 });

      expect(query).toContain(' State '); // Spaces around "State" to avoid matching "Interstate"
    });
  });
});