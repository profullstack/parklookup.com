/**
 * Tests for SearchBar Component
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock debounce to execute immediately
vi.mock('@/lib/utils/debounce', () => ({
  debounce: (fn) => fn,
}));

describe('SearchBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Search redirect behavior', () => {
    it('should redirect to /search?q= when submitting search form', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'yosemite');

      // Submit the form
      fireEvent.submit(input.closest('form'));

      expect(mockPush).toHaveBeenCalledWith('/search?q=yosemite');
    });

    it('should redirect to /search?q= when typing (debounced)', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'grand canyon');

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?q=grand%20canyon');
      });
    });

    it('should NOT redirect to /parks?q= (old behavior)', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'yellowstone');

      fireEvent.submit(input.closest('form'));

      // Should NOT use the old /parks route
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/parks?q='));
      // Should use the new /search route
      expect(mockPush).toHaveBeenCalledWith('/search?q=yellowstone');
    });

    it('should encode special characters in search query', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'park & recreation');

      fireEvent.submit(input.closest('form'));

      expect(mockPush).toHaveBeenCalledWith('/search?q=park%20%26%20recreation');
    });
  });

  describe('Custom onSearch callback', () => {
    it('should call onSearch callback instead of redirecting when provided', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();
      const onSearchMock = vi.fn();

      render(<SearchBar onSearch={onSearchMock} />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'zion');

      fireEvent.submit(input.closest('form'));

      expect(onSearchMock).toHaveBeenCalledWith('zion');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should call onSearch on debounced input when provided', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();
      const onSearchMock = vi.fn();

      render(<SearchBar onSearch={onSearchMock} />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'acadia');

      await waitFor(() => {
        expect(onSearchMock).toHaveBeenCalledWith('acadia');
      });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Input behavior', () => {
    it('should render with custom placeholder', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;

      render(<SearchBar placeholder="Find a park..." />);

      expect(screen.getByPlaceholderText('Find a park...')).toBeInTheDocument();
    });

    it('should render with initial query', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;

      render(<SearchBar initialQuery="glacier" />);

      const input = screen.getByDisplayValue('glacier');
      expect(input).toBeInTheDocument();
    });

    it('should show clear button when input has value', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');

      // Initially no clear button
      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      await user.type(input, 'test');

      // Clear button should appear
      const clearButton = screen.getByRole('button');
      expect(clearButton).toBeInTheDocument();
    });

    it('should clear input when clear button is clicked', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'test');

      expect(input).toHaveValue('test');

      const clearButton = screen.getByRole('button');
      await user.click(clearButton);

      expect(input).toHaveValue('');
    });

    it('should not trigger search for queries less than 2 characters', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'a');

      // Should not redirect for single character
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should trigger search for queries with 2 or more characters', async () => {
      const SearchBar = (await import('@/components/parks/SearchBar')).default;
      const user = userEvent.setup();

      render(<SearchBar />);

      const input = screen.getByPlaceholderText('Search parks...');
      await user.type(input, 'ab');

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?q=ab');
      });
    });
  });
});
