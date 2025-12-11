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

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('FavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
    mockLocalStorage.getItem.mockReset();
    mockLocalStorage.setItem.mockReset();
  });

  describe('Rendering', () => {
    it('should render the heart button', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
      });

      render(<FavoriteButton parkId="park-123" />);

      const button = screen.getByRole('button', { name: /add to favorites/i });
      expect(button).toBeInTheDocument();
    });

    it('should render with different sizes', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
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

    it('should check favorite status when user is logged in', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

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
  });

  describe('Favorite Status', () => {
    it('should show unfilled heart when park is not a favorite', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

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
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          favorites: [{ nps_park_id: 'park-123' }],
        }),
      });

      render(<FavoriteButton parkId="park-123" />);

      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'currentColor');
      });
    });
  });

  describe('Toggle Favorite', () => {
    it('should add to favorites when clicking unfavorited park', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

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
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

      // First call: check status (favorited)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          favorites: [{ nps_park_id: 'park-123' }],
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
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

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
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

      // First call: check status (favorited)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          favorites: [{ nps_park_id: 'park-123' }],
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
  });

  describe('Loading State', () => {
    it('should disable button while loading', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

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
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

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
      });

      mockLocalStorage.getItem.mockReturnValue('test-token');

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