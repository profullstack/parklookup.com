/**
 * Tests for Profile API endpoints
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
  insert: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
  default: vi.fn(() => mockSupabaseClient),
}));

describe('Profile API Routes', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    display_name: 'test',
    avatar_url: null,
    preferences: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockResolvedValue({ data: mockProfile, error: null });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('GET /api/profile', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'GET',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });

      it('should return 401 when authorization header does not start with Bearer', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'GET',
          headers: {
            Authorization: 'Basic some_token',
          },
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

        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
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

      it('should return 401 when token is expired', async () => {
        vi.resetModules();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Token expired' },
        });

        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer expired_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Fetching Profile', () => {
      it('should return user profile successfully', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: mockProfile,
          error: null,
        });

        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeDefined();
        expect(data.profile.id).toBe(mockUser.id);
        expect(data.profile.email).toBe(mockUser.email);
        expect(data.user).toBeDefined();
        expect(data.user.id).toBe(mockUser.id);
        expect(data.user.email).toBe(mockUser.email);
      });

      it('should create profile if it does not exist', async () => {
        vi.resetModules();

        const newProfile = {
          ...mockProfile,
          display_name: 'test',
        };

        // First call: profile not found (PGRST116)
        // Second call: insert returns new profile
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' },
          })
          .mockResolvedValueOnce({
            data: newProfile,
            error: null,
          });

        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeDefined();
        expect(data.profile.display_name).toBe('test');
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when database query fails', async () => {
        vi.resetModules();

        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { code: 'OTHER', message: 'Database error' },
        });

        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch profile');
      });

      it('should return 500 when profile creation fails', async () => {
        vi.resetModules();

        // First call: profile not found
        // Second call: insert fails
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' },
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Insert failed' },
          });

        const { GET } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to create profile');
      });
    });
  });

  describe('PUT /api/profile', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ display_name: 'New Name' }),
        });

        const response = await PUT(request);
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

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid_token',
          },
          body: JSON.stringify({ display_name: 'New Name' }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Updating Profile', () => {
      it('should update display_name successfully', async () => {
        vi.resetModules();

        const updatedProfile = {
          ...mockProfile,
          display_name: 'New Name',
        };

        // First call: check if profile exists
        // Second call: update profile
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: { id: mockUser.id },
            error: null,
          })
          .mockResolvedValueOnce({
            data: updatedProfile,
            error: null,
          });

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ display_name: 'New Name' }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeDefined();
        expect(data.profile.display_name).toBe('New Name');
      });

      it('should update avatar_url successfully', async () => {
        vi.resetModules();

        const updatedProfile = {
          ...mockProfile,
          avatar_url: 'https://example.com/avatar.png',
        };

        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: { id: mockUser.id },
            error: null,
          })
          .mockResolvedValueOnce({
            data: updatedProfile,
            error: null,
          });

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ avatar_url: 'https://example.com/avatar.png' }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile.avatar_url).toBe('https://example.com/avatar.png');
      });

      it('should update preferences successfully', async () => {
        vi.resetModules();

        const preferences = { theme: 'dark', notifications: true };
        const updatedProfile = {
          ...mockProfile,
          preferences,
        };

        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: { id: mockUser.id },
            error: null,
          })
          .mockResolvedValueOnce({
            data: updatedProfile,
            error: null,
          });

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ preferences }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile.preferences).toEqual(preferences);
      });

      it('should update multiple fields at once', async () => {
        vi.resetModules();

        const updatedProfile = {
          ...mockProfile,
          display_name: 'New Name',
          avatar_url: 'https://example.com/avatar.png',
          preferences: { theme: 'dark' },
        };

        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: { id: mockUser.id },
            error: null,
          })
          .mockResolvedValueOnce({
            data: updatedProfile,
            error: null,
          });

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({
            display_name: 'New Name',
            avatar_url: 'https://example.com/avatar.png',
            preferences: { theme: 'dark' },
          }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile.display_name).toBe('New Name');
        expect(data.profile.avatar_url).toBe('https://example.com/avatar.png');
        expect(data.profile.preferences).toEqual({ theme: 'dark' });
      });

      it('should create profile if it does not exist during update', async () => {
        vi.resetModules();

        const newProfile = {
          ...mockProfile,
          display_name: 'New Name',
        };

        // First call: profile not found
        // Second call: insert new profile
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' },
          })
          .mockResolvedValueOnce({
            data: newProfile,
            error: null,
          });

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ display_name: 'New Name' }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeDefined();
        expect(data.profile.display_name).toBe('New Name');
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when profile update fails', async () => {
        vi.resetModules();

        // First call: profile exists
        // Second call: update fails
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: { id: mockUser.id },
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Update failed' },
          });

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ display_name: 'New Name' }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to update profile');
      });

      it('should return 500 when profile creation during update fails', async () => {
        vi.resetModules();

        // First call: profile not found
        // Second call: insert fails
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' },
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Insert failed' },
          });

        const { PUT } = await import('@/app/api/profile/route.js');

        const request = new Request('http://localhost:3000/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ display_name: 'New Name' }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to create profile');
      });
    });
  });
});