/**
 * Tests for Park Comments API Routes
 * Tests GET, POST, PUT, DELETE operations for park comments
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
import { GET, POST } from '@/app/api/parks/[parkCode]/comments/route';
import {
  PUT,
  DELETE,
} from '@/app/api/parks/[parkCode]/comments/[commentId]/route';

describe('Park Comments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/parks/[parkCode]/comments', () => {
    it('should return comments for a valid park', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          park_id: 'park-123',
          user_id: 'user-1',
          content: 'Great park!',
          rating: 5,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'comment-2',
          park_id: 'park-123',
          user_id: 'user-2',
          content: 'Beautiful scenery',
          rating: 4,
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
          error: null,
        }),
        order: vi.fn().mockResolvedValue({
          data: mockComments,
          error: null,
        }),
      };

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/comments');
      const response = await GET(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].content).toBe('Great park!');
    });

    it('should return 404 for non-existent park', async () => {
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

      const request = new Request('http://localhost/api/parks/invalid/comments');
      const response = await GET(request, { params: Promise.resolve({ parkCode: 'invalid' }) });

      expect(response.status).toBe(404);
    });

    it('should return empty array when no comments exist', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
          error: null,
        }),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/comments');
      const response = await GET(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toHaveLength(0);
    });
  });

  describe('POST /api/parks/[parkCode]/comments', () => {
    it('should create a comment when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockComment = {
        id: 'new-comment',
        park_id: 'park-123',
        user_id: 'user-123',
        content: 'Amazing experience!',
        rating: 5,
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
      };

      // Override select after insert
      mockSupabase.insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockComment,
            error: null,
          }),
        }),
      });

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Amazing experience!', rating: 5 }),
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.comment.content).toBe('Amazing experience!');
      expect(data.comment.rating).toBe(5);
    });

    it('should return 401 when not authenticated', async () => {
      getSession.mockResolvedValue(null);

      const request = new Request('http://localhost/api/parks/yose/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test comment' }),
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });

      expect(response.status).toBe(401);
    });

    it('should return 400 when content is empty', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const request = new Request('http://localhost/api/parks/yose/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', rating: 5 }),
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 when rating is invalid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const request = new Request('http://localhost/api/parks/yose/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test comment', rating: 10 }),
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });

      expect(response.status).toBe(400);
    });

    it('should allow comment without rating', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const mockComment = {
        id: 'new-comment',
        park_id: 'park-123',
        user_id: 'user-123',
        content: 'Nice park',
        rating: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'park-123' },
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
      };

      mockSupabase.insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockComment,
            error: null,
          }),
        }),
      });

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request('http://localhost/api/parks/yose/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Nice park' }),
      });

      const response = await POST(request, { params: Promise.resolve({ parkCode: 'yose' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.comment.rating).toBeNull();
    });
  });

  describe('PUT /api/parks/[parkCode]/comments/[commentId]', () => {
    it('should update own comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const existingComment = {
        id: 'comment-1',
        park_id: 'park-123',
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

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/parks/yose/comments/comment-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated content', rating: 5 }),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ parkCode: 'yose', commentId: 'comment-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comment.content).toBe('Updated content');
      expect(data.comment.rating).toBe(5);
    });

    it('should return 403 when updating another users comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const existingComment = {
        id: 'comment-1',
        park_id: 'park-123',
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

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/parks/yose/comments/comment-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated content' }),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ parkCode: 'yose', commentId: 'comment-1' }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent comment', async () => {
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

      const request = new Request(
        'http://localhost/api/parks/yose/comments/invalid',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated content' }),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ parkCode: 'yose', commentId: 'invalid' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/parks/[parkCode]/comments/[commentId]', () => {
    it('should delete own comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const existingComment = {
        id: 'comment-1',
        park_id: 'park-123',
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

      mockSupabase.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/parks/yose/comments/comment-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ parkCode: 'yose', commentId: 'comment-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 403 when deleting another users comment', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getSession.mockResolvedValue({ user: mockUser });

      const existingComment = {
        id: 'comment-1',
        park_id: 'park-123',
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

      createServiceClient.mockResolvedValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/parks/yose/comments/comment-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ parkCode: 'yose', commentId: 'comment-1' }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 401 when not authenticated', async () => {
      getSession.mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/parks/yose/comments/comment-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ parkCode: 'yose', commentId: 'comment-1' }),
      });

      expect(response.status).toBe(401);
    });
  });
});