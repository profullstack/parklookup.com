/**
 * Tests for Trail Media API Routes
 * Tests GET, POST, DELETE operations for trail media
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
import { GET, POST, DELETE } from '@/app/api/trails/[id]/media/route';

describe('Trail Media API', () => {
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

  describe('GET /api/trails/[id]/media', () => {
    it('should return media for a valid trail', async () => {
      const mockMedia = [
        {
          id: 'media-1',
          trail_id: 'trail-123',
          user_id: 'user-1',
          url: 'https://example.com/photo1.jpg',
          media_type: 'image',
          caption: 'Beautiful view',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'media-2',
          trail_id: 'trail-123',
          user_id: 'user-2',
          url: 'https://example.com/photo2.jpg',
          media_type: 'image',
          caption: 'Trail entrance',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'trail-123' },
          error: null,
        }),
        order: vi.fn().mockResolvedValue({
          data: mockMedia,
          error: null,
        }),
      };

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/media');
      const response = await GET(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media).toHaveLength(2);
      expect(data.media[0].url).toBe('https://example.com/photo1.jpg');
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

      const request = new Request('http://localhost/api/trails/invalid/media');
      const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });

      expect(response.status).toBe(404);
    });

    it('should return empty array when no media exists', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'trail-123' },
          error: null,
        }),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/media');
      const response = await GET(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media).toHaveLength(0);
    });
  });

  describe('POST /api/trails/[id]/media', () => {
    it('should create media when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockMedia = {
        id: 'new-media',
        trail_id: 'trail-123',
        user_id: 'user-123',
        url: 'https://example.com/new-photo.jpg',
        media_type: 'image',
        caption: 'My hiking photo',
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
            data: mockMedia,
            error: null,
          }),
        }),
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/new-photo.jpg',
          media_type: 'image',
          caption: 'My hiking photo',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.media.url).toBe('https://example.com/new-photo.jpg');
      expect(data.media.caption).toBe('My hiking photo');
    });

    it('should return 401 when not authenticated', async () => {
      setupUnauthenticatedMock();

      const request = new Request('http://localhost/api/trails/trail-123/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/photo.jpg' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });

      expect(response.status).toBe(401);
    });

    it('should return 400 when URL is missing', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabase = {};
      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: 'No URL provided' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });

      expect(response.status).toBe(400);
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

      const request = new Request('http://localhost/api/trails/invalid/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/photo.jpg' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'invalid' }) });

      expect(response.status).toBe(404);
    });

    it('should allow media without caption', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockMedia = {
        id: 'new-media',
        trail_id: 'trail-123',
        user_id: 'user-123',
        url: 'https://example.com/photo.jpg',
        media_type: 'image',
        caption: null,
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
            data: mockMedia,
            error: null,
          }),
        }),
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/photo.jpg' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.media.caption).toBeNull();
    });

    it('should default media_type to image', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockMedia = {
        id: 'new-media',
        trail_id: 'trail-123',
        user_id: 'user-123',
        url: 'https://example.com/photo.jpg',
        media_type: 'image',
        caption: null,
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
            data: mockMedia,
            error: null,
          }),
        }),
      });

      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/photo.jpg' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'trail-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.media.media_type).toBe('image');
    });
  });

  describe('DELETE /api/trails/[id]/media', () => {
    it('should delete own media', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const existingMedia = {
        id: 'media-1',
        trail_id: 'trail-123',
        user_id: 'user-123',
        url: 'https://example.com/photo.jpg',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingMedia,
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
        'http://localhost/api/trails/trail-123/media?mediaId=media-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 403 when deleting another users media', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const existingMedia = {
        id: 'media-1',
        trail_id: 'trail-123',
        user_id: 'other-user',
        url: 'https://example.com/photo.jpg',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingMedia,
          error: null,
        }),
      };

      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request(
        'http://localhost/api/trails/trail-123/media?mediaId=media-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123' }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 401 when not authenticated', async () => {
      setupUnauthenticatedMock();

      const request = new Request(
        'http://localhost/api/trails/trail-123/media?mediaId=media-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123' }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 when mediaId is missing', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabase = {};
      setupAuthenticatedMock(mockSupabase, mockUser);
      createServiceClient.mockReturnValue(mockSupabase);

      const request = new Request('http://localhost/api/trails/trail-123/media', {
        method: 'DELETE',
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123' }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent media', async () => {
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
        'http://localhost/api/trails/trail-123/media?mediaId=invalid',
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'trail-123' }),
      });

      expect(response.status).toBe(404);
    });
  });
});
