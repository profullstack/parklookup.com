/**
 * Track Comments API Route Tests
 * Tests for GET /api/tracks/[id]/comments and POST /api/tracks/[id]/comments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/tracks/[id]/comments/route.js';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabase),
}));

// Helper to create mock request
const createMockRequest = (options = {}) => {
  const { method = 'GET', body = null, token = null, searchParams = {} } = options;
  const url = new URL('http://localhost:3000/api/tracks/test-track-id/comments');
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return {
    method,
    url: url.toString(),
    headers: {
      get: (name) => {
        if (name === 'authorization' && token) {
          return `Bearer ${token}`;
        }
        return null;
      },
    },
    json: async () => body,
  };
};

// Helper to create mock params
const createMockParams = (id = 'test-track-id') => ({
  params: Promise.resolve({ id }),
});

describe('Track Comments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tracks/[id]/comments', () => {
    it('should return 400 if track ID is missing', async () => {
      const request = createMockRequest();
      const { params } = createMockParams(null);

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Track ID is required');
    });

    it('should return 404 if track does not exist', async () => {
      const request = createMockRequest();
      const { params } = createMockParams('non-existent-track');

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Track not found');
    });

    it('should return 404 for private track when user is not owner', async () => {
      const request = createMockRequest({ token: 'user-token' });
      const { params } = createMockParams('private-track');

      // Mock track query - private track owned by different user
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'private-track',
                  user_id: 'other-user-id',
                  is_public: false,
                  status: 'completed',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Mock auth - different user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'current-user-id' } },
        error: null,
      });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Track not found');
    });

    it('should return comments for public track', async () => {
      const request = createMockRequest();
      const { params } = createMockParams('public-track');

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Great track!',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          profiles: {
            id: 'user-1',
            display_name: 'John Doe',
            avatar_url: 'https://example.com/avatar.jpg',
            username: 'johndoe',
          },
        },
      ];

      // First call - track query
      const trackQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'public-track',
                  user_id: 'owner-id',
                  is_public: true,
                  status: 'shared',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Second call - comments query
      const commentsQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: mockComments,
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        }),
      };

      // Third call - replies query
      const repliesQuery = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_tracks') {
          return trackQuery;
        }
        if (table === 'track_comments') {
          callCount++;
          return callCount === 1 ? commentsQuery : repliesQuery;
        }
        return {};
      });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toHaveLength(1);
      expect(data.comments[0].content).toBe('Great track!');
      expect(data.comments[0].user.displayName).toBe('John Doe');
      expect(data.commentsCount).toBe(1);
    });

    it('should return comments for public track without authentication (is_public=true, any status)', async () => {
      // This tests that unauthenticated users can view comments on public tracks
      // even if the status is not 'shared' (e.g., 'completed')
      const request = createMockRequest(); // No token - unauthenticated
      const { params } = createMockParams('public-completed-track');

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Nice hike!',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          profiles: {
            id: 'user-1',
            display_name: 'Hiker Jane',
            avatar_url: 'https://example.com/jane.jpg',
            username: 'hikerjane',
          },
        },
      ];

      // Track query - public but status is 'completed' not 'shared'
      const trackQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'public-completed-track',
                  user_id: 'owner-id',
                  is_public: true,
                  status: 'completed', // Not 'shared'
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Comments query
      const commentsQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: mockComments,
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        }),
      };

      // Replies query
      const repliesQuery = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_tracks') {
          return trackQuery;
        }
        if (table === 'track_comments') {
          callCount++;
          return callCount === 1 ? commentsQuery : repliesQuery;
        }
        return {};
      });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toHaveLength(1);
      expect(data.comments[0].content).toBe('Nice hike!');
      expect(data.comments[0].user.displayName).toBe('Hiker Jane');
      expect(data.commentsCount).toBe(1);
    });

    it('should return comments with replies', async () => {
      const request = createMockRequest();
      const { params } = createMockParams('public-track');

      const mockComments = [
        {
          id: 'comment-1',
          content: 'Great track!',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          profiles: {
            id: 'user-1',
            display_name: 'John Doe',
            avatar_url: null,
            username: 'johndoe',
          },
        },
      ];

      const mockReplies = [
        {
          id: 'reply-1',
          content: 'Thanks!',
          parent_id: 'comment-1',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          profiles: {
            id: 'user-2',
            display_name: 'Jane Doe',
            avatar_url: null,
            username: 'janedoe',
          },
        },
      ];

      // Track query
      const trackQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'public-track',
                  user_id: 'owner-id',
                  is_public: true,
                  status: 'shared',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Comments query
      const commentsQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: mockComments,
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        }),
      };

      // Replies query
      const repliesQuery = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockReplies,
              error: null,
            }),
          }),
        }),
      };

      let commentsCallCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_tracks') {
          return trackQuery;
        }
        if (table === 'track_comments') {
          commentsCallCount++;
          return commentsCallCount === 1 ? commentsQuery : repliesQuery;
        }
        return {};
      });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toHaveLength(1);
      expect(data.comments[0].replies).toHaveLength(1);
      expect(data.comments[0].replies[0].content).toBe('Thanks!');
    });
  });

  describe('POST /api/tracks/[id]/comments', () => {
    it('should return 401 if not authenticated', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { content: 'Test comment' },
      });
      const { params } = createMockParams('test-track');

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 400 if content is missing', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {},
        token: 'valid-token',
      });
      const { params } = createMockParams('test-track');

      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null,
      });

      // Mock track query
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-track',
                  user_id: 'owner-id',
                  is_public: true,
                  status: 'shared',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Comment content is required');
    });

    it('should return 400 if content is too long', async () => {
      const longContent = 'a'.repeat(2001);
      const request = createMockRequest({
        method: 'POST',
        body: { content: longContent },
        token: 'valid-token',
      });
      const { params } = createMockParams('test-track');

      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null,
      });

      // Mock track query
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-track',
                  user_id: 'owner-id',
                  is_public: true,
                  status: 'shared',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Comment content must be 2000 characters or less');
    });

    it('should create a comment successfully', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { content: 'Great track!' },
        token: 'valid-token',
      });
      const { params } = createMockParams('test-track');

      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null,
      });

      const mockCreatedComment = {
        id: 'new-comment-id',
        content: 'Great track!',
        parent_id: null,
        created_at: '2024-01-01T00:00:00Z',
        profiles: {
          id: 'user-id',
          display_name: 'Test User',
          avatar_url: null,
          username: 'testuser',
        },
      };

      // Track query
      const trackQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-track',
                  user_id: 'owner-id',
                  is_public: true,
                  status: 'shared',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Insert query - properly chain insert -> select -> single
      const insertQuery = {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockCreatedComment,
              error: null,
            }),
          }),
        }),
      };

      // Count query for getting updated comments count - needs select().eq() chain
      const countQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 1,
          }),
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_tracks') {
          return trackQuery;
        }
        if (table === 'track_comments') {
          callCount++;
          if (callCount === 1) {
            return insertQuery;
          }
          // Count query (second call)
          return countQuery;
        }
        return {};
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.comment.content).toBe('Great track!');
      expect(data.comment.user.displayName).toBe('Test User');
      expect(data.message).toBe('Comment added successfully');
    });

    it('should return 404 if parent comment does not exist', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { content: 'Reply', parentId: 'non-existent-parent' },
        token: 'valid-token',
      });
      const { params } = createMockParams('test-track');

      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null,
      });

      // Track query
      const trackQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-track',
                  user_id: 'owner-id',
                  is_public: true,
                  status: 'shared',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Parent comment query - not found
      const parentQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_tracks') {
          return trackQuery;
        }
        if (table === 'track_comments') {
          return parentQuery;
        }
        return {};
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Parent comment not found');
    });
  });
});
