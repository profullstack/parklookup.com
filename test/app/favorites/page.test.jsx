/**
 * Favorites Page Tests
 * Tests for the favorites page authentication flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FavoritesPage from '@/app/favorites/page.jsx';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock useAnalytics
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackPageView: vi.fn(),
    trackEvent: vi.fn(),
  }),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  default: () => mockUseAuth(),
}));

// Mock fetch for favorites API
global.fetch = vi.fn();

describe('FavoritesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Authentication', () => {
    it('should redirect to signin when user is not authenticated', async () => {
      // Mock useAuth to return no user (not authenticated)
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        isAuthenticated: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin?redirect=/favorites');
      });
    });

    it('should NOT redirect when user is authenticated', async () => {
      // Mock useAuth to return authenticated user
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      // Mock both API calls (favorites and liked tracks)
      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ favorites: [] }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      // Wait for component to settle
      await waitFor(() => {
        expect(screen.getByText('My Favorites')).toBeInTheDocument();
      });

      // Should NOT redirect
      expect(mockPush).not.toHaveBeenCalledWith('/signin?redirect=/favorites');
    });

    it('should show loading state while checking authentication', async () => {
      // Mock useAuth to return loading state
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: true,
        isAuthenticated: false,
      });

      render(<FavoritesPage />);

      // Should show loading skeleton
      const loadingElements = document.querySelectorAll('.animate-pulse');
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should display user email when authenticated', async () => {
      // Mock useAuth to return authenticated user
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'john@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      // Mock both API calls
      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ favorites: [] }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText('Welcome back, john')).toBeInTheDocument();
      });
    });

    it('should pass authorization header when fetching favorites', async () => {
      // Mock useAuth to return authenticated user
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token-123' },
        loading: false,
        isAuthenticated: true,
      });

      // Mock both API calls
      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ favorites: [] }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/favorites',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token-123',
            }),
          })
        );
      });
    });
  });

  describe('Favorites Display', () => {
    it('should show empty state when no favorites', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      // Mock both API calls
      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ favorites: [] }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText('No favorites yet')).toBeInTheDocument();
      });
    });

    it('should display favorites count when favorites exist', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      // Mock both API calls
      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              favorites: [
                {
                  id: 'fav-1',
                  park_id: 'park-1',
                  park: { id: 'park-1', full_name: 'Yellowstone', park_code: 'yell' },
                },
                {
                  id: 'fav-2',
                  park_id: 'park-2',
                  park: { id: 'park-2', full_name: 'Yosemite', park_code: 'yose' },
                },
              ],
            }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText('You have 2 favorite parks')).toBeInTheDocument();
      });
    });
  });

  describe('Tabs Navigation', () => {
    it('should display Parks and Liked Tracks tabs when user has favorites', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      // Mock both API calls - favorites with data and liked tracks
      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              favorites: [
                {
                  id: 'fav-1',
                  park_id: 'park-1',
                  park: { id: 'park-1', full_name: 'Yellowstone', park_code: 'yell' },
                },
              ],
            }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        // Tabs are buttons, not role="tab"
        expect(screen.getByText(/Parks \(/i)).toBeInTheDocument();
        expect(screen.getByText(/Liked Tracks \(/i)).toBeInTheDocument();
      });
    });

    it('should show Parks tab content by default', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              favorites: [
                {
                  id: 'fav-1',
                  park_id: 'park-1',
                  park: { id: 'park-1', full_name: 'Yellowstone', park_code: 'yell' },
                },
              ],
            }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        // Parks tab should be active and show content
        expect(screen.getByText('You have 1 favorite park')).toBeInTheDocument();
      });
    });
  });

  describe('Liked Tracks Tab', () => {
    it('should fetch liked tracks on page load', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      global.fetch.mockImplementation((url, options) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              favorites: [
                {
                  id: 'fav-1',
                  park_id: 'park-1',
                  park: { id: 'park-1', full_name: 'Yellowstone', park_code: 'yell' },
                },
              ],
            }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        // Both API calls should be made on page load
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/favorites/tracks',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer valid-token',
            }),
          })
        );
      });
    });

    it('should display liked tracks when available and tab is clicked', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              favorites: [
                {
                  id: 'fav-1',
                  park_id: 'park-1',
                  park: { id: 'park-1', full_name: 'Yellowstone', park_code: 'yell' },
                },
              ],
            }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tracks: [
                {
                  track_id: 'track-1',
                  title: 'Morning Hike at Yosemite',
                  user_display_name: 'John Doe',
                  user_username: 'johndoe',
                  activity_type: 'hiking',
                  distance_meters: 5000,
                  duration_seconds: 3600,
                  park_name: 'Yosemite National Park',
                  likes_count: 10,
                  comments_count: 5,
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Liked Tracks \(/i)).toBeInTheDocument();
      });

      // Click on Liked Tracks tab
      const likedTracksTab = screen.getByText(/Liked Tracks \(/i);
      likedTracksTab.click();

      await waitFor(() => {
        expect(screen.getByText('Morning Hike at Yosemite')).toBeInTheDocument();
      });
    });

    it('should show empty state when no liked tracks and tab is clicked', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'valid-token' },
        loading: false,
        isAuthenticated: true,
      });

      global.fetch.mockImplementation((url) => {
        if (url === '/api/favorites') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              favorites: [
                {
                  id: 'fav-1',
                  park_id: 'park-1',
                  park: { id: 'park-1', full_name: 'Yellowstone', park_code: 'yell' },
                },
              ],
            }),
          });
        }
        if (url === '/api/favorites/tracks') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tracks: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Liked Tracks \(/i)).toBeInTheDocument();
      });

      // Click on Liked Tracks tab
      const likedTracksTab = screen.getByText(/Liked Tracks \(/i);
      likedTracksTab.click();

      await waitFor(() => {
        expect(screen.getByText(/No liked tracks yet/i)).toBeInTheDocument();
      });
    });
  });
});