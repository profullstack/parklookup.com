/**
 * Favorites Tracks API Route Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Import after mocks
import { GET } from '@/app/api/favorites/tracks/route';

describe('Favorites Tracks API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/favorites/tracks', () => {
    it('should return 401 when no authorization header provided', async () => {
      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {},
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when authorization header is invalid format', async () => {
      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'InvalidFormat token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when token is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty tracks array when user has no liked tracks', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
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

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tracks).toEqual([]);
    });

    it('should return liked tracks with user and park info', async () => {
      const mockUser = { id: 'user-123' };
      const mockLikedTracks = [
        {
          id: 'like-1',
          created_at: '2024-01-15T10:00:00Z',
          track_id: 'track-1',
          user_tracks: {
            id: 'track-1',
            user_id: 'user-456',
            title: 'Morning Hike',
            description: 'A beautiful morning hike',
            activity_type: 'hiking',
            distance_meters: 5000,
            duration_seconds: 3600,
            elevation_gain_m: 200,
            status: 'shared',
            is_public: true,
            shared_at: '2024-01-14T10:00:00Z',
            park_code: 'yose',
            geometry: { type: 'LineString', coordinates: [] },
          },
        },
      ];

      const mockProfiles = [
        { id: 'user-456', display_name: 'John Doe', avatar_url: null, username: 'johndoe' },
      ];

      const mockParks = [{ id: 'park-1', park_code: 'yose', full_name: 'Yosemite National Park' }];

      const mockLikeCounts = [{ track_id: 'track-1' }, { track_id: 'track-1' }];

      const mockCommentCounts = [{ track_id: 'track-1' }];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockImplementation((selectStr) => {
              // Check if this is the main query with user_tracks join
              if (selectStr && selectStr.includes('user_tracks')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockLikedTracks, error: null }),
                  }),
                };
              }
              // This is the likes count query
              return {
                in: vi.fn().mockResolvedValue({ data: mockLikeCounts, error: null }),
              };
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
        if (table === 'track_comments') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockCommentCounts, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tracks).toHaveLength(1);
      expect(data.tracks[0].title).toBe('Morning Hike');
      expect(data.tracks[0].user_display_name).toBe('John Doe');
      expect(data.tracks[0].user_username).toBe('johndoe');
      expect(data.tracks[0].park_name).toBe('Yosemite National Park');
      expect(data.tracks[0].likes_count).toBe(2);
      expect(data.tracks[0].comments_count).toBe(1);
    });

    it('should filter out tracks that are no longer public', async () => {
      const mockUser = { id: 'user-123' };
      const mockLikedTracks = [
        {
          id: 'like-1',
          created_at: '2024-01-15T10:00:00Z',
          track_id: 'track-1',
          user_tracks: {
            id: 'track-1',
            user_id: 'user-456',
            title: 'Public Track',
            status: 'shared',
            is_public: true,
            park_code: 'yose',
          },
        },
        {
          id: 'like-2',
          created_at: '2024-01-14T10:00:00Z',
          track_id: 'track-2',
          user_tracks: {
            id: 'track-2',
            user_id: 'user-789',
            title: 'Private Track',
            status: 'completed',
            is_public: false,
            park_code: 'grca',
          },
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockImplementation((selectStr) => {
              if (selectStr && selectStr.includes('user_tracks')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockLikedTracks, error: null }),
                  }),
                };
              }
              return {
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Only the public track should be returned
      expect(data.tracks).toHaveLength(1);
      expect(data.tracks[0].title).toBe('Public Track');
    });

    it('should filter out deleted tracks (null user_tracks)', async () => {
      const mockUser = { id: 'user-123' };
      const mockLikedTracks = [
        {
          id: 'like-1',
          created_at: '2024-01-15T10:00:00Z',
          track_id: 'track-1',
          user_tracks: {
            id: 'track-1',
            user_id: 'user-456',
            title: 'Existing Track',
            status: 'shared',
            is_public: true,
            park_code: 'yose',
          },
        },
        {
          id: 'like-2',
          created_at: '2024-01-14T10:00:00Z',
          track_id: 'track-2',
          user_tracks: null, // Track was deleted
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockImplementation((selectStr) => {
              if (selectStr && selectStr.includes('user_tracks')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockLikedTracks, error: null }),
                  }),
                };
              }
              return {
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tracks).toHaveLength(1);
      expect(data.tracks[0].title).toBe('Existing Track');
    });

    it('should return 500 when database error occurs', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch liked tracks');
    });

    it('should handle tracks without park_code', async () => {
      const mockUser = { id: 'user-123' };
      const mockLikedTracks = [
        {
          id: 'like-1',
          created_at: '2024-01-15T10:00:00Z',
          track_id: 'track-1',
          user_tracks: {
            id: 'track-1',
            user_id: 'user-456',
            title: 'Trail Track',
            status: 'shared',
            is_public: true,
            park_code: null, // No park, maybe just a trail
          },
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockImplementation((selectStr) => {
              if (selectStr && selectStr.includes('user_tracks')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockLikedTracks, error: null }),
                  }),
                };
              }
              return {
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tracks).toHaveLength(1);
      expect(data.tracks[0].park_code).toBeNull();
      expect(data.tracks[0].park_name).toBeUndefined();
    });

    it('should include like_id and liked_at in response', async () => {
      const mockUser = { id: 'user-123' };
      const likedAt = '2024-01-15T10:00:00Z';
      const mockLikedTracks = [
        {
          id: 'like-abc-123',
          created_at: likedAt,
          track_id: 'track-1',
          user_tracks: {
            id: 'track-1',
            user_id: 'user-456',
            title: 'Test Track',
            status: 'shared',
            is_public: true,
            park_code: 'yose',
          },
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'track_likes') {
          return {
            select: vi.fn().mockImplementation((selectStr) => {
              if (selectStr && selectStr.includes('user_tracks')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockLikedTracks, error: null }),
                  }),
                };
              }
              return {
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const request = new Request('http://localhost/api/favorites/tracks', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tracks[0].like_id).toBe('like-abc-123');
      expect(data.tracks[0].liked_at).toBe(likedAt);
    });
  });
});
