/**
 * Tests for Places API Routes
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a chainable mock builder for Supabase queries
const createChainableMock = (finalResult, countResult = null) => {
  let isCountQuery = false;

  const chainable = {
    select: vi.fn((cols, opts) => {
      // Mark as count query but still return chainable for .eq() chaining
      if (opts?.count === 'exact' && opts?.head) {
        isCountQuery = true;
      }
      return chainable;
    }),
    from: vi.fn(() => chainable),
    eq: vi.fn(() => {
      // If this is a count query, return the count result as a thenable
      if (isCountQuery) {
        isCountQuery = false; // Reset for next query
        return {
          then: (resolve) => resolve(countResult || { count: 0, error: null }),
        };
      }
      return chainable;
    }),
    in: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    range: vi.fn(() => Promise.resolve(finalResult)),
    single: vi.fn(() => Promise.resolve(finalResult)),
    insert: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    delete: vi.fn(() => chainable),
    then: vi.fn((resolve) => resolve(finalResult)),
  };
  return chainable;
};

// Mock place data
const mockPlaceData = {
  data: {
    id: 'place-uuid-1',
    data_cid: '11240000532159598531',
    title: "Coppolillo's Italian Steakhouse",
    category: 'dining',
    address: 'Crown Point, IN',
    phone: '(219) 555-1234',
    website: 'https://example.com',
    latitude: 41.4169,
    longitude: -87.3653,
    rating: 4.6,
    reviews_count: 409,
    price_level: '$$',
    hours: { monday: '11am-9pm' },
    thumbnail: 'https://example.com/image.jpg',
    description: 'Italian restaurant',
    created_at: '2025-12-07T19:03:15.247319+00:00',
    updated_at: '2025-12-07T19:55:20.108285+00:00',
  },
  error: null,
};

const mockPlaceStatsData = {
  data: {
    place_id: 'place-uuid-1',
    data_cid: '11240000532159598531',
    title: "Coppolillo's Italian Steakhouse",
    likes_count: 5,
    comments_count: 3,
    avg_user_rating: 4.5,
  },
  error: null,
};

const mockParkLinksData = {
  data: [
    {
      park_id: 'park-uuid-1',
      distance_miles: 15.5,
      search_location: 'Crown Point, Indiana',
    },
  ],
  error: null,
};

const mockCommentsData = {
  data: [
    {
      id: 'comment-uuid-1',
      content: 'Great food!',
      rating: 5,
      created_at: '2025-12-07T20:00:00.000Z',
      updated_at: '2025-12-07T20:00:00.000Z',
      user_id: 'user-uuid-1',
    },
    {
      id: 'comment-uuid-2',
      content: 'Nice atmosphere',
      rating: 4,
      created_at: '2025-12-07T19:00:00.000Z',
      updated_at: '2025-12-07T19:00:00.000Z',
      user_id: 'user-uuid-2',
    },
  ],
  error: null,
  count: 2,
};

const mockLikesData = {
  count: 5,
  error: null,
};

const mockUserLikeData = {
  data: { id: 'like-uuid-1' },
  error: null,
};

// Mock Supabase client
let mockSupabaseClient;

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mockSupabaseClient),
}));

describe('Places API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/places/[dataCid]', () => {
    beforeEach(() => {
      // Setup mock for place detail endpoint
      mockSupabaseClient = {
        from: vi.fn((table) => {
          if (table === 'nearby_places') {
            return createChainableMock(mockPlaceData);
          }
          if (table === 'place_stats') {
            return createChainableMock(mockPlaceStatsData);
          }
          if (table === 'park_nearby_places') {
            return createChainableMock(mockParkLinksData);
          }
          if (table === 'all_parks') {
            return createChainableMock({ data: [], error: null });
          }
          return createChainableMock({ data: null, error: null });
        }),
      };
    });

    it('should return place details with stats', async () => {
      const { GET } = await import('@/app/api/places/[dataCid]/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531');
      const response = await GET(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('place');
      expect(data.place).toHaveProperty('title');
      expect(data.place).toHaveProperty('likes_count');
      expect(data.place).toHaveProperty('comments_count');
    });

    it('should return 400 if dataCid is missing', async () => {
      const { GET } = await import('@/app/api/places/[dataCid]/route.js');

      const request = new Request('http://localhost:8080/api/places/');
      const response = await GET(request, { params: Promise.resolve({ dataCid: '' }) });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent place', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() =>
          createChainableMock({
            data: null,
            error: { code: 'PGRST116' },
          })
        ),
      };

      const { GET } = await import('@/app/api/places/[dataCid]/route.js');

      const request = new Request('http://localhost:8080/api/places/nonexistent');
      const response = await GET(request, { params: Promise.resolve({ dataCid: 'nonexistent' }) });

      expect(response.status).toBe(404);
    });

    it('should include parks array in response', async () => {
      const { GET } = await import('@/app/api/places/[dataCid]/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531');
      const response = await GET(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('parks');
      expect(Array.isArray(data.parks)).toBe(true);
    });
  });

  describe('GET /api/places/[dataCid]/comments', () => {
    beforeEach(() => {
      mockSupabaseClient = {
        from: vi.fn((table) => {
          if (table === 'nearby_places') {
            return createChainableMock({ data: { id: 'place-uuid-1' }, error: null });
          }
          if (table === 'place_comments') {
            return createChainableMock(mockCommentsData, { count: 2, error: null });
          }
          return createChainableMock({ data: null, error: null });
        }),
      };
    });

    it('should return comments for a place', async () => {
      const { GET } = await import('@/app/api/places/[dataCid]/comments/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/comments');
      const response = await GET(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('comments');
      expect(Array.isArray(data.comments)).toBe(true);
    });

    it('should support pagination', async () => {
      const { GET } = await import('@/app/api/places/[dataCid]/comments/route.js');

      const request = new Request(
        'http://localhost:8080/api/places/11240000532159598531/comments?limit=10&offset=0'
      );
      const response = await GET(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
    });

    it('should return 404 for non-existent place', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() =>
          createChainableMock({
            data: null,
            error: { code: 'PGRST116' },
          })
        ),
      };

      const { GET } = await import('@/app/api/places/[dataCid]/comments/route.js');

      const request = new Request('http://localhost:8080/api/places/nonexistent/comments');
      const response = await GET(request, { params: Promise.resolve({ dataCid: 'nonexistent' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/places/[dataCid]/comments', () => {
    beforeEach(() => {
      mockSupabaseClient = {
        from: vi.fn((table) => {
          if (table === 'nearby_places') {
            return createChainableMock({ data: { id: 'place-uuid-1' }, error: null });
          }
          if (table === 'place_comments') {
            const chainable = createChainableMock({
              data: {
                id: 'new-comment-uuid',
                content: 'Test comment',
                rating: 5,
                user_id: 'user-uuid-1',
                place_id: 'place-uuid-1',
              },
              error: null,
            });
            return chainable;
          }
          return createChainableMock({ data: null, error: null });
        }),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: { id: 'user-uuid-1' } },
              error: null,
            })
          ),
        },
      };
    });

    it('should create a comment when authenticated', async () => {
      const { POST } = await import('@/app/api/places/[dataCid]/comments/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test comment', rating: 5 }),
      });
      const response = await POST(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('comment');
    });

    it('should return 401 when not authenticated', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock({ data: { id: 'place-uuid-1' }, error: null })),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: null },
              error: { message: 'Not authenticated' },
            })
          ),
        },
      };

      const { POST } = await import('@/app/api/places/[dataCid]/comments/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test comment' }),
      });
      const response = await POST(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });

      expect(response.status).toBe(401);
    });

    it('should return 400 if content is empty', async () => {
      const { POST } = await import('@/app/api/places/[dataCid]/comments/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });
      const response = await POST(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 if rating is out of range', async () => {
      const { POST } = await import('@/app/api/places/[dataCid]/comments/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test', rating: 10 }),
      });
      const response = await POST(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/places/[dataCid]/comments/[commentId]', () => {
    beforeEach(() => {
      mockSupabaseClient = {
        from: vi.fn(() =>
          createChainableMock({
            data: {
              id: 'comment-uuid-1',
              content: 'Updated comment',
              rating: 4,
            },
            error: null,
          })
        ),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: { id: 'user-uuid-1' } },
              error: null,
            })
          ),
        },
      };
    });

    it('should update a comment when authenticated', async () => {
      const { PUT } = await import('@/app/api/places/[dataCid]/comments/[commentId]/route.js');

      const request = new Request(
        'http://localhost:8080/api/places/11240000532159598531/comments/comment-uuid-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated comment', rating: 4 }),
        }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ dataCid: '11240000532159598531', commentId: 'comment-uuid-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('comment');
    });

    it('should return 401 when not authenticated', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock({ data: null, error: null })),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: null },
              error: { message: 'Not authenticated' },
            })
          ),
        },
      };

      const { PUT } = await import('@/app/api/places/[dataCid]/comments/[commentId]/route.js');

      const request = new Request(
        'http://localhost:8080/api/places/11240000532159598531/comments/comment-uuid-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated comment' }),
        }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ dataCid: '11240000532159598531', commentId: 'comment-uuid-1' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/places/[dataCid]/comments/[commentId]', () => {
    beforeEach(() => {
      mockSupabaseClient = {
        from: vi.fn(() => {
          const chainable = createChainableMock({ error: null });
          // Make delete return a thenable that resolves to { error: null }
          chainable.delete = vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          }));
          return chainable;
        }),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: { id: 'user-uuid-1' } },
              error: null,
            })
          ),
        },
      };
    });

    it('should delete a comment when authenticated', async () => {
      const { DELETE } = await import('@/app/api/places/[dataCid]/comments/[commentId]/route.js');

      const request = new Request(
        'http://localhost:8080/api/places/11240000532159598531/comments/comment-uuid-1',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ dataCid: '11240000532159598531', commentId: 'comment-uuid-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
    });

    it('should return 401 when not authenticated', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock({ error: null })),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: null },
              error: { message: 'Not authenticated' },
            })
          ),
        },
      };

      const { DELETE } = await import('@/app/api/places/[dataCid]/comments/[commentId]/route.js');

      const request = new Request(
        'http://localhost:8080/api/places/11240000532159598531/comments/comment-uuid-1',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ dataCid: '11240000532159598531', commentId: 'comment-uuid-1' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/places/[dataCid]/likes', () => {
    beforeEach(() => {
      mockSupabaseClient = {
        from: vi.fn((table) => {
          if (table === 'nearby_places') {
            return createChainableMock({ data: { id: 'place-uuid-1' }, error: null });
          }
          if (table === 'place_likes') {
            return createChainableMock(mockUserLikeData, { count: 5, error: null });
          }
          return createChainableMock({ data: null, error: null });
        }),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: { id: 'user-uuid-1' } },
              error: null,
            })
          ),
        },
      };
    });

    it('should return likes count and user status', async () => {
      const { GET } = await import('@/app/api/places/[dataCid]/likes/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/likes');
      const response = await GET(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('likes_count');
      expect(data).toHaveProperty('user_has_liked');
    });

    it('should return 404 for non-existent place', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() =>
          createChainableMock({
            data: null,
            error: { code: 'PGRST116' },
          })
        ),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
      };

      const { GET } = await import('@/app/api/places/[dataCid]/likes/route.js');

      const request = new Request('http://localhost:8080/api/places/nonexistent/likes');
      const response = await GET(request, { params: Promise.resolve({ dataCid: 'nonexistent' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/places/[dataCid]/likes', () => {
    beforeEach(() => {
      mockSupabaseClient = {
        from: vi.fn((table) => {
          if (table === 'nearby_places') {
            return createChainableMock({ data: { id: 'place-uuid-1' }, error: null });
          }
          if (table === 'place_likes') {
            return createChainableMock({ data: { id: 'new-like-uuid' }, error: null }, { count: 6, error: null });
          }
          return createChainableMock({ data: null, error: null });
        }),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: { id: 'user-uuid-1' } },
              error: null,
            })
          ),
        },
      };
    });

    it('should create a like when authenticated', async () => {
      const { POST } = await import('@/app/api/places/[dataCid]/likes/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/likes', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('user_has_liked', true);
    });

    it('should return 401 when not authenticated', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock({ data: { id: 'place-uuid-1' }, error: null })),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: null },
              error: { message: 'Not authenticated' },
            })
          ),
        },
      };

      const { POST } = await import('@/app/api/places/[dataCid]/likes/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/likes', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });

      expect(response.status).toBe(401);
    });

    it('should return 409 for duplicate like', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn((table) => {
          if (table === 'nearby_places') {
            return createChainableMock({ data: { id: 'place-uuid-1' }, error: null });
          }
          if (table === 'place_likes') {
            return createChainableMock({
              data: null,
              error: { code: '23505' },
            });
          }
          return createChainableMock({ data: null, error: null });
        }),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: { id: 'user-uuid-1' } },
              error: null,
            })
          ),
        },
      };

      const { POST } = await import('@/app/api/places/[dataCid]/likes/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/likes', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });

      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/places/[dataCid]/likes', () => {
    beforeEach(() => {
      mockSupabaseClient = {
        from: vi.fn((table) => {
          if (table === 'nearby_places') {
            return createChainableMock({ data: { id: 'place-uuid-1' }, error: null });
          }
          if (table === 'place_likes') {
            const chainable = createChainableMock({ error: null }, { count: 4, error: null });
            // Make delete return a thenable chain
            chainable.delete = vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null })),
              })),
            }));
            return chainable;
          }
          return createChainableMock({ data: null, error: null });
        }),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: { id: 'user-uuid-1' } },
              error: null,
            })
          ),
        },
      };
    });

    it('should delete a like when authenticated', async () => {
      const { DELETE } = await import('@/app/api/places/[dataCid]/likes/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/likes', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('user_has_liked', false);
    });

    it('should return 401 when not authenticated', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn(() => createChainableMock({ data: { id: 'place-uuid-1' }, error: null })),
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: null },
              error: { message: 'Not authenticated' },
            })
          ),
        },
      };

      const { DELETE } = await import('@/app/api/places/[dataCid]/likes/route.js');

      const request = new Request('http://localhost:8080/api/places/11240000532159598531/likes', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ dataCid: '11240000532159598531' }) });

      expect(response.status).toBe(401);
    });
  });
});