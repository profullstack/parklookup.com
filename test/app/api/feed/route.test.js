/**
 * Feed API Route Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabaseClient,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((name) => {
      if (name === 'authorization') return 'Bearer test-token';
      return null;
    }),
  })),
}));

// Import after mocks
import { GET } from '@/app/api/feed/route';

describe('Feed API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/feed (Discover Feed)', () => {
    beforeEach(() => {
      // Default to unauthenticated
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
    });

    it('should return empty array when no media found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media).toEqual([]);
      expect(data.feed_type).toBe('discover');
    });

    it('should return media with user and park info', async () => {
      const mockMedia = [
        {
          id: 'media-1',
          user_id: 'user-1',
          park_code: 'yose',
          media_type: 'photo',
          storage_path: 'user-1/media-1/123.jpg',
          thumbnail_path: 'user-1/media-1/123-thumb.jpg',
          title: 'Test Photo',
          status: 'ready',
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockProfiles = [{ id: 'user-1', display_name: 'John Doe', avatar_url: null }];
      const mockParks = [{ id: 'park-1', park_code: 'yose', full_name: 'Yosemite National Park' }];

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: mockMedia, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
            }),
          };
        }
        if (table === 'all_parks') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockParks, error: null }),
            }),
          };
        }
        if (table === 'media_likes' || table === 'media_comments') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media).toHaveLength(1);
      expect(data.media[0].title).toBe('Test Photo');
      expect(data.media[0].user_display_name).toBe('John Doe');
      expect(data.media[0].park_name).toBe('Yosemite National Park');
      expect(data.feed_type).toBe('discover');
    });

    it('should include likes and comments counts', async () => {
      const mockMedia = [
        {
          id: 'media-1',
          user_id: 'user-1',
          park_code: 'yose',
          media_type: 'photo',
          storage_path: 'user-1/media-1/123.jpg',
          status: 'ready',
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockLikes = [
        { media_id: 'media-1' },
        { media_id: 'media-1' },
        { media_id: 'media-1' },
      ];

      const mockComments = [
        { media_id: 'media-1' },
        { media_id: 'media-1' },
      ];

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: mockMedia, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'all_parks') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'media_likes') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockLikes, error: null }),
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'media_comments') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockComments, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media[0].likes_count).toBe(3);
      expect(data.media[0].comments_count).toBe(2);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch feed');
    });

    it('should support pagination with limit and offset', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockImplementation((start, end) => {
                expect(start).toBe(10);
                expect(end).toBe(14);
                return Promise.resolve({ data: [], error: null });
              }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost/api/feed?limit=5&offset=10');
      await GET(request);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_media');
    });
  });

  describe('GET /api/feed (Following Feed)', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
    });

    it('should return following feed for authenticated user', async () => {
      const mockFeedMedia = [
        {
          media_id: 'media-1',
          user_id: 'user-2',
          park_code: 'yose',
          media_type: 'photo',
          storage_path: 'user-2/media-1/123.jpg',
          thumbnail_path: 'user-2/media-1/123-thumb.jpg',
          title: 'Friend Photo',
          user_display_name: 'Jane Doe',
          user_avatar_url: null,
          park_name: 'Yosemite National Park',
          likes_count: 5,
          comments_count: 2,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({ data: mockFeedMedia, error: null });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media).toHaveLength(1);
      expect(data.media[0].title).toBe('Friend Photo');
      expect(data.feed_type).toBe('following');
    });

    it('should call get_user_feed RPC with correct parameters', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      const request = new Request('http://localhost/api/feed?limit=10&offset=5');
      await GET(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_user_feed', {
        p_user_id: 'user-123',
        p_limit: 10,
        p_offset: 5,
      });
    });

    it('should include user_has_liked status for authenticated user', async () => {
      const mockFeedMedia = [
        {
          media_id: 'media-1',
          user_id: 'user-2',
          storage_path: 'user-2/media-1/123.jpg',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          media_id: 'media-2',
          user_id: 'user-3',
          storage_path: 'user-3/media-2/123.jpg',
          created_at: '2024-01-14T10:00:00Z',
        },
      ];

      const mockUserLikes = [{ media_id: 'media-1' }];

      mockSupabaseClient.rpc.mockResolvedValue({ data: mockFeedMedia, error: null });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockUserLikes, error: null }),
          }),
        }),
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media[0].user_has_liked).toBe(true);
      expect(data.media[1].user_has_liked).toBe(false);
    });

    it('should return discover feed when type=discover even if authenticated', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const request = new Request('http://localhost/api/feed?type=discover');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feed_type).toBe('discover');
      // Should not call RPC for following feed
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it('should handle RPC errors', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch feed');
    });
  });

  describe('GET /api/feed (Authenticated Discover Feed)', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
    });

    it('should include user_has_liked in discover feed for authenticated user', async () => {
      const mockMedia = [
        {
          id: 'media-1',
          user_id: 'user-1',
          park_code: 'yose',
          media_type: 'photo',
          storage_path: 'user-1/media-1/123.jpg',
          status: 'ready',
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockUserLikes = [{ media_id: 'media-1' }];

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: mockMedia, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'media_likes') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockUserLikes, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      // Mock RPC to return empty (so it falls through to discover)
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed?type=discover');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feed_type).toBe('discover');
      expect(data.media[0].user_has_liked).toBe(true);
    });
  });

  describe('Media from different park types', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
    });

    it('should return media from both NPS and state parks', async () => {
      const mockMedia = [
        {
          id: 'media-1',
          user_id: 'user-1',
          park_code: 'yose', // NPS park
          media_type: 'photo',
          storage_path: 'user-1/media-1/123.jpg',
          status: 'ready',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'media-2',
          user_id: 'user-2',
          park_code: 'ca-state-1', // State park
          media_type: 'photo',
          storage_path: 'user-2/media-2/123.jpg',
          status: 'ready',
          created_at: '2024-01-14T10:00:00Z',
        },
      ];

      const mockParks = [
        { id: 'park-1', park_code: 'yose', full_name: 'Yosemite National Park' },
        { id: 'park-2', park_code: 'ca-state-1', full_name: 'California State Park' },
      ];

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: mockMedia, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'all_parks') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockParks, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media).toHaveLength(2);
      expect(data.media[0].park_name).toBe('Yosemite National Park');
      expect(data.media[1].park_name).toBe('California State Park');
    });
  });
});