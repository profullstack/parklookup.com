/**
 * FavoriteButton Component Tests
 * Tests for the favorite button functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FavoriteButton } from '@/components/parks/FavoriteButton';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  default: () => mockUseAuth(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('FavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Rendering', () => {
    it('should render the heart button', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
      });

      render(<FavoriteButton parkId="park-123" />);

      const button = screen.getByRole('button', { name: /add to favorites/i });
      expect(button).toBeInTheDocument();
    });

    it('should render with different sizes', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
      });

      const { rerender } = render(<FavoriteButton parkId="park-123" size="sm" />);
      let svg = document.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');

      rerender(<FavoriteButton parkId="park-123" size="md" />);
      svg = document.querySelector('svg');
      expect(svg).toHaveClass('w-6', 'h-6');

      rerender(<FavoriteButton parkId="park-123" size="lg" />);
      svg = document.querySelector('svg');
      expect(svg).toHaveClass('w-8', 'h-8');
    });
  });

  describe('Authentication', () => {
    it('should redirect to signin when clicking without being logged in', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
      });

      // Mock window.location
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };

      render(<FavoriteButton parkId="park-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toBe('/signin');

      // Restore window.location
      window.location = originalLocation;
    });

    it('should check favorite status when user is logged in with session', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      render(<FavoriteButton parkId="park-123" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/favorites?parkId=park-123',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('should not check favorite status while auth is loading', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: true,
      });

      render(<FavoriteButton parkId="park-123" />);

      // Should not make any fetch calls while loading
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not check favorite status without session token', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: null,
        loading: false,
      });

      render(<FavoriteButton parkId="park-123" />);

      // Wait a bit to ensure no fetch is made
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Favorite Status', () => {
    it('should show unfilled heart when park is not a favorite', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      render(<FavoriteButton parkId="park-123" />);

      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'none');
      });
    });

    it('should show filled heart when park is a favorite', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          favorites: [{ park_id: 'park-123' }],
        }),
      });

      render(<FavoriteButton parkId="park-123" />);

      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'currentColor');
      });
    });

    it('should reset favorite state on 401 response', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'invalid-token' },
        loading: false,
      });

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(<FavoriteButton parkId="park-123" />);

      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'none');
      });
    });
  });

  describe('Toggle Favorite', () => {
    it('should add to favorites when clicking unfavorited park', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      // First call: check status (not favorited)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      // Second call: add to favorites
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorite: { id: 'fav-1', nps_park_id: 'park-123' } }),
      });

      render(<FavoriteButton parkId="park-123" />);

      // Wait for initial status check
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/favorites',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-token',
            }),
            body: JSON.stringify({ parkId: 'park-123' }),
          })
        );
      });
    });

    it('should remove from favorites when clicking favorited park', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      // First call: check status (favorited)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          favorites: [{ park_id: 'park-123' }],
        }),
      });

      // Second call: remove from favorites
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<FavoriteButton parkId="park-123" />);

      // Wait for initial status check
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/favorites/park-123',
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('should update button state after adding favorite', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      // First call: check status (not favorited)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      // Second call: add to favorites
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorite: { id: 'fav-1', nps_park_id: 'park-123' } }),
      });

      render(<FavoriteButton parkId="park-123" />);

      // Wait for initial status check
      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'none');
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // After adding, heart should be filled
      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'currentColor');
      });
    });

    it('should update button state after removing favorite', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      // First call: check status (favorited)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          favorites: [{ park_id: 'park-123' }],
        }),
      });

      // Second call: remove from favorites
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<FavoriteButton parkId="park-123" />);

      // Wait for initial status check
      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'currentColor');
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // After removing, heart should be unfilled
      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'none');
      });
    });

    it('should redirect to signin on 401 when adding favorite', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'expired-token' },
        loading: false,
      });

      // Mock window.location
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };

      // First call: check status (not favorited)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      // Second call: 401 error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(<FavoriteButton parkId="park-123" />);

      // Wait for initial status check
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(window.location.href).toBe('/signin');
      });

      // Restore window.location
      window.location = originalLocation;
    });
  });

  describe('Loading State', () => {
    it('should disable button while loading', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      // First call: check status
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      // Second call: slow response
      global.fetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ favorite: { id: 'fav-1' } }),
                }),
              100
            )
          )
      );

      render(<FavoriteButton parkId="park-123" />);

      // Wait for initial status check
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Button should be disabled while loading
      expect(button).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      // Mock console.error to suppress error output in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<FavoriteButton parkId="park-123" />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error checking favorite status:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle toggle errors gracefully', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token' },
        loading: false,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // First call: check status
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      });

      // Second call: error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<FavoriteButton parkId="park-123" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error toggling favorite:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});