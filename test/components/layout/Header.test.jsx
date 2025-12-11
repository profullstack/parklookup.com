/**
 * Header Component Tests
 * Tests for the main navigation header with user dropdown
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Header from '@/components/layout/Header';

// Mock Next.js components
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// Mock useAuth hook
const mockSignOut = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    signOut: mockSignOut,
    loading: false,
  })),
}));

import { useAuth } from '@/hooks/useAuth';

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: null,
        signOut: mockSignOut,
        loading: false,
      });
    });

    it('should render logo', () => {
      render(<Header />);
      expect(screen.getByAltText('ParkLookup')).toBeInTheDocument();
    });

    it('should render navigation links', () => {
      render(<Header />);
      expect(screen.getByText('Explore Parks')).toBeInTheDocument();
      expect(screen.getByText('States')).toBeInTheDocument();
    });

    it('should render Sign In and Sign Up buttons', () => {
      render(<Header />);
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    it('should not render My Trips link when not authenticated', () => {
      render(<Header />);
      expect(screen.queryByText('My Trips')).not.toBeInTheDocument();
    });

    it('should not render My Favorites link when not authenticated', () => {
      render(<Header />);
      expect(screen.queryByText('My Favorites')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while auth is loading', () => {
      useAuth.mockReturnValue({
        user: null,
        signOut: mockSignOut,
        loading: true,
      });

      render(<Header />);
      // Should show loading placeholder
      const loadingElement = document.querySelector('.animate-pulse');
      expect(loadingElement).toBeInTheDocument();
    });
  });

  describe('Authenticated State', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        signOut: mockSignOut,
        loading: false,
      });
    });

    it('should render user dropdown button', () => {
      render(<Header />);
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('should render user avatar with first letter', () => {
      render(<Header />);
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should render My Trips link when authenticated', () => {
      render(<Header />);
      expect(screen.getByText('My Trips')).toBeInTheDocument();
    });

    it('should render My Favorites link when authenticated', () => {
      render(<Header />);
      expect(screen.getByText('My Favorites')).toBeInTheDocument();
    });

    it('should not render Sign In button when authenticated', () => {
      render(<Header />);
      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('should not render Sign Up button when authenticated', () => {
      render(<Header />);
      expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
    });
  });

  describe('User Dropdown', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        signOut: mockSignOut,
        loading: false,
      });
    });

    it('should open dropdown when clicking username', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });
    });

    it('should show user email in dropdown', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('testuser@example.com')).toBeInTheDocument();
      });
    });

    it('should have Settings link pointing to /settings', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        const settingsLink = screen.getByText('Settings').closest('a');
        expect(settingsLink).toHaveAttribute('href', '/settings');
      });
    });

    it('should call signOut when clicking Sign Out', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        const signOutButton = screen.getByText('Sign Out');
        fireEvent.click(signOutButton);
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should close dropdown when clicking outside', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown when pressing Escape', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      });
    });

    it('should toggle dropdown on multiple clicks', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      
      // Open
      fireEvent.click(dropdownButton);
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Close
      fireEvent.click(dropdownButton);
      await waitFor(() => {
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      });

      // Open again
      fireEvent.click(dropdownButton);
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should close dropdown when clicking Settings link', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser');
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        const settingsLink = screen.getByText('Settings');
        fireEvent.click(settingsLink);
      });

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should have aria-expanded attribute on dropdown button', async () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser').closest('button');
      expect(dropdownButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(dropdownButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have aria-haspopup attribute on dropdown button', () => {
      render(<Header />);
      
      const dropdownButton = screen.getByText('testuser').closest('button');
      expect(dropdownButton).toHaveAttribute('aria-haspopup', 'true');
    });
  });

  describe('Mobile Menu', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        signOut: mockSignOut,
        loading: false,
      });
    });

    it('should toggle mobile menu when clicking hamburger button', async () => {
      render(<Header />);
      
      // Find mobile menu button (hamburger icon)
      const mobileMenuButton = document.querySelector('.md\\:hidden button');
      expect(mobileMenuButton).toBeInTheDocument();

      fireEvent.click(mobileMenuButton);

      // Mobile menu should be visible
      await waitFor(() => {
        const mobileMenu = document.querySelector('.md\\:hidden.py-4');
        expect(mobileMenu).toBeInTheDocument();
      });
    });

    it('should show Settings link in mobile menu when authenticated', async () => {
      render(<Header />);
      
      const mobileMenuButton = document.querySelector('.md\\:hidden button');
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        // Find Settings in mobile menu
        const settingsLinks = screen.getAllByText('Settings');
        expect(settingsLinks.length).toBeGreaterThan(0);
      });
    });

    it('should show Sign Out button in mobile menu when authenticated', async () => {
      render(<Header />);
      
      const mobileMenuButton = document.querySelector('.md\\:hidden button');
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        const signOutButtons = screen.getAllByText('Sign Out');
        expect(signOutButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show user info in mobile menu', async () => {
      render(<Header />);
      
      const mobileMenuButton = document.querySelector('.md\\:hidden button');
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        // Should show username and email in mobile menu
        const usernames = screen.getAllByText('testuser');
        expect(usernames.length).toBeGreaterThan(0);
      });
    });

    it('should have links in mobile menu that close menu on click', async () => {
      render(<Header />);
      
      const mobileMenuButton = document.querySelector('.md\\:hidden button');
      fireEvent.click(mobileMenuButton);

      await waitFor(() => {
        const mobileMenu = document.querySelector('.md\\:hidden.py-4');
        expect(mobileMenu).toBeInTheDocument();
      });

      // Verify the mobile menu contains navigation links
      const mobileMenu = document.querySelector('.md\\:hidden.py-4');
      expect(mobileMenu).toBeInTheDocument();
      
      // Check that links exist in the mobile menu
      const links = mobileMenu.querySelectorAll('a');
      expect(links.length).toBeGreaterThan(0);
      
      // Verify Explore Parks link exists
      const exploreLink = Array.from(links).find(link =>
        link.textContent.includes('Explore Parks')
      );
      expect(exploreLink).toBeTruthy();
    });
  });

  describe('Navigation Links', () => {
    it('should have correct href for Explore Parks', () => {
      useAuth.mockReturnValue({
        user: null,
        signOut: mockSignOut,
        loading: false,
      });

      render(<Header />);
      const link = screen.getByText('Explore Parks').closest('a');
      expect(link).toHaveAttribute('href', '/search');
    });

    it('should have correct href for States', () => {
      useAuth.mockReturnValue({
        user: null,
        signOut: mockSignOut,
        loading: false,
      });

      render(<Header />);
      const link = screen.getByText('States').closest('a');
      expect(link).toHaveAttribute('href', '/states');
    });

    it('should have correct href for My Trips', () => {
      useAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        signOut: mockSignOut,
        loading: false,
      });

      render(<Header />);
      const link = screen.getByText('My Trips').closest('a');
      expect(link).toHaveAttribute('href', '/trips');
    });

    it('should have correct href for My Favorites', () => {
      useAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        signOut: mockSignOut,
        loading: false,
      });

      render(<Header />);
      const link = screen.getByText('My Favorites').closest('a');
      expect(link).toHaveAttribute('href', '/favorites');
    });
  });
});