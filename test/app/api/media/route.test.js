/**
 * Media API Route Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../../../lib/supabase/server.js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            range: vi.fn(),
          })),
        })),
        order: vi.fn(() => ({
          range: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: 'https://example.com/media/test.jpg' },
        })),
      })),
    },
    rpc: vi.fn(),
  })),
}));

vi.mock('../../../../lib/media/media-processor.js', () => ({
  validateMedia: vi.fn(() => ({ valid: true })),
  processImage: vi.fn(() => ({
    buffer: Buffer.from('processed'),
    metadata: { width: 800, height: 600, format: 'jpeg' },
  })),
  processVideo: vi.fn(() => ({
    buffer: Buffer.from('processed'),
    metadata: { width: 1920, height: 1080, duration: 30, format: 'mp4' },
  })),
  generateThumbnail: vi.fn(() => Buffer.from('thumbnail')),
  getMediaType: vi.fn((mime) => (mime.startsWith('image/') ? 'photo' : 'video')),
}));

describe('Media API Routes', () => {
  let mockSupabase;
  let mockRequest;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked createClient
    const { createClient } = await import('../../../../lib/supabase/server.js');
    mockSupabase = createClient();
  });

  describe('GET /api/media', () => {
    it('should return media for a park', async () => {
      const mockMedia = [
        { id: '1', title: 'Photo 1', media_type: 'photo' },
        { id: '2', title: 'Photo 2', media_type: 'photo' },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockMedia,
        error: null,
      });

      // Create mock request
      const url = new URL('http://localhost:3000/api/media?parkCode=yose');
      mockRequest = {
        url: url.toString(),
        headers: new Headers(),
      };

      // Import and call the route handler
      const { GET } = await import('../../../../app/api/media/route.js');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.media).toBeDefined();
    });

    it('should return media for a user', async () => {
      const mockMedia = [{ id: '1', title: 'User Photo' }];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockMedia,
        error: null,
      });

      const url = new URL('http://localhost:3000/api/media?userId=user-123');
      mockRequest = {
        url: url.toString(),
        headers: new Headers(),
      };

      const { GET } = await import('../../../../app/api/media/route.js');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should handle pagination', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const url = new URL(
        'http://localhost:3000/api/media?parkCode=yose&limit=10&offset=20'
      );
      mockRequest = {
        url: url.toString(),
        headers: new Headers(),
      };

      const { GET } = await import('../../../../app/api/media/route.js');
      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
    });

    it('should return 400 when no parkCode or userId provided', async () => {
      const url = new URL('http://localhost:3000/api/media');
      mockRequest = {
        url: url.toString(),
        headers: new Headers(),
      };

      const { GET } = await import('../../../../app/api/media/route.js');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/media', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'image/jpeg' }));
      formData.append('parkCode', 'yose');

      mockRequest = {
        formData: () => Promise.resolve(formData),
        headers: new Headers(),
      };

      const { POST } = await import('../../../../app/api/media/route.js');
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('should require a file', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const formData = new FormData();
      formData.append('parkCode', 'yose');

      mockRequest = {
        formData: () => Promise.resolve(formData),
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { POST } = await import('../../../../app/api/media/route.js');
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('file');
    });

    it('should require parkCode', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['test'], { type: 'image/jpeg' }),
        'test.jpg'
      );

      mockRequest = {
        formData: () => Promise.resolve(formData),
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { POST } = await import('../../../../app/api/media/route.js');
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('parkCode');
    });
  });

  describe('DELETE /api/media', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const url = new URL('http://localhost:3000/api/media?id=media-123');
      mockRequest = {
        url: url.toString(),
        headers: new Headers(),
      };

      const { DELETE } = await import('../../../../app/api/media/route.js');
      const response = await DELETE(mockRequest);

      expect(response.status).toBe(401);
    });

    it('should require media id', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const url = new URL('http://localhost:3000/api/media');
      mockRequest = {
        url: url.toString(),
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { DELETE } = await import('../../../../app/api/media/route.js');
      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('id');
    });

    it('should only allow owner to delete', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock media lookup - different owner
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: { id: 'media-123', user_id: 'other-user' },
              error: null,
            }),
          }),
        }),
      });

      const url = new URL('http://localhost:3000/api/media?id=media-123');
      mockRequest = {
        url: url.toString(),
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { DELETE } = await import('../../../../app/api/media/route.js');
      const response = await DELETE(mockRequest);

      expect(response.status).toBe(403);
    });
  });
});

describe('Media Comments API Routes', () => {
  let mockSupabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('../../../../lib/supabase/server.js');
    mockSupabase = createClient();
  });

  describe('GET /api/media/[mediaId]/comments', () => {
    it('should return comments for media', async () => {
      const mockComments = [
        { id: '1', content: 'Great photo!', user_id: 'user-1' },
        { id: '2', content: 'Nice!', user_id: 'user-2' },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockResolvedValueOnce({
              data: mockComments,
              error: null,
            }),
          }),
        }),
      });

      const mockRequest = {
        url: 'http://localhost:3000/api/media/media-123/comments',
        headers: new Headers(),
      };

      const { GET } = await import(
        '../../../../app/api/media/[mediaId]/comments/route.js'
      );
      const response = await GET(mockRequest, { params: { mediaId: 'media-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toBeDefined();
    });
  });

  describe('POST /api/media/[mediaId]/comments', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const mockRequest = {
        json: () => Promise.resolve({ content: 'Test comment' }),
        headers: new Headers(),
      };

      const { POST } = await import(
        '../../../../app/api/media/[mediaId]/comments/route.js'
      );
      const response = await POST(mockRequest, {
        params: { mediaId: 'media-123' },
      });

      expect(response.status).toBe(401);
    });

    it('should require content', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockRequest = {
        json: () => Promise.resolve({}),
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { POST } = await import(
        '../../../../app/api/media/[mediaId]/comments/route.js'
      );
      const response = await POST(mockRequest, {
        params: { mediaId: 'media-123' },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('content');
    });
  });
});

describe('Media Likes API Routes', () => {
  let mockSupabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('../../../../lib/supabase/server.js');
    mockSupabase = createClient();
  });

  describe('GET /api/media/[mediaId]/likes', () => {
    it('should return like count and user status', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            data: [{ id: '1' }, { id: '2' }],
            error: null,
          }),
        }),
      });

      const mockRequest = {
        url: 'http://localhost:3000/api/media/media-123/likes',
        headers: new Headers(),
      };

      const { GET } = await import(
        '../../../../app/api/media/[mediaId]/likes/route.js'
      );
      const response = await GET(mockRequest, { params: { mediaId: 'media-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.likes_count).toBeDefined();
    });
  });

  describe('POST /api/media/[mediaId]/likes', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const mockRequest = {
        headers: new Headers(),
      };

      const { POST } = await import(
        '../../../../app/api/media/[mediaId]/likes/route.js'
      );
      const response = await POST(mockRequest, {
        params: { mediaId: 'media-123' },
      });

      expect(response.status).toBe(401);
    });
  });
});

describe('User Follow API Routes', () => {
  let mockSupabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('../../../../lib/supabase/server.js');
    mockSupabase = createClient();
  });

  describe('GET /api/users/[userId]/follow', () => {
    it('should return follow status', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'current-user' } },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: { id: 'follow-1' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockRequest = {
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { GET } = await import(
        '../../../../app/api/users/[userId]/follow/route.js'
      );
      const response = await GET(mockRequest, { params: { userId: 'user-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_following).toBeDefined();
    });
  });

  describe('POST /api/users/[userId]/follow', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const mockRequest = {
        headers: new Headers(),
      };

      const { POST } = await import(
        '../../../../app/api/users/[userId]/follow/route.js'
      );
      const response = await POST(mockRequest, { params: { userId: 'user-123' } });

      expect(response.status).toBe(401);
    });

    it('should prevent self-follow', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockRequest = {
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { POST } = await import(
        '../../../../app/api/users/[userId]/follow/route.js'
      );
      const response = await POST(mockRequest, { params: { userId: 'user-123' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('yourself');
    });
  });
});

describe('Feed API Routes', () => {
  let mockSupabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('../../../../lib/supabase/server.js');
    mockSupabase = createClient();
  });

  describe('GET /api/feed', () => {
    it('should return discover feed for unauthenticated users', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ id: '1', title: 'Popular Photo' }],
        error: null,
      });

      const mockRequest = {
        url: 'http://localhost:3000/api/feed',
        headers: new Headers(),
      };

      const { GET } = await import('../../../../app/api/feed/route.js');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.feed_type).toBe('discover');
    });

    it('should return following feed for authenticated users', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ id: '1', title: 'Friend Photo' }],
        error: null,
      });

      const mockRequest = {
        url: 'http://localhost:3000/api/feed?type=following',
        headers: new Headers({ Authorization: 'Bearer token' }),
      };

      const { GET } = await import('../../../../app/api/feed/route.js');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should handle pagination', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockRequest = {
        url: 'http://localhost:3000/api/feed?limit=10&offset=20',
        headers: new Headers(),
      };

      const { GET } = await import('../../../../app/api/feed/route.js');
      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
    });
  });
});