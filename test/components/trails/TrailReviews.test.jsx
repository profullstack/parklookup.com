/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrailReviews from '../../../components/trails/TrailReviews';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.alert and window.confirm
const alertMock = vi.fn();
const confirmMock = vi.fn();
window.alert = alertMock;
window.confirm = confirmMock;

describe('TrailReviews Component', () => {
  const mockTrailId = 'trail-123';
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockToken = 'mock-auth-token';

  const mockCommentWithProfile = {
    id: 'comment-1',
    trail_id: mockTrailId,
    user_id: 'user-123',
    content: 'Great trail with beautiful views!',
    rating: 5,
    created_at: '2024-01-15T10:00:00Z',
    profile: {
      id: 'user-123',
      display_name: 'John Doe',
      username: 'johndoe',
      avatar_url: 'https://example.com/avatar.jpg',
    },
  };

  const mockCommentWithUsername = {
    id: 'comment-2',
    trail_id: mockTrailId,
    user_id: 'user-456',
    content: 'Nice hike, a bit steep though.',
    rating: 4,
    created_at: '2024-01-14T10:00:00Z',
    profile: {
      id: 'user-456',
      display_name: null,
      username: 'hiker_jane',
      avatar_url: null,
    },
  };

  const mockCommentNoProfile = {
    id: 'comment-3',
    trail_id: mockTrailId,
    user_id: 'user-789',
    content: 'Decent trail.',
    rating: 3,
    created_at: '2024-01-13T10:00:00Z',
    profile: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(mockToken);
    confirmMock.mockReturnValue(true);
    
    // Default: authenticated user
    useAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      accessToken: mockToken,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching data', () => {
      global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves

      render(<TrailReviews trailId={mockTrailId} />);

      // Should show loading skeleton (animate-pulse divs)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: null,
        loading: false,
        accessToken: null,
      });
    });

    it('should show sign in prompt instead of comment form', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Sign in to leave a review')).toBeInTheDocument();
      });

      expect(screen.getByText('Sign In →')).toBeInTheDocument();
    });

    it('should still display existing comments', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 5, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Great trail with beautiful views!')).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated User', () => {
    it('should show comment form when authenticated', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Your Review')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText('Share your experience on this trail...')).toBeInTheDocument();
      expect(screen.getByText('Post Review')).toBeInTheDocument();
    });
  });

  describe('User Profile Display', () => {
    it('should display user display_name when available', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should display username when display_name is not available', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithUsername] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('hiker_jane')).toBeInTheDocument();
      });
    });

    it('should display "Hiker" as fallback when no profile exists', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentNoProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Hiker')).toBeInTheDocument();
      });
    });

    it('should display avatar image when avatar_url is available', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        const avatar = screen.getByAltText('John Doe');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      });
    });

    it('should display initials when no avatar_url is available', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithUsername] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        // Should show initials "HI" from "hiker_jane"
        expect(screen.getByText('HI')).toBeInTheDocument();
      });
    });

    it('should display "U" as initials fallback when no profile', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentNoProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        // Should show "U" as fallback
        expect(screen.getByText('U')).toBeInTheDocument();
      });
    });
  });

  describe('Likes Functionality', () => {
    it('should display likes count', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 42, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/42 Likes/)).toBeInTheDocument();
      });
    });

    it('should show singular "Like" for count of 1', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 1, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/1 Like$/)).toBeInTheDocument();
      });
    });

    it('should show filled heart when user has liked', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 5, user_has_liked: true }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/❤️/)).toBeInTheDocument();
      });
    });

    it('should show empty heart when user has not liked', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 5, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/🤍/)).toBeInTheDocument();
      });
    });

    it('should toggle like when clicking like button', async () => {
      let likeState = { likes_count: 5, user_has_liked: false };
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          if (options?.method === 'POST') {
            likeState = { likes_count: 6, user_has_liked: true };
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(likeState),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/🤍/)).toBeInTheDocument();
      });

      const likeButton = screen.getByRole('button', { name: /Likes?/ });
      fireEvent.click(likeButton);

      await waitFor(() => {
        expect(screen.getByText(/❤️/)).toBeInTheDocument();
        expect(screen.getByText(/6 Likes/)).toBeInTheDocument();
      });
    });
  });

  describe('Comments Display', () => {
    it('should display comment content', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Great trail with beautiful views!')).toBeInTheDocument();
      });
    });

    it('should display star rating', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        // Should have 5 yellow stars for rating of 5
        const stars = document.querySelectorAll('.text-yellow-500');
        expect(stars.length).toBe(5);
      });
    });

    it('should display comment date', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        // Date should be formatted
        expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
      });
    });

    it('should display reviews count', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
              comments: [mockCommentWithProfile, mockCommentWithUsername] 
            }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('2 Reviews')).toBeInTheDocument();
      });
    });

    it('should show singular "Review" for count of 1', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('1 Review')).toBeInTheDocument();
      });
    });

    it('should show empty state when no comments', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('No reviews yet. Be the first to share your experience!')).toBeInTheDocument();
      });
    });
  });

  describe('Comment Submission', () => {
    it('should submit a new comment', async () => {
      const user = userEvent.setup();
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        if (url.includes('/comments') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              comment: {
                id: 'new-comment',
                trail_id: mockTrailId,
                user_id: 'user-123',
                content: 'Amazing trail!',
                rating: 4,
                created_at: new Date().toISOString(),
                profile: {
                  id: 'user-123',
                  display_name: 'Test User',
                  username: 'testuser',
                  avatar_url: null,
                },
              },
            }),
          });
        }
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Share your experience on this trail...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Share your experience on this trail...');
      await user.type(textarea, 'Amazing trail!');

      // Click 4th star for rating
      const stars = screen.getAllByText('★');
      await user.click(stars[3]); // 4th star (0-indexed)

      const submitButton = screen.getByText('Post Review');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Amazing trail!')).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });
    });

    it('should disable submit button when content is empty', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Post Review');
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Comment Owner Actions', () => {
    it('should show edit and delete buttons for own comments', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('should not show edit and delete buttons for other users comments', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithUsername] }), // Different user
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Nice hike, a bit steep though.')).toBeInTheDocument();
      });

      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('should delete comment when delete is clicked and confirmed', async () => {
      const user = userEvent.setup();
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        if (url.includes('/comments') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(confirmMock).toHaveBeenCalledWith('Are you sure you want to delete this review?');
      });

      await waitFor(() => {
        expect(screen.queryByText('Great trail with beautiful views!')).not.toBeInTheDocument();
      });
    });

    it('should show edit form when edit is clicked', async () => {
      const user = userEvent.setup();
      
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [mockCommentWithProfile] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Edit'));

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('Star Rating Selection', () => {
    it('should toggle star rating on click', async () => {
      const user = userEvent.setup();
      
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText('Rating (optional):')).toBeInTheDocument();
      });

      // Get the rating stars (in the form, not in comments)
      const ratingStars = screen.getAllByRole('button').filter(btn => btn.textContent === '★');
      
      // Click 3rd star
      await user.click(ratingStars[2]);

      // First 3 stars should be yellow
      await waitFor(() => {
        const yellowStars = document.querySelectorAll('.text-yellow-500');
        expect(yellowStars.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('API Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should show alert on comment submission error', async () => {
      const user = userEvent.setup();
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        if (url.includes('/comments') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to post comment' }),
          });
        }
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Share your experience on this trail...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Share your experience on this trail...');
      await user.type(textarea, 'Test comment');

      const submitButton = screen.getByText('Post Review');
      await user.click(submitButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Failed to post comment');
      });
    });
  });

  describe('Multiple Comments Display', () => {
    it('should display multiple comments with different profile types', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              comments: [
                mockCommentWithProfile,
                mockCommentWithUsername,
                mockCommentNoProfile,
              ]
            }),
          });
        }
        if (url.includes('/likes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ likes_count: 0, user_has_liked: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TrailReviews trailId={mockTrailId} />);

      await waitFor(() => {
        // Comment with display_name
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Great trail with beautiful views!')).toBeInTheDocument();
        
        // Comment with username only
        expect(screen.getByText('hiker_jane')).toBeInTheDocument();
        expect(screen.getByText('Nice hike, a bit steep though.')).toBeInTheDocument();
        
        // Comment with no profile (fallback)
        expect(screen.getByText('Hiker')).toBeInTheDocument();
        expect(screen.getByText('Decent trail.')).toBeInTheDocument();
      });

      // Should show 3 Reviews
      expect(screen.getByText('3 Reviews')).toBeInTheDocument();
    });
  });
});