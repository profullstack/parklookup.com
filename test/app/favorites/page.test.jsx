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

      // Mock favorites API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      render(<FavoritesPage />);

      // Wait for component to settle
      await waitFor(() => {
        expect(screen.getByText('My Favorite Parks')).toBeInTheDocument();
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

      // Mock favorites API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
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

      // Mock favorites API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
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

      global.fetch.mockResolvedValueOnce({
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

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText('You have 2 favorite parks')).toBeInTheDocument();
      });
    });
  });
});