/**
 * Tests for ParkReviews Component
 * Tests the reviews/comments display and interaction functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ParkReviews from '@/components/parks/ParkReviews';

// Mock the useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';

describe('ParkReviews Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    global.alert = vi.fn();
    global.confirm = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      useAuth.mockReturnValue({ user: null, loading: true });
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ParkReviews parkCode="yose" />);

      // Should show loading skeleton
      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: null, loading: false });
    });

    it('should show sign in prompt instead of comment form', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/Sign in to leave a review/i)).toBeTruthy();
      });
    });

    it('should display existing comments', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          user_id: 'user-1',
          content: 'Great park!',
          rating: 5,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 3, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('Great park!')).toBeTruthy();
      });
    });

    it('should show likes count', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 10, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/10 Likes/i)).toBeTruthy();
      });
    });

    it('should show alert when trying to like without auth', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/0 Likes/i)).toBeTruthy();
      });

      const likeButton = screen.getByRole('button', { name: /Likes/i });
      fireEvent.click(likeButton);

      expect(global.alert).toHaveBeenCalledWith('Please sign in to like parks');
    });
  });

  describe('Authenticated User', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });

    it('should show comment form', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share your experience/i)).toBeTruthy();
      });
    });

    it('should submit a new comment', async () => {
      const newComment = {
        id: 'new-comment',
        user_id: 'user-123',
        content: 'Amazing experience!',
        rating: 5,
        created_at: '2024-01-01T00:00:00Z',
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comment: newComment }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share your experience/i)).toBeTruthy();
      });

      const textarea = screen.getByPlaceholderText(/Share your experience/i);
      fireEvent.change(textarea, { target: { value: 'Amazing experience!' } });

      const submitButton = screen.getByRole('button', { name: /Post Review/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/parks/yose/comments',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          })
        );
      });
    });

    it('should toggle like status', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 5, user_has_liked: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 6, user_has_liked: true }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/5 Likes/i)).toBeTruthy();
      });

      const likeButton = screen.getByRole('button', { name: /Likes/i });
      fireEvent.click(likeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/parks/yose/likes',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should show edit and delete buttons for own comments', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          user_id: 'user-123', // Same as mockUser.id
          content: 'My comment',
          rating: 4,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeTruthy();
        expect(screen.getByText('Edit')).toBeTruthy();
        expect(screen.getByText('Delete')).toBeTruthy();
      });
    });

    it('should not show edit and delete buttons for other users comments', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          user_id: 'other-user', // Different from mockUser.id
          content: 'Other user comment',
          rating: 3,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('Other user comment')).toBeTruthy();
      });

      expect(screen.queryByText('Edit')).toBeNull();
      expect(screen.queryByText('Delete')).toBeNull();
    });

    it('should delete a comment after confirmation', async () => {
      global.confirm.mockReturnValue(true);

      const mockComments = [
        {
          id: 'comment-1',
          user_id: 'user-123',
          content: 'My comment to delete',
          rating: 4,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('My comment to delete')).toBeTruthy();
      });

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/parks/yose/comments/comment-1',
          expect.objectContaining({ method: 'DELETE' })
        );
      });
    });

    it('should not delete comment if confirmation is cancelled', async () => {
      global.confirm.mockReturnValue(false);

      const mockComments = [
        {
          id: 'comment-1',
          user_id: 'user-123',
          content: 'My comment',
          rating: 4,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeTruthy();
      });

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      expect(global.confirm).toHaveBeenCalled();
      // Should not have made a DELETE request
      expect(global.fetch).toHaveBeenCalledTimes(2); // Only initial fetches
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no comments exist', async () => {
      useAuth.mockReturnValue({ user: null, loading: false });

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/No reviews yet/i)).toBeTruthy();
      });
    });
  });

  describe('Rating Display', () => {
    it('should display star ratings for comments', async () => {
      useAuth.mockReturnValue({ user: null, loading: false });

      const mockComments = [
        {
          id: 'comment-1',
          user_id: 'user-1',
          content: 'Five star experience!',
          rating: 5,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('Five star experience!')).toBeTruthy();
        // Check for star characters
        const stars = screen.getAllByText('★');
        expect(stars.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Reviews Count', () => {
    it('should display correct reviews count', async () => {
      useAuth.mockReturnValue({ user: null, loading: false });

      const mockComments = [
        { id: '1', user_id: 'u1', content: 'Comment 1', rating: 5, created_at: '2024-01-01' },
        { id: '2', user_id: 'u2', content: 'Comment 2', rating: 4, created_at: '2024-01-02' },
        { id: '3', user_id: 'u3', content: 'Comment 3', rating: 3, created_at: '2024-01-03' },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/3 Reviews/i)).toBeTruthy();
      });
    });

    it('should use singular form for 1 review', async () => {
      useAuth.mockReturnValue({ user: null, loading: false });

      const mockComments = [
        { id: '1', user_id: 'u1', content: 'Only comment', rating: 5, created_at: '2024-01-01' },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ likes_count: 1, user_has_liked: false }),
        });

      render(<ParkReviews parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/1 Review/i)).toBeTruthy();
        expect(screen.getByText(/1 Like/i)).toBeTruthy();
      });
    });
  });
});