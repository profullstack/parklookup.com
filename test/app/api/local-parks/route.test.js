/**
 * Tests for Local Parks API Route
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
    in: vi.fn(() => chainable),
  };
  return chainable;
};

// Mock local parks data
const mockLocalParksData = {
  data: [
    {
      id: '1',
      name: 'Central Park',
      slug: 'central-park',
      park_type: 'city',
      managing_agency: 'NYC Parks Department',
      county: 'New York',
      state: 'NY',
      latitude: 40.7829,
      longitude: -73.9654,
      access: 'Open',
      wikidata_id: 'Q160409',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Griffith Park',
      slug: 'griffith-park',
      park_type: 'county',
      managing_agency: 'LA County Parks',
      county: 'Los Angeles',
      state: 'CA',
      latitude: 34.1341,
      longitude: -118.2944,
      access: 'Open',
      wikidata_id: 'Q1544583',
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
  error: null,
  count: 2,
};

const mockSingleParkData = {
  data: {
    id: '1',
    name: 'Central Park',
    slug: 'central-park',
    park_type: 'city',
    managing_agency: 'NYC Parks Department',
    county: 'New York',
    state: 'NY',
    latitude: 40.7829,
    longitude: -73.9654,
    access: 'Open',
    wikidata_id: 'Q160409',
    photos: [
      {
        id: 'p1',
        image_url: 'https://commons.wikimedia.org/image.jpg',
        thumb_url: 'https://commons.wikimedia.org/thumb.jpg',
        license: 'CC BY-SA 4.0',
        attribution: 'John Doe',
        source: 'wikimedia',
      },
    ],
  },
  error: null,
};

// Mock Supabase client
let mockSupabaseClient;

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

describe('Local Parks API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      from: vi.fn(() => createChainableMock(mockLocalParksData)),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/local-parks', () => {
    it('should return a list of local parks', async () => {
      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
      expect(Array.isArray(data.parks)).toBe(true);
    });

    it('should support pagination with page and limit params', async () => {
      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
    });

    it('should support state filtering', async () => {
      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks?state=CA');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should support county filtering', async () => {
      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks?county=Los%20Angeles');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should support park_type filtering', async () => {
      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks?park_type=county');
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

      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should query local_parks_with_location view', async () => {
      vi.resetModules();
      const fromMock = vi.fn(() => createChainableMock(mockLocalParksData));
      mockSupabaseClient = {
        from: fromMock,
      };

      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks');
      await GET(request);

      expect(fromMock).toHaveBeenCalledWith('local_parks_with_location');
    });

    it('should return parks with park_type field', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockLocalParksData)),
      };

      const { GET } = await import('@/app/api/local-parks/route.js');

      const request = new Request('http://localhost:8080/api/local-parks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.parks).toHaveLength(2);
      expect(data.parks[0]).toHaveProperty('park_type');
      expect(['county', 'city']).toContain(data.parks[0].park_type);
    });
  });
});

describe('Local Parks Single Park API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      from: vi.fn(() => createChainableMock(mockSingleParkData)),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/local-parks/[id]', () => {
    it('should return a single park by ID', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockSingleParkData)),
      };

      const { GET } = await import('@/app/api/local-parks/[id]/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/1');
      const response = await GET(request, { params: { id: '1' } });
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

      const { GET } = await import('@/app/api/local-parks/[id]/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/nonexistent');
      const response = await GET(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
    });

    it('should return 400 if ID is missing', async () => {
      vi.resetModules();
      const { GET } = await import('@/app/api/local-parks/[id]/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/');
      const response = await GET(request, { params: { id: '' } });

      expect(response.status).toBe(400);
    });

    it('should include photos in response', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockSingleParkData)),
      };

      const { GET } = await import('@/app/api/local-parks/[id]/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/1');
      const response = await GET(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.park).toHaveProperty('photos');
      expect(Array.isArray(data.park.photos)).toBe(true);
    });
  });
});

describe('Local Parks Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      from: vi.fn(() => createChainableMock(mockLocalParksData)),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/local-parks/search', () => {
    it('should search parks by query', async () => {
      const { GET } = await import('@/app/api/local-parks/search/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/search?q=central');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
    });

    it('should return all parks if no query provided', async () => {
      const { GET } = await import('@/app/api/local-parks/search/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/search');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
      expect(data).toHaveProperty('total');
    });

    it('should support state filtering', async () => {
      const { GET } = await import('@/app/api/local-parks/search/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/search?state=CA');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
    });

    it('should support park_type filtering', async () => {
      const { GET } = await import('@/app/api/local-parks/search/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/search?park_type=city');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
    });

    it('should support proximity search with lat/lng', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock(mockLocalParksData)),
        rpc: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: '1',
                name: 'Central Park',
                distance_km: 5.2,
              },
            ],
            error: null,
          })
        ),
      };

      const { GET } = await import('@/app/api/local-parks/search/route.js');

      const request = new Request(
        'http://localhost:8080/api/local-parks/search?lat=40.7829&lng=-73.9654&radius=50'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
    });

    it('should handle database errors gracefully', async () => {
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

      const { GET } = await import('@/app/api/local-parks/search/route.js');

      const request = new Request('http://localhost:8080/api/local-parks/search?q=test');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });
});