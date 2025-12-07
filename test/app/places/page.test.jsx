/**
 * Place Detail Page Tests
 * Tests for the place detail page functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlaceDetailPage from '@/app/places/[dataCid]/page';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  default: () => mockUseAuth(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock place data
const mockPlaceData = {
  place: {
    id: 'place-uuid-1',
    data_cid: '11240000532159598531',
    title: "Coppolillo's Italian Steakhouse",
    category: 'dining',
    address: 'Crown Point, IN',
    phone: '(219) 555-1234',
    website: 'https://example.com',
    latitude: 41.4169,
    longitude: -87.3653,
    rating: 4.6,
    reviews_count: 409,
    price_level: '$$',
    hours: { monday: '11am-9pm', tuesday: '11am-9pm' },
    thumbnail: 'https://example.com/image.jpg',
    description: 'A great Italian restaurant with steaks.',
    likes_count: 5,
    comments_count: 3,
    avg_user_rating: 4.5,
  },
  parks: [
    {
      id: 'park-uuid-1',
      park_code: 'indu',
      name: 'Indiana Dunes National Park',
      designation: 'National Park',
      distance_miles: 15.5,
    },
  ],
};

const mockCommentsData = {
  comments: [
    {
      id: 'comment-uuid-1',
      content: 'Great food and atmosphere!',
      rating: 5,
      created_at: '2025-12-07T20:00:00.000Z',
      updated_at: '2025-12-07T20:00:00.000Z',
      user_id: 'user-uuid-1',
    },
    {
      id: 'comment-uuid-2',
      content: 'Nice place, a bit pricey.',
      rating: 4,
      created_at: '2025-12-07T19:00:00.000Z',
      updated_at: '2025-12-07T19:00:00.000Z',
      user_id: 'user-uuid-2',
    },
  ],
  total: 2,
};

const mockLikesData = {
  likes_count: 5,
  user_has_liked: false,
};

// Helper to setup standard fetch mocks
const setupFetchMocks = () => {
  global.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlaceData,
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockCommentsData,
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockLikesData,
    });
};

describe('PlaceDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    mockUseParams.mockReturnValue({ dataCid: '11240000532159598531' });
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching', async () => {
      global.fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockPlaceData,
                }),
              100
            )
          )
      );

      render(<PlaceDetailPage />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message for non-existent place', async () => {
      mockUseParams.mockReturnValue({ dataCid: 'nonexistent' });
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      render(<PlaceDetailPage />);

      await waitFor(() => {
        // "Place not found" appears in both h1 and p elements
        const elements = screen.getAllByText(/place not found/i);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('should show error message on fetch failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<PlaceDetailPage />);

      await waitFor(() => {
        // "Error" appears in both h1 and p elements
        const elements = screen.getAllByText(/error/i);
        expect(elements.length).toBeGreaterThan(0);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Place Details Display', () => {
    it('should display place title', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Coppolillo's Italian Steakhouse")).toBeInTheDocument();
      });
    });

    it('should display category badge', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        // Category badge shows icon + label, e.g., "🍽️ Dining"
        expect(screen.getByText(/🍽️ Dining/)).toBeInTheDocument();
      });
    });

    it('should display rating and reviews count', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('4.6')).toBeInTheDocument();
        expect(screen.getByText('(409 reviews)')).toBeInTheDocument();
      });
    });

    it('should display price level', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('$$')).toBeInTheDocument();
      });
    });

    it('should display address', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/Crown Point, IN/)).toBeInTheDocument();
      });
    });

    it('should display description', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/great Italian restaurant/i)).toBeInTheDocument();
      });
    });

    it('should display operating hours', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Hours')).toBeInTheDocument();
        // Hours appear multiple times (monday and tuesday both have 11am-9pm)
        const hoursElements = screen.getAllByText('11am-9pm');
        expect(hoursElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Action Buttons', () => {
    it('should display website link', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Visit Website')).toBeInTheDocument();
      });
    });

    it('should display phone link', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/\(219\) 555-1234/)).toBeInTheDocument();
      });
    });

    it('should display directions link', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/Get Directions/)).toBeInTheDocument();
      });
    });

    it('should display like button with count', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/5 Likes/)).toBeInTheDocument();
      });
    });
  });

  describe('Nearby Parks Section', () => {
    it('should display nearby parks section', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Nearby Parks')).toBeInTheDocument();
      });
    });

    it('should display park name', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Indiana Dunes National Park')).toBeInTheDocument();
      });
    });

    it('should display distance to park', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/15.5 miles away/)).toBeInTheDocument();
      });
    });

    it('should link to park detail page', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        const parkLink = document.querySelector('a[href="/parks/indu"]');
        expect(parkLink).toBeInTheDocument();
      });
    });
  });

  describe('Comments Section', () => {
    it('should display user reviews section', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/User Reviews/)).toBeInTheDocument();
      });
    });

    it('should display existing comments', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Great food and atmosphere!')).toBeInTheDocument();
        expect(screen.getByText('Nice place, a bit pricey.')).toBeInTheDocument();
      });
    });

    it('should show sign in prompt when not authenticated', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/sign in to leave a review/i)).toBeInTheDocument();
      });
    });

    it('should show comment form when authenticated', async () => {
      setupFetchMocks();
      mockUseAuth.mockReturnValue({
        user: { id: 'user-uuid-1', email: 'test@example.com' },
        loading: false,
      });

      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your experience/i)).toBeInTheDocument();
      });
    });
  });

  describe('Like Functionality', () => {
    it('should toggle like when button clicked', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-uuid-1', email: 'test@example.com' },
        loading: false,
      });
      setupFetchMocks();
      // Mock the like POST response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          likes_count: 6,
          user_has_liked: true,
        }),
      });

      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/5 Likes/)).toBeInTheDocument();
      });

      const likeButton = screen.getByRole('button', { name: /likes/i });
      fireEvent.click(likeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/places/11240000532159598531/likes',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('Comment Submission', () => {
    it('should submit comment when form submitted', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-uuid-1', email: 'test@example.com' },
        loading: false,
      });
      setupFetchMocks();
      // Mock the comment POST response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment-uuid',
            content: 'Test comment',
            rating: 5,
            user_id: 'user-uuid-1',
          },
        }),
      });

      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your experience/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/share your experience/i);
      fireEvent.change(textarea, { target: { value: 'Test comment' } });

      const submitButton = screen.getByRole('button', { name: /post review/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/places/11240000532159598531/comments',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test comment'),
          })
        );
      });
    });
  });

  describe('API Calls', () => {
    it('should fetch place details on mount', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/places/11240000532159598531');
      });
    });

    it('should fetch comments on mount', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/places/11240000532159598531/comments');
      });
    });

    it('should fetch likes status on mount', async () => {
      setupFetchMocks();
      render(<PlaceDetailPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/places/11240000532159598531/likes');
      });
    });
  });
});