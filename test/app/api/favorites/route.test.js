/**
 * Tests for Favorites API endpoints
 * Using Vitest for testing (following project conventions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
  default: vi.fn(() => mockSupabaseClient),
}));

describe('Favorites API Routes', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
  };

  const mockPark = {
    id: 'park-uuid-456',
    park_code: 'yose',
    full_name: 'Yosemite National Park',
    description: 'A beautiful park',
    states: 'CA',
    latitude: 37.8651,
    longitude: -119.5383,
    designation: 'National Park',
    url: 'https://www.nps.gov/yose',
    images: [],
  };

  const mockFavorite = {
    id: 'fav-uuid-789',
    user_id: 'user-uuid-123',
    nps_park_id: 'park-uuid-456',
    notes: 'Great park!',
    visited: false,
    visited_at: null,
    created_at: '2024-01-01T00:00:00Z',
    nps_parks: mockPark,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    // Setup mock chain for queries
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.delete.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockResolvedValue({ data: mockFavorite, error: null });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('GET /api/favorites', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'GET',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });

      it('should return 401 when token is invalid', async () => {
        vi.resetModules();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const { GET } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Fetching Favorites', () => {
      it('should return user favorites successfully', async () => {
        vi.resetModules();

        // Mock the query chain to return favorites
        mockSupabaseClient.order.mockResolvedValue({
          data: [mockFavorite],
          error: null,
        });

        const { GET } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.favorites).toBeDefined();
        expect(Array.isArray(data.favorites)).toBe(true);
      });

      it('should filter by visited status when visited=true', async () => {
        vi.resetModules();

        // When visited=true, the query chain adds an extra .eq() call
        // So we need to mock the chain properly: .eq() returns mockSupabaseClient
        // and the final .order() resolves the data
        mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
        mockSupabaseClient.order.mockResolvedValue({
          data: [{ ...mockFavorite, visited: true }],
          error: null,
        });

        const { GET } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites?visited=true', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.favorites).toBeDefined();
      });

      it('should return empty array when user has no favorites', async () => {
        vi.resetModules();

        mockSupabaseClient.order.mockResolvedValue({
          data: [],
          error: null,
        });

        const { GET } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.favorites).toEqual([]);
      });

      it('should transform nps_parks to park for frontend compatibility', async () => {
        vi.resetModules();

        mockSupabaseClient.order.mockResolvedValue({
          data: [mockFavorite],
          error: null,
        });

        const { GET } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.favorites[0].park).toBeDefined();
        expect(data.favorites[0].park_id).toBe(mockFavorite.nps_park_id);
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when database query fails', async () => {
        vi.resetModules();

        mockSupabaseClient.order.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const { GET } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch favorites');
      });
    });
  });

  describe('POST /api/favorites', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parkId: 'park-uuid-456' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Adding Favorites', () => {
      it('should add a favorite successfully', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: mockFavorite,
          error: null,
        });

        const { POST } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ parkId: 'park-uuid-456' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.favorite).toBeDefined();
      });

      it('should add a favorite with notes', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: { ...mockFavorite, notes: 'My notes' },
          error: null,
        });

        const { POST } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ parkId: 'park-uuid-456', notes: 'My notes' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.favorite).toBeDefined();
      });

      it('should return 400 when parkId is missing', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({}),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Park ID is required');
      });

      it('should return 409 when park is already in favorites', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Duplicate key' },
        });

        const { POST } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ parkId: 'park-uuid-456' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe('Park already in favorites');
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when database insert fails', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { code: 'OTHER', message: 'Database error' },
        });

        const { POST } = await import('@/app/api/favorites/route.js');

        const request = new Request('http://localhost:3000/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ parkId: 'park-uuid-456' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to add favorite');
      });
    });
  });
});