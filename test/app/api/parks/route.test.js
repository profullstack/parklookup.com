/**
 * Tests for Parks API Route
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          range: vi.fn(() =>
            Promise.resolve({
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
            })
          ),
        })),
        eq: vi.fn(() =>
          Promise.resolve({
            data: {
              id: '1',
              park_code: 'yell',
              full_name: 'Yellowstone National Park',
            },
            error: null,
          })
        ),
        ilike: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() =>
              Promise.resolve({
                data: [],
                error: null,
                count: 0,
              })
            ),
          })),
        })),
        textSearch: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() =>
              Promise.resolve({
                data: [],
                error: null,
                count: 0,
              })
            ),
          })),
        })),
      })),
    })),
  })),
}));

describe('Parks API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  describe('GET /api/parks/[parkCode]', () => {
    it('should return a single park by park code', async () => {
      const { GET } = await import('@/app/api/parks/[parkCode]/route.js');

      const request = new Request('http://localhost:8080/api/parks/yell');
      const response = await GET(request, { params: { parkCode: 'yell' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('park');
    });

    it('should return 404 for non-existent park', async () => {
      // Override mock for this test
      vi.doMock('@/lib/supabase/client', () => ({
        createServerClient: vi.fn(() => ({
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116' },
                  })
                ),
              })),
            })),
          })),
        })),
      }));

      const { GET } = await import('@/app/api/parks/[parkCode]/route.js');

      const request = new Request('http://localhost:8080/api/parks/nonexistent');
      const response = await GET(request, { params: { parkCode: 'nonexistent' } });

      expect(response.status).toBe(404);
    });
  });
});

describe('Parks Search API', () => {
  describe('GET /api/parks/search', () => {
    it('should search parks by query', async () => {
      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search?q=canyon');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
    });

    it('should return 400 if no query provided', async () => {
      const { GET } = await import('@/app/api/parks/search/route.js');

      const request = new Request('http://localhost:8080/api/parks/search');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });
});

describe('Parks Nearby API', () => {
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

    it('should support radius parameter', async () => {
      const { GET } = await import('@/app/api/parks/nearby/route.js');

      const request = new Request(
        'http://localhost:8080/api/parks/nearby?lat=37.8651&lng=-119.5383&radius=100'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });
});