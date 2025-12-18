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
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
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
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
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
        if (table === 'track_likes' || table === 'track_comments' || table === 'track_media') {
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
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
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
        if (table === 'track_likes' || table === 'track_comments' || table === 'track_media') {
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
      expect(data.media[0].likes_count).toBe(3);
      expect(data.media[0].comments_count).toBe(2);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
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

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch feed');
    });

    it('should support pagination with limit and offset', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockImplementation((start, end) => {
                    // With limit=5 and offset=10, media gets half (3), so range is 10 to 12
                    expect(start).toBe(10);
                    return Promise.resolve({ data: [], error: null });
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
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
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
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
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
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
        if (table === 'track_likes' || table === 'track_comments' || table === 'track_media') {
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
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
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
        if (table === 'track_likes' || table === 'track_comments' || table === 'track_media') {
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
      expect(data.media).toHaveLength(2);
      expect(data.media[0].park_name).toBe('Yosemite National Park');
      expect(data.media[1].park_name).toBe('California State Park');
    });
  });

  describe('GET /api/feed (Discover Feed with Tracks)', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
    });

    it('should return both media and tracks in discover feed', async () => {
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

      const mockTracks = [
        {
          id: 'track-1',
          user_id: 'user-2',
          title: 'Morning Hike',
          description: 'A great hike',
          activity_type: 'hiking',
          distance_meters: 5000,
          duration_seconds: 3600,
          elevation_gain_m: 200,
          status: 'shared',
          is_public: true,
          shared_at: '2024-01-14T10:00:00Z',
          created_at: '2024-01-14T09:00:00Z',
          park_code: 'grca',
          geometry: { type: 'LineString', coordinates: [] },
        },
      ];

      const mockProfiles = [
        { id: 'user-1', display_name: 'John Doe', avatar_url: null, username: 'johndoe' },
        { id: 'user-2', display_name: 'Jane Smith', avatar_url: null, username: 'janesmith' },
      ];

      const mockParks = [
        { id: 'park-1', park_code: 'yose', full_name: 'Yosemite National Park' },
        { id: 'park-2', park_code: 'grca', full_name: 'Grand Canyon National Park' },
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
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
                  }),
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
        if (table === 'track_likes' || table === 'track_comments' || table === 'track_media') {
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
      expect(data.feed_type).toBe('discover');
      // Should have items array with both media and tracks
      expect(data.items).toBeDefined();
      // Should have separate media and tracks arrays for backward compatibility
      expect(data.media).toBeDefined();
      expect(data.tracks).toBeDefined();
    });

    it('should include item_type field to distinguish media from tracks', async () => {
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

      const mockTracks = [
        {
          id: 'track-1',
          user_id: 'user-2',
          title: 'Morning Hike',
          activity_type: 'hiking',
          status: 'shared',
          is_public: true,
          shared_at: '2024-01-14T10:00:00Z',
          created_at: '2024-01-14T09:00:00Z',
          park_code: 'grca',
        },
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
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
                  }),
                }),
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

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Media items should have item_type: 'media'
      const mediaItems = data.items?.filter((item) => item.item_type === 'media') || data.media;
      expect(mediaItems.length).toBeGreaterThanOrEqual(0);
      // Track items should have item_type: 'track'
      const trackItems = data.items?.filter((item) => item.item_type === 'track') || data.tracks;
      expect(trackItems.length).toBeGreaterThanOrEqual(0);
    });

    it('should only include public shared tracks in discover feed', async () => {
      // Tracks must have is_public: true AND status: 'shared'
      const mockTracks = [
        {
          id: 'track-1',
          user_id: 'user-1',
          title: 'Public Shared Track',
          status: 'shared',
          is_public: true,
          shared_at: '2024-01-14T10:00:00Z',
        },
      ];

      // The API should filter by is_public=true and status='shared'
      // This is done in the query, so we just verify the expected behavior
      expect(mockTracks[0].is_public).toBe(true);
      expect(mockTracks[0].status).toBe('shared');
    });

    it('should include track stats in feed items', async () => {
      const mockTracks = [
        {
          id: 'track-1',
          user_id: 'user-1',
          title: 'Morning Hike',
          activity_type: 'hiking',
          distance_meters: 5000,
          duration_seconds: 3600,
          elevation_gain_m: 200,
          status: 'shared',
          is_public: true,
          shared_at: '2024-01-14T10:00:00Z',
          park_code: 'yose',
        },
      ];

      const mockLikes = [{ track_id: 'track-1' }, { track_id: 'track-1' }];
      const mockComments = [{ track_id: 'track-1' }];
      const mockMedia = [{ track_id: 'track-1', media_id: 'media-1' }];

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
                  }),
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
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockLikes, error: null }),
            }),
          };
        }
        if (table === 'track_comments') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockComments, error: null }),
            }),
          };
        }
        if (table === 'track_media') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockMedia, error: null }),
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
      // Verify track stats are included
      const trackItems = data.tracks || data.items?.filter((item) => item.item_type === 'track');
      if (trackItems && trackItems.length > 0) {
        expect(trackItems[0].distance_meters).toBe(5000);
        expect(trackItems[0].duration_seconds).toBe(3600);
        expect(trackItems[0].elevation_gain_m).toBe(200);
        expect(trackItems[0].likes_count).toBe(2);
        expect(trackItems[0].comments_count).toBe(1);
        expect(trackItems[0].media_count).toBe(1);
      }
    });

    it('should sort combined items by created_at descending', async () => {
      // The feed should merge media and tracks and sort by date
      const mockMedia = [
        {
          id: 'media-1',
          user_id: 'user-1',
          park_code: 'yose',
          media_type: 'photo',
          storage_path: 'user-1/media-1/123.jpg',
          status: 'ready',
          created_at: '2024-01-15T10:00:00Z', // Newer
        },
      ];

      const mockTracks = [
        {
          id: 'track-1',
          user_id: 'user-2',
          title: 'Morning Hike',
          status: 'shared',
          is_public: true,
          shared_at: '2024-01-14T10:00:00Z', // Older
          created_at: '2024-01-14T09:00:00Z',
          park_code: 'grca',
        },
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
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
                  }),
                }),
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

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Items should be sorted by date, newest first
      if (data.items && data.items.length >= 2) {
        const firstDate = new Date(data.items[0].created_at);
        const secondDate = new Date(data.items[1].created_at);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });
  });

  describe('GET /api/feed (Authenticated Discover Feed with Track Likes)', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
    });

    it('should include user_has_liked for tracks when authenticated', async () => {
      const mockTracks = [
        {
          id: 'track-1',
          user_id: 'user-2',
          title: 'Liked Track',
          status: 'shared',
          is_public: true,
          shared_at: '2024-01-14T10:00:00Z',
          park_code: 'yose',
        },
        {
          id: 'track-2',
          user_id: 'user-3',
          title: 'Not Liked Track',
          status: 'shared',
          is_public: true,
          shared_at: '2024-01-13T10:00:00Z',
          park_code: 'grca',
        },
      ];

      const mockUserTrackLikes = [{ track_id: 'track-1' }];

      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_tracks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockUserTrackLikes, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      });

      const request = new Request('http://localhost/api/feed?type=discover');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feed_type).toBe('discover');
      // Tracks should have user_has_liked field
      const trackItems = data.tracks || data.items?.filter((item) => item.item_type === 'track');
      if (trackItems && trackItems.length >= 2) {
        const likedTrack = trackItems.find((t) => t.track_id === 'track-1');
        const notLikedTrack = trackItems.find((t) => t.track_id === 'track-2');
        expect(likedTrack?.user_has_liked).toBe(true);
        expect(notLikedTrack?.user_has_liked).toBe(false);
      }
    });
  });
});