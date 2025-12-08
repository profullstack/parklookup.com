/**
 * Tests for Park Likes API Routes
 * Tests GET, POST, DELETE operations for park likes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the modules
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({
  getSession: vi.fn(),
}));

import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/auth';
import { GET, POST, DELETE } from '@/app/api/parks/[parkCode]/likes/route';

describe('Park Likes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/parks/[parkCode]/likes', () => {
    it('should return likes count and user status when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      // First call for park lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'park-123' },
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

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/likes');
      const response = await GET(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('likes_count');
      expect(data).toHaveProperty('user_has_liked');
    });

    it('should return likes count without user status when not authenticated', async () => {
      getSession.mockResolvedValue(null);

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
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

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/likes');
      const response = await GET(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user_has_liked).toBe(false);
    });

    it('should return 404 for non-existent park', async () => {
      getSession.mockResolvedValue(null);

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/invalid/likes');
      const response = await GET(request, { params: Promise.resolve({ parkCode: 'invalid' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/parks/[parkCode]/likes', () => {
    it('should add a like when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
          error: null,
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };

      // Override select for count after upsert
      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 6, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user_has_liked).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      getSession.mockResolvedValue(null);

      const request = new Request('http://localhost/api/parks/yose/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent park', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/invalid/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'invalid' }) });

      expect(response.status).toBe(404);
    });

    it('should handle duplicate likes gracefully (upsert)', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
          error: null,
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.select.mockImplementation((query, options) => {
        if (options?.count === 'exact') {
          return {
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          };
        }
        return mockSupabase;
      });

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/likes', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });

      expect(response.status).toBe(200);
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/parks/[parkCode]/likes', () => {
    it('should remove a like when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
          error: null,
        }),
        delete: vi.fn().mockReturnThis(),
      };

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

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/likes', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user_has_liked).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      getSession.mockResolvedValue(null);

      const request = new Request('http://localhost/api/parks/yose/likes', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ parkCode: 'yose' }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent park', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/invalid/likes', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ parkCode: 'invalid' }) });

      expect(response.status).toBe(404);
    });
  });
});