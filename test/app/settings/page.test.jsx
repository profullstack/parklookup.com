/**
 * Settings Page Tests
 * Tests for the user settings page
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';

// Mock Next.js router
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    loading: false,
    isAuthenticated: false,
  })),
}));

import { useAuth } from '@/hooks/useAuth';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('test-auth-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should redirect to signin if not authenticated', async () => {
      useAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin?redirect=/settings');
      });
    });

    it('should not redirect while auth is loading', () => {
      useAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
      });

      render(<SettingsPage />);

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show loading state while auth is loading', () => {
      useAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
      });

      render(<SettingsPage />);

      const loadingElements = document.querySelectorAll('.animate-pulse');
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Authenticated User', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    const mockProfile = {
      id: 'user-123',
      email: 'testuser@example.com',
      display_name: 'testuser',
      avatar_url: null,
      preferences: {
        emailNotifications: true,
        units: 'imperial',
      },
      is_pro: false,
      created_at: '2024-01-15T00:00:00Z',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isAuthenticated: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ profile: mockProfile }),
      });
    });

    it('should render settings page title', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should fetch and display profile data with auth header', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
          headers: { Authorization: 'Bearer test-auth-token' },
        });
      });
    });

    it('should display user email (read-only)', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const emailInput = screen.getByDisplayValue('testuser@example.com');
        expect(emailInput).toBeInTheDocument();
        expect(emailInput).toBeDisabled();
      });
    });

    it('should display display name input', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const displayNameInput = screen.getByLabelText('Display Name');
        expect(displayNameInput).toBeInTheDocument();
        expect(displayNameInput).toHaveValue('testuser');
      });
    });

    it('should display account status for free user', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Free Account')).toBeInTheDocument();
        expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
      });
    });

    it('should display account status for pro user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: { ...mockProfile, is_pro: true },
        }),
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Pro Member')).toBeInTheDocument();
        expect(screen.getByText('✨ Pro')).toBeInTheDocument();
      });
    });

    it('should display member since date', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Member Since')).toBeInTheDocument();
        // The date format may vary by locale, so just check for the year
        const dateElement = screen.getByText(/2024/);
        expect(dateElement).toBeInTheDocument();
      });
    });
  });

  describe('Profile Form', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    const mockProfile = {
      id: 'user-123',
      email: 'testuser@example.com',
      display_name: 'testuser',
      avatar_url: null,
      preferences: {
        emailNotifications: true,
        units: 'imperial',
      },
      is_pro: false,
      created_at: '2024-01-15T00:00:00Z',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isAuthenticated: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ profile: mockProfile }),
      });
    });

    it('should allow editing display name', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const displayNameInput = screen.getByLabelText('Display Name');
        fireEvent.change(displayNameInput, { target: { value: 'newname' } });
        expect(displayNameInput).toHaveValue('newname');
      });
    });

    it('should submit form and save changes', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            profile: { ...mockProfile, display_name: 'newname' },
          }),
        });

      render(<SettingsPage />);

      await waitFor(() => {
        const displayNameInput = screen.getByLabelText('Display Name');
        fireEvent.change(displayNameInput, { target: { value: 'newname' } });
      });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-auth-token',
          },
          body: expect.stringContaining('newname'),
        });
      });
    });

    it('should show success message after saving', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: mockProfile }),
        });

      render(<SettingsPage />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
      });
    });

    it('should show error message if save fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Failed to save' }),
        });

      render(<SettingsPage />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to save settings')).toBeInTheDocument();
      });
    });

    it('should show saving state on button', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: mockProfile }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({ profile: mockProfile }),
                  }),
                100
              )
            )
        );

      render(<SettingsPage />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Preferences', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    const mockProfile = {
      id: 'user-123',
      email: 'testuser@example.com',
      display_name: 'testuser',
      avatar_url: null,
      preferences: {
        emailNotifications: true,
        units: 'imperial',
      },
      is_pro: false,
      created_at: '2024-01-15T00:00:00Z',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isAuthenticated: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ profile: mockProfile }),
      });
    });

    it('should display email notifications toggle', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Email Notifications')).toBeInTheDocument();
      });
    });

    it('should display distance units selector', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Distance Units')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Imperial (miles)')).toBeInTheDocument();
      });
    });

    it('should allow changing distance units', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const unitsSelect = screen.getByDisplayValue('Imperial (miles)');
        fireEvent.change(unitsSelect, { target: { value: 'metric' } });
        expect(unitsSelect).toHaveValue('metric');
      });
    });

    it('should toggle email notifications', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeChecked();
        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  describe('Account Actions', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    const mockProfile = {
      id: 'user-123',
      email: 'testuser@example.com',
      display_name: 'testuser',
      avatar_url: null,
      preferences: {},
      is_pro: false,
      created_at: '2024-01-15T00:00:00Z',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isAuthenticated: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ profile: mockProfile }),
      });
    });

    it('should display Delete Account button', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument();
      });
    });

    it('should show confirmation dialog when clicking Delete Account', async () => {
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<SettingsPage />);

      await waitFor(() => {
        const deleteButton = screen.getByText('Delete Account');
        fireEvent.click(deleteButton);
      });

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to delete your account? This action cannot be undone.'
      );

      mockConfirm.mockRestore();
    });

    it('should display Danger Zone section', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Danger Zone')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isAuthenticated: true,
      });
    });

    it('should handle profile fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to fetch' }),
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch profile')).toBeInTheDocument();
      });
    });

    it('should handle network error during fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Upgrade Button', () => {
    const mockUser = {
      id: 'user-123',
      email: 'testuser@example.com',
    };

    const mockProfile = {
      id: 'user-123',
      email: 'testuser@example.com',
      display_name: 'testuser',
      avatar_url: null,
      preferences: {},
      is_pro: false,
      created_at: '2024-01-15T00:00:00Z',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isAuthenticated: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ profile: mockProfile }),
      });
    });

    it('should show upgrade button for free users', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
      });
    });

    it('should call checkout API when clicking upgrade button', async () => {
      // First call returns profile, second call is the checkout API
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            url: 'https://checkout.stripe.com/test',
            sessionId: 'cs_test_123',
          }),
        });

      // Mock window.location.href
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };

      render(<SettingsPage />);

      await waitFor(() => {
        const upgradeButton = screen.getByText('Upgrade to Pro');
        fireEvent.click(upgradeButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-auth-token',
          },
          body: JSON.stringify({}),
        });
      });

      // Restore window.location
      window.location = originalLocation;
    });

    it('should not show upgrade button for pro users', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: { ...mockProfile, is_pro: true },
        }),
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Upgrade to Pro')).not.toBeInTheDocument();
      });
    });
  });
});