/**
 * Tests for Providers component
 * Verifies that the client-side providers wrapper renders correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the dependencies
vi.mock('@/hooks/useAuth', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
}));

vi.mock('@/components/layout/Header', () => ({
  default: () => <header data-testid="header">Header</header>,
}));

vi.mock('@/components/ui/OfflineBanner', () => ({
  OfflineBanner: () => <div data-testid="offline-banner">OfflineBanner</div>,
}));

vi.mock('@/components/ui/InstallPrompt', () => ({
  InstallPrompt: () => <div data-testid="install-prompt">InstallPrompt</div>,
}));

// Import after mocks
import { Providers } from '@/components/Providers';

describe('Providers component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children within AuthProvider', () => {
    render(
      <Providers>
        <div data-testid="child-content">Test Content</div>
      </Providers>
    );

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render Header component', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('should render OfflineBanner component', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>
    );

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });

  it('should render InstallPrompt component', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>
    );

    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();
  });

  it('should wrap children in main element with flex-1 class', () => {
    render(
      <Providers>
        <div data-testid="child">Child</div>
      </Providers>
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass('flex-1');
    expect(main).toContainElement(screen.getByTestId('child'));
  });

  it('should have proper layout structure', () => {
    const { container } = render(
      <Providers>
        <div>Content</div>
      </Providers>
    );

    // Check for the flex container
    const flexContainer = container.querySelector('.relative.flex.min-h-screen.flex-col');
    expect(flexContainer).toBeInTheDocument();
  });
});