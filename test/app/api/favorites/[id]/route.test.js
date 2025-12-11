/**
 * Tests for Single Favorite API endpoints
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
  update: vi.fn(),
  delete: vi.fn(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
  default: vi.fn(() => mockSupabaseClient),
}));

describe('Single Favorite API Routes', () => {
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
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
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

  describe('GET /api/favorites/[id]', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'GET',
        });

        const response = await GET(request, { params: Promise.resolve({ id: 'fav-uuid-789' }) });
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

        const { GET } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid_token',
          },
        });

        const response = await GET(request, { params: Promise.resolve({ id: 'fav-uuid-789' }) });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Fetching Single Favorite', () => {
      it('should return a single favorite successfully', async () => {
        vi.resetModules();

        const { GET } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request, { params: Promise.resolve({ id: 'fav-uuid-789' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.favorite).toBeDefined();
      });

      it('should return 404 when favorite not found', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        });

        const { GET } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/nonexistent', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Favorite not found');
      });
    });
  });

  describe('PATCH /api/favorites/[id]', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { PATCH } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes: 'Updated notes' }),
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'fav-uuid-789' }) });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Updating Favorite', () => {
      it('should update notes successfully', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: { ...mockFavorite, notes: 'Updated notes' },
          error: null,
        });

        const { PATCH } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ notes: 'Updated notes' }),
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'fav-uuid-789' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.favorite).toBeDefined();
      });

      it('should update visited status successfully', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: { ...mockFavorite, visited: true },
          error: null,
        });

        const { PATCH } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ visited: true }),
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'fav-uuid-789' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.favorite).toBeDefined();
      });

      it('should return 400 when no updates provided', async () => {
        vi.resetModules();
        const { PATCH } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({}),
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'fav-uuid-789' }) });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('No updates provided');
      });

      it('should return 404 when favorite not found', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        });

        const { PATCH } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/nonexistent', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ notes: 'Updated notes' }),
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'nonexistent' }) });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Favorite not found');
      });
    });
  });

  describe('DELETE /api/favorites/[id]', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { DELETE } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/park-uuid-456', {
          method: 'DELETE',
        });

        const response = await DELETE(request, {
          params: Promise.resolve({ id: 'park-uuid-456' }),
        });
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

        const { DELETE } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/park-uuid-456', {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer invalid_token',
          },
        });

        const response = await DELETE(request, {
          params: Promise.resolve({ id: 'park-uuid-456' }),
        });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Deleting Favorite', () => {
      it('should delete favorite by nps_park_id successfully', async () => {
        vi.resetModules();

        // First delete by nps_park_id succeeds
        mockSupabaseClient.select.mockResolvedValueOnce({
          data: [mockFavorite],
          error: null,
        });

        const { DELETE } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/park-uuid-456', {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await DELETE(request, {
          params: Promise.resolve({ id: 'park-uuid-456' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('should delete favorite by record id when nps_park_id fails', async () => {
        vi.resetModules();

        // First delete by nps_park_id returns empty
        mockSupabaseClient.select
          .mockResolvedValueOnce({
            data: [],
            error: null,
          })
          // Second delete by id succeeds
          .mockResolvedValueOnce({
            data: [mockFavorite],
            error: null,
          });

        const { DELETE } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await DELETE(request, {
          params: Promise.resolve({ id: 'fav-uuid-789' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('should return 404 when favorite not found', async () => {
        vi.resetModules();

        // Both delete attempts return empty
        mockSupabaseClient.select
          .mockResolvedValueOnce({
            data: [],
            error: null,
          })
          .mockResolvedValueOnce({
            data: [],
            error: null,
          });

        const { DELETE } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/nonexistent', {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Favorite not found');
      });

      it('should return 500 when database delete fails', async () => {
        vi.resetModules();

        // First delete by nps_park_id returns empty
        mockSupabaseClient.select
          .mockResolvedValueOnce({
            data: [],
            error: null,
          })
          // Second delete by id fails
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Database error' },
          });

        const { DELETE } = await import('@/app/api/favorites/[id]/route.js');

        const request = new Request('http://localhost:3000/api/favorites/fav-uuid-789', {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await DELETE(request, {
          params: Promise.resolve({ id: 'fav-uuid-789' }),
        });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to delete favorite');
      });
    });
  });
});