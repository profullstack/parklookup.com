/**
 * Tests for Tracking Client Library
 *
 * @module test/lib/tracking/tracking-client.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTrack,
  getTracks,
  getTrack,
  updateTrack,
  deleteTrack,
  addTrackPoints,
  getTrackPoints,
  clearTrackPoints,
  shareTrack,
  unshareTrack,
  likeTrack,
  unlikeTrack,
  toggleTrackLike,
  getTrackComments,
  addTrackComment,
  updateTrackComment,
  deleteTrackComment,
  finalizeTrack,
  getTrackMedia,
  uploadTrackMedia,
  linkMediaToTrack,
  removeTrackMedia,
  updateTrackMedia,
  reorderTrackMedia,
} from '../../../lib/tracking/tracking-client.js';

describe('Tracking Client Library', () => {
  const mockAccessToken = 'test-access-token';
  const mockTrackId = '550e8400-e29b-41d4-a716-446655440000';
  const mockCommentId = '660e8400-e29b-41d4-a716-446655440001';
  const mockMediaId = '770e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('createTrack', () => {
    it('should create a track with valid data', async () => {
      const mockTrack = {
        id: mockTrackId,
        title: 'Morning Hike',
        activity_type: 'hiking',
        status: 'recording',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ track: mockTrack, message: 'Track created' }),
      });

      const result = await createTrack(mockAccessToken, {
        title: 'Morning Hike',
        activityType: 'hiking',
        parkCode: 'yose',
      });

      expect(result.track).toEqual(mockTrack);
      expect(result.message).toBe('Track created');
      expect(global.fetch).toHaveBeenCalledWith('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockAccessToken}`,
        },
        body: expect.any(String),
      });
    });

    it('should handle creation error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Pro subscription required' }),
      });

      const result = await createTrack(mockAccessToken, { title: 'Test' });

      expect(result.error).toBeDefined();
      expect(result.status).toBe(403);
    });

    it('should handle network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await createTrack(mockAccessToken, { title: 'Test' });

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Failed to create track');
    });
  });

  describe('getTracks', () => {
    it('should fetch user tracks', async () => {
      const mockTracks = [
        { id: '1', title: 'Track 1' },
        { id: '2', title: 'Track 2' },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tracks: mockTracks,
            pagination: { total: 2, limit: 20, offset: 0 },
          }),
      });

      const result = await getTracks(mockAccessToken);

      expect(result.tracks).toEqual(mockTracks);
      expect(result.pagination).toBeDefined();
    });

    it('should pass query parameters', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tracks: [], pagination: {} }),
      });

      await getTracks(mockAccessToken, {
        limit: 10,
        offset: 20,
        status: 'completed',
        activityType: 'hiking',
        sortBy: 'created_at',
        sortOrder: 'desc',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=completed'),
        expect.any(Object)
      );
    });

    it('should handle fetch error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const result = await getTracks(mockAccessToken);

      expect(result.error).toBeDefined();
    });
  });

  describe('getTrack', () => {
    it('should fetch a single track', async () => {
      const mockTrack = { id: mockTrackId, title: 'Test Track' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ track: mockTrack }),
      });

      const result = await getTrack(mockAccessToken, mockTrackId);

      expect(result.track).toEqual(mockTrack);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}`,
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockAccessToken}` },
        })
      );
    });

    it('should work without access token for public tracks', async () => {
      const mockTrack = { id: mockTrackId, title: 'Public Track', is_public: true };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ track: mockTrack }),
      });

      const result = await getTrack(null, mockTrackId);

      expect(result.track).toEqual(mockTrack);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}`,
        expect.objectContaining({ headers: {} })
      );
    });

    it('should handle not found error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Track not found' }),
      });

      const result = await getTrack(mockAccessToken, 'nonexistent');

      expect(result.error).toBeDefined();
      expect(result.status).toBe(404);
    });
  });

  describe('updateTrack', () => {
    it('should update track fields', async () => {
      const updatedTrack = { id: mockTrackId, title: 'Updated Title' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ track: updatedTrack, message: 'Track updated' }),
      });

      const result = await updateTrack(mockAccessToken, mockTrackId, {
        title: 'Updated Title',
      });

      expect(result.track).toEqual(updatedTrack);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: 'Updated Title' }),
        })
      );
    });

    it('should handle update error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Access denied' }),
      });

      const result = await updateTrack(mockAccessToken, mockTrackId, { title: 'New' });

      expect(result.error).toBeDefined();
    });
  });

  describe('deleteTrack', () => {
    it('should delete a track', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Track deleted' }),
      });

      const result = await deleteTrack(mockAccessToken, mockTrackId);

      expect(result.message).toBe('Track deleted');
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('addTrackPoints', () => {
    it('should add GPS points to a track', async () => {
      const points = [
        { latitude: 37.7749, longitude: -122.4194, recordedAt: new Date().toISOString() },
        { latitude: 37.7750, longitude: -122.4195, recordedAt: new Date().toISOString() },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            inserted: 2,
            points: points,
            message: 'Points added',
          }),
      });

      const result = await addTrackPoints(mockAccessToken, mockTrackId, points);

      expect(result.inserted).toBe(2);
      expect(result.points).toHaveLength(2);
    });

    it('should handle validation errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            inserted: 1,
            validationErrors: [{ index: 1, error: 'Invalid latitude' }],
          }),
      });

      const result = await addTrackPoints(mockAccessToken, mockTrackId, [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 'invalid', longitude: -122.4195 },
      ]);

      expect(result.inserted).toBe(1);
      expect(result.validationErrors).toHaveLength(1);
    });
  });

  describe('getTrackPoints', () => {
    it('should fetch track points', async () => {
      const mockPoints = [
        { id: '1', latitude: 37.7749, longitude: -122.4194 },
        { id: '2', latitude: 37.7750, longitude: -122.4195 },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            points: mockPoints,
            pagination: { total: 2 },
          }),
      });

      const result = await getTrackPoints(mockAccessToken, mockTrackId);

      expect(result.points).toEqual(mockPoints);
    });

    it('should support simplified mode', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ points: [], pagination: {} }),
      });

      await getTrackPoints(mockAccessToken, mockTrackId, { simplified: true });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('simplified=true'),
        expect.any(Object)
      );
    });
  });

  describe('clearTrackPoints', () => {
    it('should clear all points from a track', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: 50, message: 'Points cleared' }),
      });

      const result = await clearTrackPoints(mockAccessToken, mockTrackId);

      expect(result.deleted).toBe(50);
    });
  });

  describe('shareTrack', () => {
    it('should share a track to the feed', async () => {
      const sharedTrack = { id: mockTrackId, is_public: true, status: 'shared' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ track: sharedTrack, message: 'Track shared' }),
      });

      const result = await shareTrack(mockAccessToken, mockTrackId, {
        title: 'My Hike',
        description: 'Great views!',
      });

      expect(result.track.is_public).toBe(true);
      expect(result.track.status).toBe('shared');
    });
  });

  describe('unshareTrack', () => {
    it('should make a track private', async () => {
      const privateTrack = { id: mockTrackId, is_public: false, status: 'completed' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ track: privateTrack, message: 'Track unshared' }),
      });

      const result = await unshareTrack(mockAccessToken, mockTrackId);

      expect(result.track.is_public).toBe(false);
    });
  });

  describe('likeTrack', () => {
    it('should like a track', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            like: { id: '1', track_id: mockTrackId },
            likesCount: 5,
            message: 'Track liked',
          }),
      });

      const result = await likeTrack(mockAccessToken, mockTrackId);

      expect(result.like).toBeDefined();
      expect(result.likesCount).toBe(5);
    });
  });

  describe('unlikeTrack', () => {
    it('should unlike a track', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ likesCount: 4, message: 'Track unliked' }),
      });

      const result = await unlikeTrack(mockAccessToken, mockTrackId);

      expect(result.likesCount).toBe(4);
    });
  });

  describe('toggleTrackLike', () => {
    it('should unlike when currently liked', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ likesCount: 4 }),
      });

      const result = await toggleTrackLike(mockAccessToken, mockTrackId, true);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}/likes`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should like when not currently liked', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ like: {}, likesCount: 5 }),
      });

      const result = await toggleTrackLike(mockAccessToken, mockTrackId, false);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}/likes`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getTrackComments', () => {
    it('should fetch track comments', async () => {
      const mockComments = [
        { id: '1', content: 'Great track!' },
        { id: '2', content: 'Nice views!' },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            comments: mockComments,
            commentsCount: 2,
            pagination: { total: 2 },
          }),
      });

      const result = await getTrackComments(mockAccessToken, mockTrackId);

      expect(result.comments).toEqual(mockComments);
      expect(result.commentsCount).toBe(2);
    });
  });

  describe('addTrackComment', () => {
    it('should add a comment to a track', async () => {
      const newComment = { id: mockCommentId, content: 'Nice hike!' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            comment: newComment,
            commentsCount: 3,
            message: 'Comment added',
          }),
      });

      const result = await addTrackComment(mockAccessToken, mockTrackId, 'Nice hike!');

      expect(result.comment).toEqual(newComment);
      expect(result.commentsCount).toBe(3);
    });

    it('should support reply to comment', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ comment: {}, commentsCount: 4 }),
      });

      await addTrackComment(mockAccessToken, mockTrackId, 'Reply', 'parent-id');

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tracks/${mockTrackId}/comments`,
        expect.objectContaining({
          body: JSON.stringify({ content: 'Reply', parentId: 'parent-id' }),
        })
      );
    });
  });

  describe('updateTrackComment', () => {
    it('should update a comment', async () => {
      const updatedComment = { id: mockCommentId, content: 'Updated comment' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ comment: updatedComment, message: 'Comment updated' }),
      });

      const result = await updateTrackComment(
        mockAccessToken,
        mockTrackId,
        mockCommentId,
        'Updated comment'
      );

      expect(result.comment.content).toBe('Updated comment');
    });
  });

  describe('deleteTrackComment', () => {
    it('should delete a comment', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ commentsCount: 2, message: 'Comment deleted' }),
      });

      const result = await deleteTrackComment(mockAccessToken, mockTrackId, mockCommentId);

      expect(result.commentsCount).toBe(2);
    });
  });

  describe('finalizeTrack', () => {
    it('should finalize a track', async () => {
      const finalizedTrack = { id: mockTrackId, status: 'completed' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ track: finalizedTrack, message: 'Track updated' }),
      });

      const result = await finalizeTrack(mockAccessToken, mockTrackId);

      expect(result.track.status).toBe('completed');
    });
  });

  describe('Track Media Functions', () => {
    describe('getTrackMedia', () => {
      it('should fetch track media', async () => {
        const mockMedia = [
          { id: '1', media_type: 'photo', url: 'https://example.com/photo1.jpg' },
          { id: '2', media_type: 'video', url: 'https://example.com/video1.mp4' },
        ];

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ media: mockMedia }),
        });

        const result = await getTrackMedia(mockAccessToken, mockTrackId);

        expect(result.media).toEqual(mockMedia);
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/tracks/${mockTrackId}/media`,
          expect.objectContaining({
            headers: { Authorization: `Bearer ${mockAccessToken}` },
          })
        );
      });

      it('should work without access token for public tracks', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ media: [] }),
        });

        await getTrackMedia(null, mockTrackId);

        expect(global.fetch).toHaveBeenCalledWith(
          `/api/tracks/${mockTrackId}/media`,
          expect.objectContaining({ headers: {} })
        );
      });
    });

    describe('uploadTrackMedia', () => {
      it('should upload media to a track', async () => {
        const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
        const mockTrackMedia = {
          id: '1',
          media_id: mockMediaId,
          url: 'https://example.com/photo.jpg',
        };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ trackMedia: mockTrackMedia }),
        });

        const result = await uploadTrackMedia(mockAccessToken, mockTrackId, {
          file: mockFile,
          title: 'Summit View',
          latitude: 37.7749,
          longitude: -122.4194,
        });

        expect(result.trackMedia).toEqual(mockTrackMedia);
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/tracks/${mockTrackId}/media`,
          expect.objectContaining({
            method: 'POST',
            headers: { Authorization: `Bearer ${mockAccessToken}` },
          })
        );
      });

      it('should handle upload error', async () => {
        const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'File too large' }),
        });

        const result = await uploadTrackMedia(mockAccessToken, mockTrackId, {
          file: mockFile,
        });

        expect(result.error).toBeDefined();
      });
    });

    describe('linkMediaToTrack', () => {
      it('should link existing media to a track', async () => {
        const mockTrackMedia = { id: '1', media_id: mockMediaId };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ trackMedia: mockTrackMedia }),
        });

        const result = await linkMediaToTrack(mockAccessToken, mockTrackId, {
          mediaId: mockMediaId,
          latitude: 37.7749,
          longitude: -122.4194,
        });

        expect(result.trackMedia).toEqual(mockTrackMedia);
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/tracks/${mockTrackId}/media`,
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockAccessToken}`,
            },
          })
        );
      });

      it('should handle already linked error', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: 'Media already linked' }),
        });

        const result = await linkMediaToTrack(mockAccessToken, mockTrackId, {
          mediaId: mockMediaId,
        });

        expect(result.error).toBeDefined();
        expect(result.status).toBe(409);
      });
    });

    describe('removeTrackMedia', () => {
      it('should remove media from a track', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await removeTrackMedia(mockAccessToken, mockTrackId, mockMediaId);

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/tracks/${mockTrackId}/media?mediaId=${mockMediaId}`,
          expect.objectContaining({ method: 'DELETE' })
        );
      });
    });

    describe('updateTrackMedia', () => {
      it('should update track media link', async () => {
        const updatedTrackMedia = { id: '1', display_order: 5 };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ trackMedia: updatedTrackMedia }),
        });

        const result = await updateTrackMedia(mockAccessToken, mockTrackId, {
          mediaId: mockMediaId,
          displayOrder: 5,
        });

        expect(result.trackMedia.display_order).toBe(5);
      });
    });

    describe('reorderTrackMedia', () => {
      it('should reorder multiple media items', async () => {
        global.fetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ trackMedia: { display_order: 0 } }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ trackMedia: { display_order: 1 } }),
          });

        const result = await reorderTrackMedia(mockAccessToken, mockTrackId, [
          { mediaId: 'media-1', displayOrder: 0 },
          { mediaId: 'media-2', displayOrder: 1 },
        ]);

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should report partial errors', async () => {
        global.fetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ trackMedia: {} }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Not found' }),
          });

        const result = await reorderTrackMedia(mockAccessToken, mockTrackId, [
          { mediaId: 'media-1', displayOrder: 0 },
          { mediaId: 'media-2', displayOrder: 1 },
        ]);

        expect(result.error).toBeDefined();
        expect(result.partialErrors).toHaveLength(1);
      });
    });
  });
});
