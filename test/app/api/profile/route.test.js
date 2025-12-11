/**
 * Profile API Tests
 * Tests for the user profile API endpoint
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, PUT } from '@/app/api/profile/route';

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabase),
}));

// Helper to create request with auth header
const createAuthRequest = (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', 'Bearer test-token');
  return new Request(url, { ...options, headers });
};

describe('Profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/profile', () => {
    it('should return 401 if no authorization header', async () => {
      const request = new Request('http://localhost/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = createAuthRequest('http://localhost/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return existing profile for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'testuser',
        avatar_url: null,
        preferences: { darkMode: false },
        is_pro: false,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockProfile,
          error: null,
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile).toEqual(mockProfile);
      expect(data.user.id).toBe('user-123');
      expect(data.user.email).toBe('test@example.com');
    });

    it('should create profile if it does not exist', async () => {
      const mockUser = { id: 'user-456', email: 'new@example.com' };
      const mockNewProfile = {
        id: 'user-456',
        email: 'new@example.com',
        display_name: 'new',
        avatar_url: null,
        preferences: {},
        is_pro: false,
      };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // First call - profile doesn't exist
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' }, // No rows returned
        }),
      });

      // Second call - create profile
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockNewProfile,
          error: null,
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile).toEqual(mockNewProfile);
    });

    it('should return 500 if database error occurs', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: 'SOME_ERROR', message: 'Database error' },
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch profile');
    });

    it('should return 500 if profile creation fails', async () => {
      const mockUser = { id: 'user-456', email: 'new@example.com' };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // Profile doesn't exist
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      // Creation fails
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Insert failed' },
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create profile');
    });
  });

  describe('PUT /api/profile', () => {
    it('should return 401 if no authorization header', async () => {
      const request = new Request('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'newname' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = createAuthRequest('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'newname' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should update existing profile', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUpdatedProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'newname',
        avatar_url: null,
        preferences: { darkMode: true },
        is_pro: false,
      };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // Check if profile exists
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'user-123' },
          error: null,
        }),
      });

      // Update profile
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockUpdatedProfile,
          error: null,
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: 'newname',
          preferences: { darkMode: true },
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.display_name).toBe('newname');
      expect(data.profile.preferences.darkMode).toBe(true);
    });

    it('should create profile if it does not exist during update', async () => {
      const mockUser = { id: 'user-789', email: 'new@example.com' };
      const mockNewProfile = {
        id: 'user-789',
        email: 'new@example.com',
        display_name: 'newuser',
        avatar_url: null,
        preferences: {},
        is_pro: false,
      };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // Profile doesn't exist
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      });

      // Create profile
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockNewProfile,
          error: null,
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'newuser' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile).toEqual(mockNewProfile);
    });

    it('should update avatar_url', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUpdatedProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
        preferences: {},
        is_pro: false,
      };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'user-123' },
          error: null,
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockUpdatedProfile,
          error: null,
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ avatar_url: 'https://example.com/avatar.jpg' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.avatar_url).toBe('https://example.com/avatar.jpg');
    });

    it('should return 500 if update fails', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'user-123' },
          error: null,
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Update failed' },
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'newname' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update profile');
    });

    it('should return 500 if profile creation during update fails', async () => {
      const mockUser = { id: 'user-789', email: 'new@example.com' };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Insert failed' },
        }),
      });

      const request = createAuthRequest('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'newuser' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create profile');
    });

    it('should handle partial updates', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUpdatedProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'testuser',
        avatar_url: null,
        preferences: { units: 'metric' },
        is_pro: false,
      };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'user-123' },
          error: null,
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockUpdatedProfile,
          error: null,
        }),
      });

      // Only update preferences
      const request = createAuthRequest('http://localhost/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ preferences: { units: 'metric' } }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.preferences.units).toBe('metric');
    });
  });
});