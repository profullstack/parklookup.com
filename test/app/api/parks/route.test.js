/**
 * Tests for Parks API Route
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a chainable mock builder for Supabase queries
const createChainableMock = (finalResult) => {
  const chainable = {
    select: vi.fn(() => chainable),
    from: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    ilike: vi.fn(() => chainable),
    or: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    range: vi.fn(() => Promise.resolve(finalResult)),
    single: vi.fn(() => Promise.resolve(finalResult)),
    textSearch: vi.fn(() => chainable),
    not: vi.fn(() => chainable),
  };
  return chainable;
};

// Default mock data - includes both NPS and Wikidata parks
const mockParksData = {
  data: [
    {
      id: '1',
      park_code: 'yell',
      full_name: 'Yellowstone National Park',
      description: 'First national park',
      states: 'WY,MT,ID',
      latitude: 44.428,
      longitude: -110.5885,
      source: 'nps',
    },
  ],
  error: null,
  count: 1,
};

// Mock data with both NPS and state parks
const mockAllParksData = {
  data: [
    {
      id: '1',
      park_code: 'yell',
      full_name: 'Yellowstone National Park',
      description: 'First national park',
      states: 'WY,MT,ID',
      latitude: 44.428,
      longitude: -110.5885,
      designation: 'National Park',
      source: 'nps',
    },
    {
      id: '2',
      park_code: 'Q123456',
      full_name: 'New Brighton State Beach',
      description: null,
      states: 'California',
      latitude: 36.9783,
      longitude: -121.9386,
      designation: 'State Park',
      source: 'wikidata',
    },
    {
      id: '3',
      park_code: 'Q789012',
      full_name: 'Seacliff State Beach',
      description: null,
      states: 'California',
      latitude: 36.9722,
      longitude: -121.9156,
      designation: 'State Park',
      source: 'wikidata',
    },
  ],
  error: null,
  count: 3,
};

const mockSingleParkData = {
  data: {
    id: '1',
    park_code: 'yell',
    full_name: 'Yellowstone National Park',
  },
  error: null,
};

// Mock Supabase client
let mockSupabaseClient;

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

describe('Parks API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock client before each test
    mockSupabaseClient = {
      from: vi.fn(() => createChainableMock(mockParksData)),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/parks', () => {
    it('should return a list of parks', async () => {
      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
      expect(Array.isArray(data.parks)).toBe(true);
    });

    it('should support pagination with page and limit params', async () => {
      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
    });

    it('should support state filtering', async () => {
      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks?state=CA');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should support search query', async () => {
      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks?q=yellowstone');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle database errors', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() =>
          createChainableMock({
            data: null,
            error: { message: 'Database error' },
            count: 0,
          })
        ),
      };

      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should query all_parks view to include both NPS and state parks', async () => {
      vi.resetModules();
      const fromMock = vi.fn(() => createChainableMock(mockAllParksData));
      mockSupabaseClient = {
        from: fromMock,
      };

      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks');
      await GET(request);

      // Verify it queries the all_parks view
      expect(fromMock).toHaveBeenCalledWith('all_parks');
    });

    it('should return parks with source field indicating origin', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockAllParksData)),
      };

      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.parks).toHaveLength(3);
      // Check that source field is present
      expect(data.parks[0]).toHaveProperty('source');
      expect(data.parks[0].source).toBe('nps');
      expect(data.parks[1].source).toBe('wikidata');
    });

    it('should include state parks from wikidata source', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockAllParksData)),
      };

      const { GET } = await import('@/app/api/parks/route.js');

      const request = new Request('http://localhost:8080/api/parks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Find state parks in results
      const stateParks = data.parks.filter((p) => p.source === 'wikidata');
      expect(stateParks.length).toBeGreaterThan(0);
      expect(stateParks[0].designation).toBe('State Park');
    });
  });

  describe('GET /api/parks/[parkCode]', () => {
      it('should return a single park by park code', async () => {
        vi.resetModules();
        mockSupabaseClient = {
          from: vi.fn(() => createChainableMock(mockSingleParkData)),
        };
  
        const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
        const request = new Request('http://localhost:8080/api/parks/yell');
        const response = await GET(request, { params: { parkCode: 'yell' } });
        const data = await response.json();
  
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('park');
      });
  
      it('should return 404 for non-existent park', async () => {
        vi.resetModules();
        mockSupabaseClient = {
          from: vi.fn(() =>
            createChainableMock({
              data: null,
              error: { code: 'PGRST116' },
            })
          ),
        };
  
        const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
        const request = new Request('http://localhost:8080/api/parks/nonexistent');
        const response = await GET(request, { params: { parkCode: 'nonexistent' } });
  
        expect(response.status).toBe(404);
      });
  
      it('should return 400 if park code is missing', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
        const request = new Request('http://localhost:8080/api/parks/');
        const response = await GET(request, { params: { parkCode: '' } });
  
        expect(response.status).toBe(400);
      });
  
      describe('Image normalization', () => {
        it('should normalize NPS park images with altText', async () => {
          vi.resetModules();
          const npsParkWithImages = {
            data: {
              id: '1',
              park_code: 'yell',
              full_name: 'Yellowstone National Park',
              images: [
                { url: 'https://example.com/image1.jpg', altText: 'Old Faithful' },
                { url: 'https://example.com/image2.jpg', altText: 'Grand Prismatic' },
              ],
              wikidata_image: null,
              source: 'nps',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(npsParkWithImages)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/yell');
          const response = await GET(request, { params: { parkCode: 'yell' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          expect(data.park.images).toHaveLength(2);
          expect(data.park.images[0]).toEqual({
            url: 'https://example.com/image1.jpg',
            altText: 'Old Faithful',
          });
          expect(data.park.images[1]).toEqual({
            url: 'https://example.com/image2.jpg',
            altText: 'Grand Prismatic',
          });
        });
  
        it('should normalize Wikidata park images with title to altText', async () => {
          vi.resetModules();
          const wikidataParkWithImages = {
            data: {
              id: '2',
              park_code: 'Q4648515',
              full_name: 'Big Basin Redwoods State Park',
              images: [{ url: 'https://commons.wikimedia.org/image.jpg', title: 'Big Basin Redwoods State Park' }],
              wikidata_image: 'https://commons.wikimedia.org/image.jpg',
              source: 'wikidata',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(wikidataParkWithImages)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/Q4648515');
          const response = await GET(request, { params: { parkCode: 'Q4648515' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          expect(data.park.images).toHaveLength(1);
          expect(data.park.images[0]).toEqual({
            url: 'https://commons.wikimedia.org/image.jpg',
            altText: 'Big Basin Redwoods State Park',
          });
        });
  
        it('should use wikidata_image when images array is empty', async () => {
          vi.resetModules();
          const parkWithOnlyWikidataImage = {
            data: {
              id: '3',
              park_code: 'Q123456',
              full_name: 'Some State Park',
              images: [],
              wikidata_image: 'https://commons.wikimedia.org/fallback.jpg',
              source: 'wikidata',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(parkWithOnlyWikidataImage)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/Q123456');
          const response = await GET(request, { params: { parkCode: 'Q123456' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          expect(data.park.images).toHaveLength(1);
          expect(data.park.images[0]).toEqual({
            url: 'https://commons.wikimedia.org/fallback.jpg',
            altText: 'Some State Park',
          });
        });
  
        it('should use wikidata_image when images is null', async () => {
          vi.resetModules();
          const parkWithNullImages = {
            data: {
              id: '4',
              park_code: 'Q789012',
              full_name: 'Another State Park',
              images: null,
              wikidata_image: 'https://commons.wikimedia.org/another.jpg',
              source: 'wikidata',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(parkWithNullImages)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/Q789012');
          const response = await GET(request, { params: { parkCode: 'Q789012' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          expect(data.park.images).toHaveLength(1);
          expect(data.park.images[0]).toEqual({
            url: 'https://commons.wikimedia.org/another.jpg',
            altText: 'Another State Park',
          });
        });
  
        it('should return empty array when no images and no wikidata_image', async () => {
          vi.resetModules();
          const parkWithNoImages = {
            data: {
              id: '5',
              park_code: 'noimg',
              full_name: 'Park Without Images',
              images: null,
              wikidata_image: null,
              source: 'nps',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(parkWithNoImages)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/noimg');
          const response = await GET(request, { params: { parkCode: 'noimg' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          expect(data.park.images).toHaveLength(0);
        });
  
        it('should fallback to park name when image has no altText or title', async () => {
          vi.resetModules();
          const parkWithImageNoAlt = {
            data: {
              id: '6',
              park_code: 'test',
              full_name: 'Test National Park',
              images: [{ url: 'https://example.com/image.jpg' }],
              wikidata_image: null,
              source: 'nps',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(parkWithImageNoAlt)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/test');
          const response = await GET(request, { params: { parkCode: 'test' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          expect(data.park.images).toHaveLength(1);
          expect(data.park.images[0]).toEqual({
            url: 'https://example.com/image.jpg',
            altText: 'Test National Park',
          });
        });
  
        it('should skip images without url', async () => {
          vi.resetModules();
          const parkWithInvalidImages = {
            data: {
              id: '7',
              park_code: 'invalid',
              full_name: 'Park With Invalid Images',
              images: [
                { url: 'https://example.com/valid.jpg', altText: 'Valid' },
                { altText: 'No URL' },
                null,
                { url: '', altText: 'Empty URL' },
              ],
              wikidata_image: null,
              source: 'nps',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(parkWithInvalidImages)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/invalid');
          const response = await GET(request, { params: { parkCode: 'invalid' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          // Should only include the valid image
          expect(data.park.images).toHaveLength(1);
          expect(data.park.images[0].url).toBe('https://example.com/valid.jpg');
        });
  
        it('should prefer altText over title when both exist', async () => {
          vi.resetModules();
          const parkWithBothAltAndTitle = {
            data: {
              id: '8',
              park_code: 'both',
              full_name: 'Park With Both',
              images: [{ url: 'https://example.com/image.jpg', altText: 'Alt Text', title: 'Title Text' }],
              wikidata_image: null,
              source: 'nps',
            },
            error: null,
          };
          mockSupabaseClient = {
            from: vi.fn(() => createChainableMock(parkWithBothAltAndTitle)),
          };
  
          const { GET } = await import('@/app/api/parks/[parkCode]/route.js');
  
          const request = new Request('http://localhost:8080/api/parks/both');
          const response = await GET(request, { params: { parkCode: 'both' } });
          const data = await response.json();
  
          expect(response.status).toBe(200);
          expect(data.park.images[0].altText).toBe('Alt Text');
        });
      });
    });
});

describe('Parks Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      from: vi.fn(() => createChainableMock(mockParksData)),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/parks/search', () => {
    it('should search parks by query', async () => {
      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?q=canyon');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
    });

    it('should return all parks if no query provided', async () => {
      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
      expect(data).toHaveProperty('total');
    });

    it('should return all parks if query is empty', async () => {
      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?q=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
      expect(data).toHaveProperty('total');
    });

    it('should support state filtering', async () => {
      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?state=CA');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
      expect(data.state).toBe('CA');
    });

    it('should query all_parks view for search', async () => {
      vi.resetModules();
      const fromMock = vi.fn(() => createChainableMock(mockAllParksData));
      mockSupabaseClient = {
        from: fromMock,
      };

      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?q=beach');
      await GET(request);

      // Verify it queries the all_parks view
      expect(fromMock).toHaveBeenCalledWith('all_parks');
    });

    it('should find state parks by name', async () => {
      vi.resetModules();
      // Mock data for state beach search
      const stateBeachData = {
        data: [
          {
            id: '2',
            park_code: 'Q123456',
            full_name: 'New Brighton State Beach',
            description: null,
            states: 'California',
            latitude: 36.9783,
            longitude: -121.9386,
            designation: 'State Park',
            source: 'wikidata',
          },
        ],
        error: null,
        count: 1,
      };
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(stateBeachData)),
      };

      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?q=newbrighton');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.parks).toHaveLength(1);
      expect(data.parks[0].full_name).toBe('New Brighton State Beach');
      expect(data.parks[0].source).toBe('wikidata');
    });

    it('should return source field in search results', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockAllParksData)),
      };

      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // All parks should have source field
      data.parks.forEach((park) => {
        expect(park).toHaveProperty('source');
        expect(['nps', 'wikidata']).toContain(park.source);
      });
    });

    it('should support hasImages parameter to filter parks with images', async () => {
      vi.resetModules();
      // Mock data with parks that have images and some without
      const parksWithMixedImages = {
        data: [
          {
            id: '1',
            park_code: 'yell',
            full_name: 'Yellowstone National Park',
            images: [{ url: 'https://example.com/yellowstone.jpg', title: 'Yellowstone' }],
            wikidata_image: null,
            source: 'nps',
          },
          {
            id: '2',
            park_code: 'noimg',
            full_name: 'Park Without Image',
            images: null,
            wikidata_image: null,
            source: 'nps',
          },
          {
            id: '3',
            park_code: 'emptyimg',
            full_name: 'Park With Empty Images',
            images: [],
            wikidata_image: null,
            source: 'nps',
          },
          {
            id: '4',
            park_code: 'wiki1',
            full_name: 'State Park With Wikidata Image',
            images: null,
            wikidata_image: 'https://example.com/wikidata.jpg',
            source: 'wikidata',
          },
        ],
        error: null,
        count: 4,
      };
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(parksWithMixedImages)),
      };

      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?hasImages=true&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasImages).toBe(true);
      // Should only return parks with valid images
      expect(data.parks.length).toBe(2);
      // Verify all returned parks have images
      data.parks.forEach((park) => {
        const hasNpsImage = Array.isArray(park.images) && park.images.length > 0 && !!park.images[0]?.url;
        const hasWikidataImage = !!park.wikidata_image && park.wikidata_image.trim().length > 0;
        expect(hasNpsImage || hasWikidataImage).toBe(true);
      });
    });

    it('should include parks with wikidata_image when hasImages=true', async () => {
      vi.resetModules();
      const parksWithWikidataImage = {
        data: [
          {
            id: '1',
            park_code: 'wiki1',
            full_name: 'State Park With Wikidata Image',
            images: null,
            wikidata_image: 'https://example.com/wikidata.jpg',
            source: 'wikidata',
          },
        ],
        error: null,
        count: 1,
      };
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(parksWithWikidataImage)),
      };

      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?hasImages=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.parks.length).toBe(1);
      expect(data.parks[0].wikidata_image).toBe('https://example.com/wikidata.jpg');
    });

    it('should filter out parks with empty images array when hasImages=true', async () => {
      vi.resetModules();
      const parksWithEmptyImages = {
        data: [
          {
            id: '1',
            park_code: 'empty1',
            full_name: 'Park With Empty Images Array',
            images: [],
            wikidata_image: null,
            source: 'nps',
          },
          {
            id: '2',
            park_code: 'valid1',
            full_name: 'Park With Valid Image',
            images: [{ url: 'https://example.com/valid.jpg', title: 'Valid' }],
            wikidata_image: null,
            source: 'nps',
          },
        ],
        error: null,
        count: 2,
      };
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(parksWithEmptyImages)),
      };

      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?hasImages=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.parks.length).toBe(1);
      expect(data.parks[0].park_code).toBe('valid1');
    });

    it('should not filter images when hasImages is not provided', async () => {
      vi.resetModules();
      const parksWithMixedImages = {
        data: [
          {
            id: '1',
            park_code: 'yell',
            full_name: 'Yellowstone',
            images: [{ url: 'https://example.com/yellowstone.jpg' }],
            source: 'nps',
          },
          {
            id: '2',
            park_code: 'noimg',
            full_name: 'No Image Park',
            images: null,
            source: 'nps',
          },
        ],
        error: null,
        count: 2,
      };
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(parksWithMixedImages)),
      };

      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should return all parks without filtering
      expect(data.parks.length).toBe(2);
    });
  });
});

describe('Parks Nearby API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      from: vi.fn(() => createChainableMock(mockParksData)),
      rpc: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: '1',
              park_code: 'yose',
              full_name: 'Yosemite National Park',
              distance: 50,
            },
          ],
          error: null,
        })
      ),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/parks/nearby', () => {
    it('should find parks near coordinates', async () => {
      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request(
        'http://localhost:8080/api/parks/nearby?lat=37.8651&lng=-119.5383'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
    });

    it('should return 400 if coordinates missing', async () => {
      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request('http://localhost:8080/api/parks/nearby');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 if only lat provided', async () => {
      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request('http://localhost:8080/api/parks/nearby?lat=37.8651');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 if latitude out of range', async () => {
      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request('http://localhost:8080/api/parks/nearby?lat=100&lng=-119.5383');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 if longitude out of range', async () => {
      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request('http://localhost:8080/api/parks/nearby?lat=37.8651&lng=-200');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should support radius parameter', async () => {
      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request(
        'http://localhost:8080/api/parks/nearby?lat=37.8651&lng=-119.5383&radius=100'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should fallback to haversine calculation if RPC fails', async () => {
      vi.resetModules();

      // Create a mock that returns data for the fallback query
      // The route uses .not().not() chaining, so we need to support that
      const fallbackChainable = {
        select: vi.fn(() => fallbackChainable),
        from: vi.fn(() => fallbackChainable),
        not: vi.fn(() => ({
          not: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: '1',
                  park_code: 'yose',
                  full_name: 'Yosemite National Park',
                  latitude: 37.8651,
                  longitude: -119.5383,
                  source: 'nps',
                },
              ],
              error: null,
            })
          ),
        })),
      };

      mockSupabaseClient = {
        from: vi.fn(() => fallbackChainable),
        rpc: vi.fn(() =>
          Promise.resolve({
            data: null,
            error: { message: 'RPC not available' },
          })
        ),
      };

      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request(
        'http://localhost:8080/api/parks/nearby?lat=37.8651&lng=-119.5383'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should use all_parks view in fallback query', async () => {
      vi.resetModules();

      const fallbackChainable = {
        select: vi.fn(() => fallbackChainable),
        from: vi.fn(() => fallbackChainable),
        not: vi.fn(() => ({
          not: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: '1',
                  park_code: 'yose',
                  full_name: 'Yosemite National Park',
                  latitude: 37.8651,
                  longitude: -119.5383,
                  source: 'nps',
                },
                {
                  id: '2',
                  park_code: 'Q123456',
                  full_name: 'New Brighton State Beach',
                  latitude: 36.9783,
                  longitude: -121.9386,
                  source: 'wikidata',
                },
              ],
              error: null,
            })
          ),
        })),
      };

      const fromMock = vi.fn(() => fallbackChainable);
      mockSupabaseClient = {
        from: fromMock,
        rpc: vi.fn(() =>
          Promise.resolve({
            data: null,
            error: { message: 'RPC not available' },
          })
        ),
      };

      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request(
        'http://localhost:8080/api/parks/nearby?lat=37.8651&lng=-119.5383'
      );
      await GET(request);

      // Verify it queries the all_parks view in fallback
      expect(fromMock).toHaveBeenCalledWith('all_parks');
    });

    it('should include state parks in nearby results via RPC', async () => {
      vi.resetModules();

      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockParksData)),
        rpc: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: '1',
                park_code: 'yose',
                full_name: 'Yosemite National Park',
                distance_km: 50,
                source: 'nps',
              },
              {
                id: '2',
                park_code: 'Q123456',
                full_name: 'New Brighton State Beach',
                distance_km: 25,
                source: 'wikidata',
              },
            ],
            error: null,
          })
        ),
      };

      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request(
        'http://localhost:8080/api/parks/nearby?lat=37.8651&lng=-119.5383'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.parks).toHaveLength(2);
      // Check that both NPS and state parks are included
      const sources = data.parks.map((p) => p.source);
      expect(sources).toContain('nps');
      expect(sources).toContain('wikidata');
    });
  });
});