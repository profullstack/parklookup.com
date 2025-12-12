/**
 * MediaDetailClient Component Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock useAuth hook
const mockUser = { id: 'user-123' };
const mockSession = { access_token: 'test-token' };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    session: mockSession,
  })),
}));

// Mock media-client functions
vi.mock('@/lib/media/media-client', () => ({
  toggleMediaLike: vi.fn(() => Promise.resolve({ success: true })),
  deleteMedia: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock MediaComments component
vi.mock('@/components/media/MediaComments', () => ({
  default: ({ mediaId }) => <div data-testid="media-comments">Comments for {mediaId}</div>,
}));

// Mock fetch for like status check
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ user_has_liked: false }),
  })
);

import MediaDetailClient from '@/app/media/[mediaId]/MediaDetailClient';
import { useAuth } from '@/hooks/useAuth';
import { toggleMediaLike, deleteMedia } from '@/lib/media/media-client';

describe('MediaDetailClient', () => {
  const mockMedia = {
    id: 'media-123',
    user_id: 'user-123',
    park_code: 'yose',
    media_type: 'photo',
    storage_path: 'user-123/media-123/123.jpg',
    thumbnail_path: 'user-123/media-123/123-thumb.jpg',
    url: 'https://example.com/image.jpg',
    thumbnail_url: 'https://example.com/thumb.jpg',
    title: 'Beautiful Yosemite',
    description: 'A stunning view of Half Dome',
    width: 1920,
    height: 1080,
    created_at: new Date().toISOString(),
    likes_count: 5,
    comments_count: 3,
    profiles: {
      id: 'user-123',
      display_name: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg',
      bio: 'Nature lover',
    },
    park: {
      id: 'park-1',
      park_code: 'yose',
      full_name: 'Yosemite National Park',
    },
    nps_parks: {
      id: 'park-1',
      park_code: 'yose',
      full_name: 'Yosemite National Park',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      session: mockSession,
    });
  });

  describe('Rendering', () => {
    it('should render media title', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByText('Beautiful Yosemite')).toBeInTheDocument();
    });

    it('should render media description', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByText('A stunning view of Half Dome')).toBeInTheDocument();
    });

    it('should render user display name', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render park name from park property', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
    });

    it('should render park name from nps_parks for backward compatibility', () => {
      const mediaWithoutPark = { ...mockMedia, park: null };
      render(<MediaDetailClient media={mediaWithoutPark} />);
      expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
    });

    it('should render likes count', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render comments count', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render image for photo media type', () => {
      render(<MediaDetailClient media={mockMedia} />);
      const img = screen.getByRole('img', { name: 'Beautiful Yosemite' });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('should render video for video media type', () => {
      const videoMedia = { ...mockMedia, media_type: 'video', duration: 120 };
      render(<MediaDetailClient media={videoMedia} />);
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('should render media dimensions', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByText('Size: 1920 × 1080')).toBeInTheDocument();
    });

    it('should render video duration for video media', () => {
      const videoMedia = { ...mockMedia, media_type: 'video', duration: 125 };
      render(<MediaDetailClient media={videoMedia} />);
      expect(screen.getByText('Duration: 2:05')).toBeInTheDocument();
    });

    it('should render MediaComments component', () => {
      render(<MediaDetailClient media={mockMedia} />);
      expect(screen.getByTestId('media-comments')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is clicked', () => {
      render(<MediaDetailClient media={mockMedia} />);
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);
      expect(mockBack).toHaveBeenCalled();
    });

    it('should link to user profile', () => {
      render(<MediaDetailClient media={mockMedia} />);
      // Find link containing the user name
      const userLinks = screen.getAllByRole('link');
      const userLink = userLinks.find(link => link.getAttribute('href') === '/users/user-123');
      expect(userLink).toBeTruthy();
    });

    it('should link to park page using park_code', () => {
      render(<MediaDetailClient media={mockMedia} />);
      const parkLink = screen.getByRole('link', { name: /Yosemite National Park/i });
      expect(parkLink).toHaveAttribute('href', '/parks/yose');
    });
  });

  describe('Like Functionality', () => {
    it('should toggle like when like button is clicked', async () => {
      render(<MediaDetailClient media={mockMedia} />);
      
      // Find the like button (contains the heart icon and count)
      const likeButton = screen.getByRole('button', { name: /5/i });
      fireEvent.click(likeButton);

      await waitFor(() => {
        expect(toggleMediaLike).toHaveBeenCalledWith('test-token', 'media-123', false);
      });
    });

    it('should check like status on mount', async () => {
      render(<MediaDetailClient media={mockMedia} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/media/media-123/likes',
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          })
        );
      });
    });

    it('should not allow liking when not authenticated', () => {
      useAuth.mockReturnValue({ user: null, session: null });
      render(<MediaDetailClient media={mockMedia} />);
      
      const likeButton = screen.getByRole('button', { name: /5/i });
      expect(likeButton).toBeDisabled();
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete button for media owner', () => {
      render(<MediaDetailClient media={mockMedia} />);
      
      // Find delete button (trash icon)
      const deleteButton = document.querySelector('button svg path[d*="M19 7l-.867"]')?.closest('button');
      expect(deleteButton).toBeInTheDocument();
    });

    it('should not show delete button for non-owner', () => {
      useAuth.mockReturnValue({
        user: { id: 'other-user' },
        session: mockSession,
      });
      render(<MediaDetailClient media={mockMedia} />);
      
      const deleteButton = document.querySelector('button svg path[d*="M19 7l-.867"]')?.closest('button');
      // Should be null or undefined (not present)
      expect(deleteButton == null).toBe(true);
    });

    it('should show confirmation modal when delete is clicked', () => {
      render(<MediaDetailClient media={mockMedia} />);
      
      const deleteButton = document.querySelector('button svg path[d*="M19 7l-.867"]')?.closest('button');
      fireEvent.click(deleteButton);

      expect(screen.getByText('Delete this photo?')).toBeInTheDocument();
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    });

    it('should close confirmation modal when cancel is clicked', () => {
      render(<MediaDetailClient media={mockMedia} />);
      
      const deleteButton = document.querySelector('button svg path[d*="M19 7l-.867"]')?.closest('button');
      fireEvent.click(deleteButton);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Delete this photo?')).not.toBeInTheDocument();
    });

    it('should delete media and redirect when confirmed', async () => {
      render(<MediaDetailClient media={mockMedia} />);
      
      const deleteButton = document.querySelector('button svg path[d*="M19 7l-.867"]')?.closest('button');
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByText('Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteMedia).toHaveBeenCalledWith('test-token', 'media-123');
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/parks/yose/photos');
      });
    });

    it('should redirect to home if no park_code after delete', async () => {
      const mediaWithoutPark = { ...mockMedia, park_code: null, park: null, nps_parks: null };
      render(<MediaDetailClient media={mediaWithoutPark} />);
      
      const deleteButton = document.querySelector('button svg path[d*="M19 7l-.867"]')?.closest('button');
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByText('Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Relative Time Formatting', () => {
    it('should show "Just now" for recent posts', () => {
      const recentMedia = { ...mockMedia, created_at: new Date().toISOString() };
      render(<MediaDetailClient media={recentMedia} />);
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should show minutes ago for posts within an hour', () => {
      const date = new Date();
      date.setMinutes(date.getMinutes() - 30);
      const mediaWithTime = { ...mockMedia, created_at: date.toISOString() };
      render(<MediaDetailClient media={mediaWithTime} />);
      expect(screen.getByText('30 minutes ago')).toBeInTheDocument();
    });

    it('should show hours ago for posts within a day', () => {
      const date = new Date();
      date.setHours(date.getHours() - 5);
      const mediaWithTime = { ...mockMedia, created_at: date.toISOString() };
      render(<MediaDetailClient media={mediaWithTime} />);
      expect(screen.getByText('5 hours ago')).toBeInTheDocument();
    });

    it('should show days ago for posts within a week', () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      const mediaWithTime = { ...mockMedia, created_at: date.toISOString() };
      render(<MediaDetailClient media={mediaWithTime} />);
      expect(screen.getByText('3 days ago')).toBeInTheDocument();
    });
  });

  describe('Anonymous User Display', () => {
    it('should show "Anonymous" when profile has no display_name', () => {
      const mediaWithoutName = {
        ...mockMedia,
        profiles: { ...mockMedia.profiles, display_name: null },
      };
      render(<MediaDetailClient media={mediaWithoutName} />);
      expect(screen.getByText('Anonymous')).toBeInTheDocument();
    });

    it('should show default avatar when profile has no avatar_url', () => {
      const mediaWithoutAvatar = {
        ...mockMedia,
        profiles: { ...mockMedia.profiles, avatar_url: null },
      };
      render(<MediaDetailClient media={mediaWithoutAvatar} />);
      // Check for the default avatar SVG
      const defaultAvatar = document.querySelector('svg path[d*="M12 12c2.21"]');
      expect(defaultAvatar).toBeInTheDocument();
    });
  });

  describe('Media Without Title/Description', () => {
    it('should use default alt text when no title', () => {
      const mediaWithoutTitle = { ...mockMedia, title: null };
      render(<MediaDetailClient media={mediaWithoutTitle} />);
      const img = screen.getByRole('img', { name: 'User photo' });
      expect(img).toBeInTheDocument();
    });

    it('should not render title section when no title', () => {
      const mediaWithoutTitle = { ...mockMedia, title: null };
      render(<MediaDetailClient media={mediaWithoutTitle} />);
      expect(screen.queryByText('Beautiful Yosemite')).not.toBeInTheDocument();
    });

    it('should not render description section when no description', () => {
      const mediaWithoutDesc = { ...mockMedia, description: null };
      render(<MediaDetailClient media={mediaWithoutDesc} />);
      expect(screen.queryByText('A stunning view of Half Dome')).not.toBeInTheDocument();
    });
  });
});