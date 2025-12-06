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

// Default mock data
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
    },
  ],
  error: null,
  count: 1,
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
  });
});