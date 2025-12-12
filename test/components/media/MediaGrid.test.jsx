/**
 * MediaGrid Component Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  default: () => mockUseAuth(),
}));

// Mock media-client
const mockGetParkMedia = vi.fn();
const mockToggleMediaLike = vi.fn();
vi.mock('@/lib/media/media-client', () => ({
  getParkMedia: (...args) => mockGetParkMedia(...args),
  toggleMediaLike: (...args) => mockToggleMediaLike(...args),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

import MediaGrid, { MediaCard } from '@/components/media/MediaGrid';

describe('MediaGrid Component', () => {
  const mockMedia = [
    {
      id: 'media-1',
      user_id: 'user-1',
      park_code: 'yose',
      media_type: 'image',
      title: 'Yosemite Falls',
      description: 'Beautiful waterfall',
      url: 'https://example.com/image1.jpg',
      thumbnail_url: 'https://example.com/thumb1.jpg',
      likes_count: 5,
      comments_count: 3,
      created_at: '2024-01-15T10:00:00Z',
      profiles: {
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar1.jpg',
      },
      user_has_liked: false,
    },
    {
      id: 'media-2',
      user_id: 'user-2',
      park_code: 'yose',
      media_type: 'video',
      title: 'Grand Canyon Sunset',
      description: 'Amazing sunset view',
      url: 'https://example.com/video1.mp4',
      thumbnail_url: 'https://example.com/thumb2.jpg',
      likes_count: 10,
      comments_count: 7,
      created_at: '2024-01-14T15:00:00Z',
      profiles: {
        display_name: 'Jane Smith',
        avatar_url: 'https://example.com/avatar2.jpg',
      },
      user_has_liked: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetParkMedia.mockResolvedValue({ media: mockMedia, error: null });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        loading: false,
      });
    });

    it('should show loading skeleton when fetching media', () => {
      mockGetParkMedia.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<MediaGrid parkCode="yose" />);

      // Should show skeleton loaders (animate-pulse divs)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Rendering with Initial Media', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        loading: false,
      });
    });

    it('should render media items from initialMedia prop', () => {
      render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />);

      expect(screen.getByText('Yosemite Falls')).toBeInTheDocument();
      expect(screen.getByText('Grand Canyon Sunset')).toBeInTheDocument();
    });

    it('should display user names', () => {
      render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should display likes and comments count', () => {
      render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />);

      expect(screen.getByText('5')).toBeInTheDocument(); // likes for media-1
      expect(screen.getByText('3')).toBeInTheDocument(); // comments for media-1
      expect(screen.getByText('10')).toBeInTheDocument(); // likes for media-2
      expect(screen.getByText('7')).toBeInTheDocument(); // comments for media-2
    });

    it('should link to media detail page', () => {
      render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />);

      const links = screen.getAllByRole('link');
      const mediaLinks = links.filter((link) => link.getAttribute('href')?.includes('/media/'));

      expect(mediaLinks.length).toBeGreaterThan(0);
      expect(mediaLinks[0]).toHaveAttribute('href', '/media/media-1');
    });

    it('should link to user profile', () => {
      render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />);

      const userLinks = screen.getAllByRole('link').filter((link) =>
        link.getAttribute('href')?.includes('/users/')
      );

      expect(userLinks.length).toBeGreaterThan(0);
      expect(userLinks[0]).toHaveAttribute('href', '/users/user-1');
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        loading: false,
      });
      mockGetParkMedia.mockResolvedValue({ media: [], error: null });
    });

    it('should show empty state when no media', async () => {
      render(<MediaGrid parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/no photos yet/i)).toBeInTheDocument();
      });
    });

    it('should show prompt to share photos', async () => {
      render(<MediaGrid parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/be the first to share/i)).toBeInTheDocument();
      });
    });

    it('should show sign in link when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
      });

      render(<MediaGrid parkCode="yose" showUploadPrompt />);

      await waitFor(() => {
        expect(screen.getByText(/sign in to share photos/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        loading: false,
      });
    });

    it('should show error message when fetch fails', async () => {
      mockGetParkMedia.mockResolvedValue({
        media: null,
        error: { message: 'Failed to load media' },
      });

      render(<MediaGrid parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load media/i)).toBeInTheDocument();
      });
    });

    it('should show try again button on error', async () => {
      mockGetParkMedia.mockResolvedValue({
        media: null,
        error: { message: 'Failed to load media' },
      });

      render(<MediaGrid parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should retry fetch when try again is clicked', async () => {
      mockGetParkMedia
        .mockResolvedValueOnce({ media: null, error: { message: 'Failed' } })
        .mockResolvedValueOnce({ media: mockMedia, error: null });

      render(<MediaGrid parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(mockGetParkMedia).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Load More', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        loading: false,
      });
    });

    it('should show load more button when hasMore is true', async () => {
      // Return exactly 12 items (the limit) to indicate more might be available
      const manyMedia = Array(12)
        .fill(null)
        .map((_, i) => ({
          ...mockMedia[0],
          id: `media-${i}`,
          title: `Photo ${i}`,
        }));

      mockGetParkMedia.mockResolvedValue({ media: manyMedia, error: null });

      render(<MediaGrid parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
      });
    });

    it('should load more media when button is clicked', async () => {
      const firstBatch = Array(12)
        .fill(null)
        .map((_, i) => ({
          ...mockMedia[0],
          id: `media-${i}`,
          title: `Photo ${i}`,
        }));

      const secondBatch = Array(5)
        .fill(null)
        .map((_, i) => ({
          ...mockMedia[0],
          id: `media-${i + 12}`,
          title: `Photo ${i + 12}`,
        }));

      mockGetParkMedia
        .mockResolvedValueOnce({ media: firstBatch, error: null })
        .mockResolvedValueOnce({ media: secondBatch, error: null });

      render(<MediaGrid parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
      });

      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await userEvent.click(loadMoreButton);

      await waitFor(() => {
        expect(mockGetParkMedia).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Access Token Handling', () => {
    it('should correctly extract access_token from session', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'my-secret-token' },
        loading: false,
      });

      // Should not throw
      expect(() => render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />)).not.toThrow();
    });

    it('should handle null session gracefully', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: null,
        loading: false,
      });

      // Should not throw
      expect(() => render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />)).not.toThrow();
    });
  });

  describe('Grid Layout', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        loading: false,
      });
    });

    it('should apply grid layout classes', () => {
      const { container } = render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should render thumbnails', () => {
      render(<MediaGrid parkCode="yose" initialMedia={mockMedia} />);

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });
  });
});

describe('MediaCard Component', () => {
  const mockMediaItem = {
    id: 'media-1',
    user_id: 'user-1',
    park_code: 'yose',
    media_type: 'image',
    title: 'Yosemite Falls',
    url: 'https://example.com/image1.jpg',
    likes_count: 5,
    comments_count: 3,
    created_at: '2024-01-15T10:00:00Z',
    profiles: {
      display_name: 'John Doe',
      avatar_url: 'https://example.com/avatar1.jpg',
    },
    user_has_liked: false,
  };

  const mockOnLikeToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render media card with title', () => {
    render(
      <MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    expect(screen.getByText('Yosemite Falls')).toBeInTheDocument();
  });

  it('should render user display name', () => {
    render(
      <MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show likes count', () => {
    render(
      <MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show comments count', () => {
    render(
      <MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should call onLikeToggle when like button is clicked', async () => {
    mockOnLikeToggle.mockResolvedValue({ error: null });

    render(
      <MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    const likeButton = screen.getByRole('button');
    await userEvent.click(likeButton);

    expect(mockOnLikeToggle).toHaveBeenCalledWith('media-1', false);
  });

  it('should update like count optimistically', async () => {
    mockOnLikeToggle.mockResolvedValue({ error: null });

    render(
      <MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    const likeButton = screen.getByRole('button');
    await userEvent.click(likeButton);

    // Should show incremented count
    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument(); // 5 + 1
    });
  });

  it('should revert like count on error', async () => {
    mockOnLikeToggle.mockResolvedValue({ error: { message: 'Failed' } });

    render(
      <MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    const likeButton = screen.getByRole('button');
    await userEvent.click(likeButton);

    // Should revert to original count
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('should not allow liking without currentUserId', async () => {
    render(<MediaCard media={mockMediaItem} onLikeToggle={mockOnLikeToggle} currentUserId={null} />);

    const likeButton = screen.getByRole('button');
    await userEvent.click(likeButton);

    expect(mockOnLikeToggle).not.toHaveBeenCalled();
  });

  it('should show video indicator for video media', () => {
    const videoMedia = { ...mockMediaItem, media_type: 'video' };

    render(
      <MediaCard media={videoMedia} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    // Video should have a play icon (svg with path d="M8 5v14l11-7z")
    const playIcon = document.querySelector('svg path[d="M8 5v14l11-7z"]');
    expect(playIcon).toBeInTheDocument();
  });

  it('should show duration for videos with duration', () => {
    const videoMedia = { ...mockMediaItem, media_type: 'video', duration: 125 }; // 2:05

    render(
      <MediaCard media={videoMedia} onLikeToggle={mockOnLikeToggle} currentUserId="user-123" />
    );

    expect(screen.getByText('2:05')).toBeInTheDocument();
  });
});