/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TrackDetailClient from '@/app/tracks/[id]/TrackDetailClient';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: (importFn, options) => {
    // Return a simple mock component for LiveTrackMap
    const MockComponent = (props) => (
      <div data-testid="live-track-map" {...props}>
        Mock Map
      </div>
    );
    MockComponent.displayName = 'MockLiveTrackMap';
    return MockComponent;
  },
}));

// Mock useAuth hook
const mockUser = { id: 'user-123' };
const mockAccessToken = 'mock-token';
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    accessToken: mockAccessToken,
  }),
}));

// Mock tracking client functions
const mockShareTrack = vi.fn();
const mockUnshareTrack = vi.fn();
const mockGetTrackLikes = vi.fn();
const mockLikeTrack = vi.fn();
const mockUnlikeTrack = vi.fn();
const mockDeleteTrack = vi.fn();
const mockGetTrackComments = vi.fn();
const mockAddTrackComment = vi.fn();

vi.mock('@/lib/tracking/tracking-client', () => ({
  shareTrack: (...args) => mockShareTrack(...args),
  unshareTrack: (...args) => mockUnshareTrack(...args),
  getTrackLikes: (...args) => mockGetTrackLikes(...args),
  likeTrack: (...args) => mockLikeTrack(...args),
  unlikeTrack: (...args) => mockUnlikeTrack(...args),
  deleteTrack: (...args) => mockDeleteTrack(...args),
  getTrackComments: (...args) => mockGetTrackComments(...args),
  addTrackComment: (...args) => mockAddTrackComment(...args),
}));

// Mock activity detection
vi.mock('@/lib/tracking/activity-detection', () => ({
  getActivityIcon: (type) => {
    const icons = { walking: '🚶', hiking: '🥾', biking: '🚴', driving: '🚗' };
    return icons[type] || '🚶';
  },
  getActivityColor: (type) => {
    const colors = { walking: '#4CAF50', hiking: '#8BC34A', biking: '#2196F3', driving: '#9C27B0' };
    return colors[type] || '#4CAF50';
  },
}));

// Mock track stats formatters
vi.mock('@/lib/tracking/track-stats', () => ({
  formatDistance: (meters) => `${(meters / 1000).toFixed(1)} km`,
  formatDuration: (seconds) => `${Math.floor(seconds / 60)} min`,
  formatSpeed: (mps) => `${(mps * 3.6).toFixed(1)} km/h`,
  formatElevation: (meters) => `${meters} m`,
}));

describe('TrackDetailClient', () => {
  // Base track data for tests
  const createMockTrack = (overrides = {}) => ({
    id: 'track-123',
    user_id: 'user-123',
    title: 'Morning Hike',
    description: 'A beautiful morning hike',
    activity_type: 'hiking',
    status: 'completed',
    is_public: false,
    distance_meters: 5000,
    duration_seconds: 3600,
    elevation_gain_m: 200,
    avg_speed_mps: 1.4,
    created_at: '2024-01-15T08:00:00Z',
    started_at: '2024-01-15T08:00:00Z',
    ended_at: '2024-01-15T09:00:00Z',
    likes_count: 5,
    comments_count: 2,
    profiles: {
      id: 'user-123',
      display_name: 'Test User',
      username: 'testuser',
      avatar_url: null,
    },
    ...overrides,
  });

  const mockPoints = [
    { latitude: 37.7749, longitude: -122.4194, altitude_m: 10 },
    { latitude: 37.7750, longitude: -122.4195, altitude_m: 15 },
  ];

  const mockMedia = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTrackLikes.mockResolvedValue({ userHasLiked: false, likesCount: 5 });
    mockGetTrackComments.mockResolvedValue({ comments: [] });
    mockShareTrack.mockResolvedValue({ track: { id: 'track-123', is_public: true, status: 'shared' } });
    mockUnshareTrack.mockResolvedValue({ track: { id: 'track-123', is_public: false, status: 'completed' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Shared State Initialization', () => {
    it('should show Private button when track is not shared (is_public: false, status: completed)', async () => {
      const track = createMockTrack({ is_public: false, status: 'completed' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        const privateButton = screen.getByRole('button', { name: /private/i });
        expect(privateButton).toBeInTheDocument();
        // Should not have the green "shared" styling
        expect(privateButton.className).not.toContain('bg-green');
      });
    });

    it('should show Public button when track is shared (is_public: true, status: shared)', async () => {
      const track = createMockTrack({ is_public: true, status: 'shared' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        const publicButton = screen.getByRole('button', { name: /public/i });
        expect(publicButton).toBeInTheDocument();
        // Should have the green "shared" styling
        expect(publicButton.className).toContain('bg-green');
      });
    });

    it('should show Private when is_public is true but status is not shared', async () => {
      // Edge case: is_public might be true but status is still 'completed'
      // This shouldn't happen in practice, but the UI should handle it correctly
      const track = createMockTrack({ is_public: true, status: 'completed' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        const privateButton = screen.getByRole('button', { name: /private/i });
        expect(privateButton).toBeInTheDocument();
      });
    });

    it('should show Private when is_public is false but status is shared', async () => {
      // Edge case: status might be 'shared' but is_public is false
      // This shouldn't happen in practice, but the UI should handle it correctly
      const track = createMockTrack({ is_public: false, status: 'shared' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        const privateButton = screen.getByRole('button', { name: /private/i });
        expect(privateButton).toBeInTheDocument();
      });
    });
  });

  describe('Share/Unshare Functionality', () => {
    it('should call shareTrack API when clicking Private button', async () => {
      const track = createMockTrack({ is_public: false, status: 'completed' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });

      const privateButton = screen.getByRole('button', { name: /private/i });
      
      await act(async () => {
        fireEvent.click(privateButton);
      });

      await waitFor(() => {
        expect(mockShareTrack).toHaveBeenCalledWith(mockAccessToken, 'track-123');
      });
    });

    it('should call unshareTrack API when clicking Public button', async () => {
      const track = createMockTrack({ is_public: true, status: 'shared' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /public/i })).toBeInTheDocument();
      });

      const publicButton = screen.getByRole('button', { name: /public/i });
      
      await act(async () => {
        fireEvent.click(publicButton);
      });

      await waitFor(() => {
        expect(mockUnshareTrack).toHaveBeenCalledWith(mockAccessToken, 'track-123');
      });
    });

    it('should update UI to Public after successful share', async () => {
      const track = createMockTrack({ is_public: false, status: 'completed' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });

      const privateButton = screen.getByRole('button', { name: /private/i });
      
      await act(async () => {
        fireEvent.click(privateButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /public/i })).toBeInTheDocument();
      });
    });

    it('should update UI to Private after successful unshare', async () => {
      const track = createMockTrack({ is_public: true, status: 'shared' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /public/i })).toBeInTheDocument();
      });

      const publicButton = screen.getByRole('button', { name: /public/i });
      
      await act(async () => {
        fireEvent.click(publicButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });
    });

    it('should revert UI state on share API error', async () => {
      mockShareTrack.mockResolvedValue({ error: { message: 'Failed to share' } });
      
      const track = createMockTrack({ is_public: false, status: 'completed' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });

      const privateButton = screen.getByRole('button', { name: /private/i });
      
      await act(async () => {
        fireEvent.click(privateButton);
      });

      // Should revert back to Private after error
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });
    });

    it('should revert UI state on unshare API error', async () => {
      mockUnshareTrack.mockResolvedValue({ error: { message: 'Failed to unshare' } });
      
      const track = createMockTrack({ is_public: true, status: 'shared' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /public/i })).toBeInTheDocument();
      });

      const publicButton = screen.getByRole('button', { name: /public/i });
      
      await act(async () => {
        fireEvent.click(publicButton);
      });

      // Should revert back to Public after error
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /public/i })).toBeInTheDocument();
      });
    });

    it('should revert UI state on share API exception', async () => {
      mockShareTrack.mockRejectedValue(new Error('Network error'));
      
      const track = createMockTrack({ is_public: false, status: 'completed' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });

      const privateButton = screen.getByRole('button', { name: /private/i });
      
      await act(async () => {
        fireEvent.click(privateButton);
      });

      // Should revert back to Private after exception
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });
    });
  });

  describe('Owner-only Share Button', () => {
    it('should show share button for track owner', async () => {
      const track = createMockTrack({ user_id: 'user-123' }); // Same as mockUser.id
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /private/i })).toBeInTheDocument();
      });
    });

    it('should not show share button for non-owner', async () => {
      const track = createMockTrack({ user_id: 'other-user-456' }); // Different from mockUser.id
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        // Share button should not be present for non-owners
        expect(screen.queryByRole('button', { name: /private/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /public/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Track Details Display', () => {
    it('should display track title', async () => {
      const track = createMockTrack({ title: 'Epic Mountain Trail' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByText('Epic Mountain Trail')).toBeInTheDocument();
      });
    });

    it('should display activity type badge', async () => {
      const track = createMockTrack({ activity_type: 'hiking' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByText(/hiking/i)).toBeInTheDocument();
      });
    });

    it('should display track stats', async () => {
      const track = createMockTrack({
        distance_meters: 5000,
        duration_seconds: 3600,
        elevation_gain_m: 200,
      });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByText('5.0 km')).toBeInTheDocument();
        expect(screen.getByText('60 min')).toBeInTheDocument();
        expect(screen.getByText('200 m')).toBeInTheDocument();
      });
    });

    it('should display user profile info', async () => {
      const track = createMockTrack({
        profiles: {
          id: 'user-123',
          display_name: 'John Hiker',
          username: 'johnhiker',
          avatar_url: null,
        },
      });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        // Should show first letter of display name in avatar placeholder
        expect(screen.getByText('J')).toBeInTheDocument();
      });
    });
  });

  describe('Like Functionality', () => {
    it('should display likes count', async () => {
      const track = createMockTrack({ likes_count: 10 });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });

    it('should call likeTrack API when clicking like button', async () => {
      mockLikeTrack.mockResolvedValue({ like: {}, likesCount: 6 });
      
      const track = createMockTrack({ likes_count: 5 });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });

      // Find the like button (it's the first button with a number)
      const likeButton = screen.getAllByRole('button').find(btn => btn.textContent.includes('5'));
      
      await act(async () => {
        fireEvent.click(likeButton);
      });

      await waitFor(() => {
        expect(mockLikeTrack).toHaveBeenCalledWith(mockAccessToken, 'track-123');
      });
    });
  });

  describe('Comments Functionality', () => {
    it('should display comments count', async () => {
      const track = createMockTrack({ comments_count: 3 });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('should load comments when clicking comments button', async () => {
      mockGetTrackComments.mockResolvedValue({
        comments: [
          {
            id: 'comment-1',
            content: 'Great hike!',
            created_at: '2024-01-15T10:00:00Z',
            profiles: { display_name: 'Commenter', avatar_url: null },
          },
        ],
      });
      
      const track = createMockTrack({ comments_count: 1 });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Find and click the comments button
      const commentsButton = screen.getAllByRole('button').find(btn => btn.textContent.includes('1'));
      
      await act(async () => {
        fireEvent.click(commentsButton);
      });

      await waitFor(() => {
        expect(mockGetTrackComments).toHaveBeenCalledWith(mockAccessToken, 'track-123');
        expect(screen.getByText('Great hike!')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete button for track owner', async () => {
      const track = createMockTrack({ user_id: 'user-123' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });
    });

    it('should not show delete button for non-owner', async () => {
      const track = createMockTrack({ user_id: 'other-user-456' });
      
      render(<TrackDetailClient track={track} points={mockPoints} media={mockMedia} />);
      
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      });
    });
  });
});
