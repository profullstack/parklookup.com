/**
 * Tests for Trail Comments API Routes
 * Tests GET, POST, PUT, DELETE operations for trail comments
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
import { GET, POST } from '@/app/api/trails/[id]/comments/route';
import { PUT, DELETE } from '@/app/api/trails/[id]/comments/[commentId]/route';

describe('Trail Comments API', () => {
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

  describe('GET /api/trails/[id]/comments', () => {
    it('should return comments for a valid trail', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          trail_id: 'trail-123',
          user_id: 'user-1',
          content: 'Great trail!',
          rating: 5,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'comment-2',
          trail_id: 'trail-123',
          user_id: 'user-2',
          content: 'Beautiful views',
          rating: 4,
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      const mockProfiles = [
        { id: 'user-1', display_name: 'User One', username: 'user1', avatar_url: null },
        { id: 'user-2', display_name: 'User Two', username: 'user2', avatar_url: null },
      ];

      let callCount = 0;
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'trails') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'trail-123' },
                error: null,
              }),
            };
          }
          if (table === 'trail_comments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: mockComments,
                error: null,
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({
                data: mockProfiles,
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/comments');
      const response = await GET(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].content).toBe('Great trail!');
      expect(data.comments[0].profile).toBeDefined();
      expect(data.comments[0].profile.display_name).toBe('User One');
    });

    it('should return 404 for non-existent trail', async () => {
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

      const request = new Request('http://localhost/api/trails/invalid/comments');
      const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });

      expect(response.status).toBe(404);
    });

    it('should return empty array when no comments exist', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'trails') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'trail-123' },
                error: null,
              }),
            };
          }
          if (table === 'trail_comments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/comments');
      const response = await GET(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toHaveLength(0);
    });
  });

  describe('POST /api/trails/[id]/comments', () => {
    it('should create a comment when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockComment = {
        id: 'new-comment',
        trail_id: 'trail-123',
        user_id: 'user-123',
        content: 'Amazing hike!',
        rating: 5,
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'trail-123' },
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      // Override select after insert
      mockSupabase.insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockComment,
            error: null,
          }),
        }),
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Amazing hike!', rating: 5 }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.comment.content).toBe('Amazing hike!');
      expect(data.comment.rating).toBe(5);
    });

    it('should return 401 when not authenticated', async () => {
      setupUnauthenticatedMock();

      const request = new Request('http://localhost/api/trails/trail-123/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test comment' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });

      expect(response.status).toBe(401);
    });

    it('should return 400 when content is empty', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabase = {};
      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', rating: 5 }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 when rating is invalid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabase = {};
      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test comment', rating: 10 }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });

      expect(response.status).toBe(400);
    });

    it('should allow comment without rating', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockComment = {
        id: 'new-comment',
        trail_id: 'trail-123',
        user_id: 'user-123',
        content: 'Nice trail',
        rating: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'trail-123' },
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      mockSupabase.insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockComment,
            error: null,
          }),
        }),
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Nice trail' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.comment.rating).toBeNull();
    });
  });

  describe('PUT /api/trails/[id]/comments/[commentId]', () => {
    it('should update own comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const existingComment = {
        id: 'comment-1',
        trail_id: 'trail-123',
        user_id: 'user-123',
        content: 'Original content',
        rating: 3,
      };

      const updatedComment = {
        ...existingComment,
        content: 'Updated content',
        rating: 5,
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingComment,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      mockSupabase.update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: updatedComment,
              error: null,
            }),
          }),
        }),
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/trails/trail-123/comments/comment-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated content', rating: 5 }),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'trail-123', commentId: 'comment-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comment.content).toBe('Updated content');
      expect(data.comment.rating).toBe(5);
    });

    it('should return 403 when updating another users comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const existingComment = {
        id: 'comment-1',
        trail_id: 'trail-123',
        user_id: 'other-user',
        content: 'Original content',
        rating: 3,
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingComment,
          error: null,
        }),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/trails/trail-123/comments/comment-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated content' }),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'trail-123', commentId: 'comment-1' }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent comment', async () => {
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

      const request = new Request(
        'http://localhost/api/trails/trail-123/comments/invalid',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated content' }),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'trail-123', commentId: 'invalid' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/trails/[id]/comments/[commentId]', () => {
    it('should delete own comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const existingComment = {
        id: 'comment-1',
        trail_id: 'trail-123',
        user_id: 'user-123',
        content: 'My comment',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingComment,
          error: null,
        }),
        delete: vi.fn().mockReturnThis(),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);

      mockSupabase.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/trails/trail-123/comments/comment-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123', commentId: 'comment-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 403 when deleting another users comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const existingComment = {
        id: 'comment-1',
        trail_id: 'trail-123',
        user_id: 'other-user',
        content: 'Not my comment',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingComment,
          error: null,
        }),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/trails/trail-123/comments/comment-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123', commentId: 'comment-1' }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 401 when not authenticated', async () => {
      setupUnauthenticatedMock();

      const request = new Request(
        'http://localhost/api/trails/trail-123/comments/comment-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123', commentId: 'comment-1' }),
      });

      expect(response.status).toBe(401);
    });
  });
});
