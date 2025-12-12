/**
 * Media Client Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location
const mockLocation = {
  origin: 'http://localhost:3000',
};
global.window = { location: mockLocation };

// Import after mocking
const {
  uploadMedia,
  getParkMedia,
  getUserMedia,
  deleteMedia,
  getMediaComments,
  addMediaComment,
  updateMediaComment,
  deleteMediaComment,
  getMediaLikes,
  likeMedia,
  unlikeMedia,
  toggleMediaLike,
  getFeed,
  getUserProfile,
  followUser,
  unfollowUser,
  toggleFollow,
} = await import('../../../lib/media/media-client.js');

describe('Media Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getParkMedia', () => {
    it('should fetch media for a park', async () => {
      const mockMedia = [{ id: '1', title: 'Test Photo' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ media: mockMedia }),
      });

      const result = await getParkMedia('yose');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/media?parkCode=yose')
      );
      expect(result.media).toEqual(mockMedia);
      expect(result.error).toBeNull();
    });

    it('should handle pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });

      await getParkMedia('yose', { limit: 10, offset: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20')
      );
    });

    it('should handle errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Park not found' }),
      });

      const result = await getParkMedia('invalid');

      expect(result.media).toEqual([]);
      expect(result.error.message).toBe('Park not found');
    });
  });

  describe('getUserMedia', () => {
    it('should fetch media for a user', async () => {
      const mockMedia = [{ id: '1', title: 'User Photo' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ media: mockMedia }),
      });

      const result = await getUserMedia('user-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/media?userId=user-123')
      );
      expect(result.media).toEqual(mockMedia);
    });
  });

  describe('deleteMedia', () => {
    it('should delete media with authorization', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteMedia('token-123', 'media-456');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/media?id=media-456',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer token-123',
          }),
        })
      );
      expect(result.error).toBeNull();
    });
  });

  describe('getMediaComments', () => {
    it('should fetch comments for media', async () => {
      const mockComments = [{ id: '1', content: 'Great photo!' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments }),
      });

      const result = await getMediaComments('media-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/media/media-123/comments')
      );
      expect(result.comments).toEqual(mockComments);
    });
  });

  describe('addMediaComment', () => {
    it('should add a comment with authorization', async () => {
      const mockComment = { id: '1', content: 'Nice!' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ comment: mockComment }),
      });

      const result = await addMediaComment('token-123', 'media-456', {
        content: 'Nice!',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/media/media-456/comments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-123',
          }),
          body: JSON.stringify({ content: 'Nice!', parentId: null }),
        })
      );
      expect(result.comment).toEqual(mockComment);
    });

    it('should support reply to parent comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ comment: {} }),
      });

      await addMediaComment('token', 'media-123', {
        content: 'Reply',
        parentId: 'parent-456',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ content: 'Reply', parentId: 'parent-456' }),
        })
      );
    });
  });

  describe('likeMedia / unlikeMedia', () => {
    it('should like media', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ likes_count: 5, user_has_liked: true }),
      });

      const result = await likeMedia('token-123', 'media-456');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/media/media-456/likes',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.likes_count).toBe(5);
      expect(result.user_has_liked).toBe(true);
    });

    it('should unlike media', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ likes_count: 4, user_has_liked: false }),
      });

      const result = await unlikeMedia('token-123', 'media-456');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/media/media-456/likes',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result.user_has_liked).toBe(false);
    });
  });

  describe('toggleMediaLike', () => {
    it('should unlike when currently liked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ likes_count: 4, user_has_liked: false }),
      });

      const result = await toggleMediaLike('token', 'media-123', true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should like when not currently liked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ likes_count: 5, user_has_liked: true }),
      });

      const result = await toggleMediaLike('token', 'media-123', false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getFeed', () => {
    it('should fetch feed without auth', async () => {
      const mockMedia = [{ id: '1' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ media: mockMedia, feed_type: 'discover' }),
      });

      const result = await getFeed(null, { type: 'discover' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feed'),
        expect.objectContaining({ headers: {} })
      );
      expect(result.feed_type).toBe('discover');
    });

    it('should fetch feed with auth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ media: [], feed_type: 'following' }),
      });

      await getFeed('token-123', { type: 'following' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-123' },
        })
      );
    });
  });

  describe('followUser / unfollowUser', () => {
    it('should follow a user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ is_following: true, followers_count: 10 }),
      });

      const result = await followUser('token-123', 'user-456');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/user-456/follow',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.is_following).toBe(true);
    });

    it('should unfollow a user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ is_following: false, followers_count: 9 }),
      });

      const result = await unfollowUser('token-123', 'user-456');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/user-456/follow',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result.is_following).toBe(false);
    });
  });

  describe('toggleFollow', () => {
    it('should unfollow when currently following', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ is_following: false }),
      });

      await toggleFollow('token', 'user-123', true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should follow when not currently following', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ is_following: true }),
      });

      await toggleFollow('token', 'user-123', false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile', async () => {
      const mockProfile = { id: 'user-123', display_name: 'Test User' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          profile: mockProfile,
          stats: { followers_count: 10 },
          is_following: false,
          is_own_profile: false,
        }),
      });

      const result = await getUserProfile('user-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/user-123',
        expect.any(Object)
      );
      expect(result.profile).toEqual(mockProfile);
    });
  });
});