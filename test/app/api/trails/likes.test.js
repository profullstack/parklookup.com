/**
 * Tests for Trail Likes API Routes
 * Tests GET, POST, DELETE operations for trail likes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

// Mock the modules
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { GET, POST, DELETE } from '@/app/api/trails/[id]/likes/route';

describe('Trail Likes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to setup authenticated mock
   */
  const setupAuthenticatedMock = (mockSupabase, mockUser) => {
    // Mock headers to return authorization
    headers.mockResolvedValue({
      get: vi.fn((name) => {
        if (name === 'authorization') {
          return `Bearer test-token`;
        }
        return null;
      }),
    });

    // Mock auth.getUser to return the user
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
    };
  };

  /**
   * Helper to setup unauthenticated mock
   */
  const setupUnauthenticatedMock = () => {
    headers.mockResolvedValue({
      get: vi.fn(() => null),
    });
  };

  describe('GET /api/trails/[id]/likes', () => {
    it('should return likes count and user status when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      // First call for trail lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'trail-123' },
        error: null,
      });

      // Second call for user like check
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'like-1' },
        error: null,
      });

      // Override select for count
      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/likes');
      const response = await GET(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('likes_count');
      expect(data).toHaveProperty('user_has_liked');
    });

    it('should return likes count without user status when not authenticated', async () => {
      setupUnauthenticatedMock();

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'trail-123' },
          error: null,
        }),
      };

      // Override select for count
      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/likes');
      const response = await GET(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user_has_liked).toBe(false);
    });

    it('should return 404 for non-existent trail', async () => {
      setupUnauthenticatedMock();

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/invalid/likes');
      const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/trails/[id]/likes', () => {
    it('should add a like when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      // First call for trail lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'trail-123' },
        error: null,
      });

      // Second call for existing like check (no existing like)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      // Override select for count after insert
      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 6, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user_has_liked).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      setupUnauthenticatedMock();

      const request = new Request('http://localhost/api/trails/trail-123/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent trail', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/invalid/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'invalid' }) });

      expect(response.status).toBe(404);
    });

    it('should handle already liked trail gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      // First call for trail lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'trail-123' },
        error: null,
      });

      // Second call for existing like check (already liked)
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'like-1' },
        error: null,
      });

      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user_has_liked).toBe(true);
    });
  });

  describe('DELETE /api/trails/[id]/likes', () => {
    it('should remove a like when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'trail-123' },
          error: null,
        }),
        delete: vi.fn().mockReturnThis(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      mockSupabase.delete.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/likes', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user_has_liked).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      setupUnauthenticatedMock();

      const request = new Request('http://localhost/api/trails/trail-123/likes', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'trail-123' }) });

      expect(response.status).toBe(401);
    });

    it('should succeed even for non-existent trail (no-op delete)', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      mockSupabase.delete.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/invalid/likes', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid' }) });
      const data = await response.json();

      // DELETE is idempotent - deleting a non-existent like is a no-op
      expect(response.status).toBe(200);
      expect(data.user_has_liked).toBe(false);
    });
  });
});
