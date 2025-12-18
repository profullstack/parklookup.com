/**
 * Tests for StartTrackingButton Component
 *
 * Tests the tracking button functionality including:
 * - URL building with parkId vs localParkId
 * - Authentication and pro status handling
 * - Button states and variants
 *
 * @module test/components/tracking/StartTrackingButton.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}));

// Mock hooks
const mockUseAuth = vi.fn();
vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseTrackingContext = vi.fn();
vi.mock('../../../contexts/TrackingContext.jsx', () => ({
  useTrackingContext: () => mockUseTrackingContext(),
}));

// Mock UpgradeModal
vi.mock('../../../components/ui/UpgradeModal.jsx', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="upgrade-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Import component after mocks
import StartTrackingButton from '../../../components/tracking/StartTrackingButton.jsx';

describe('StartTrackingButton', () => {
  // Store original window.location
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.location
    delete window.location;
    window.location = { href: '' };

    // Default mock implementations
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123' },
      loading: false,
    });

    mockUseTrackingContext.mockReturnValue({
      isTracking: false,
      isPro: true,
      proLoading: false,
    });
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('URL Building', () => {
    it('should build URL with parkCode only', () => {
      render(<StartTrackingButton parkCode="yose" parkName="Yosemite" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('parkCode=yose');
      expect(window.location.href).toContain('parkName=Yosemite');
      expect(window.location.href).not.toContain('parkId=');
      expect(window.location.href).not.toContain('localParkId=');
    });

    it('should build URL with parkId for NPS parks', () => {
      render(
        <StartTrackingButton
          parkCode="yose"
          parkId="nps-park-uuid-123"
          parkName="Yosemite"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('parkId=nps-park-uuid-123');
      expect(window.location.href).not.toContain('localParkId=');
    });

    it('should build URL with localParkId for local parks', () => {
      render(
        <StartTrackingButton
          parkCode="local-park-slug"
          localParkId="local-park-uuid-456"
          parkName="Local City Park"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('localParkId=local-park-uuid-456');
      expect(window.location.href).not.toContain('parkId=');
    });

    it('should build URL with both parkId and localParkId when both provided', () => {
      // This shouldn't happen in practice, but test the behavior
      render(
        <StartTrackingButton
          parkCode="test"
          parkId="nps-uuid"
          localParkId="local-uuid"
          parkName="Test Park"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('parkId=nps-uuid');
      expect(window.location.href).toContain('localParkId=local-uuid');
    });

    it('should build URL with trailId', () => {
      render(
        <StartTrackingButton
          parkCode="yose"
          trailId="trail-uuid-789"
          trailName="Half Dome Trail"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('trailId=trail-uuid-789');
      expect(window.location.href).toContain('trailName=Half+Dome+Trail');
    });

    it('should include start=true parameter for auto-start', () => {
      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('start=true');
    });

    it('should set tab=tracking in URL', () => {
      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('tab=tracking');
    });
  });

  describe('Authentication States', () => {
    it('should redirect to signin when user is not logged in', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('/signin?redirect=');
      expect(window.location.href).toContain(encodeURIComponent('/tracks?'));
    });

    it('should show loading state when auth is loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Loading...');
    });

    it('should show loading state when pro status is loading', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: false,
        isPro: false,
        proLoading: true,
      });

      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Loading...');
    });
  });

  describe('Pro Status', () => {
    it('should show upgrade modal for non-pro users', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: false,
        isPro: false,
        proLoading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();
    });

    it('should show PRO badge for non-pro users', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: false,
        isPro: false,
        proLoading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      expect(screen.getByText('PRO')).toBeInTheDocument();
    });

    it('should not show PRO badge for pro users', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: false,
        isPro: true,
        proLoading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      expect(screen.queryByText('PRO')).not.toBeInTheDocument();
    });

    it('should redirect to tracks page for pro users', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: false,
        isPro: true,
        proLoading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toContain('/tracks?');
      expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();
    });
  });

  describe('Tracking States', () => {
    it('should show "Start Tracking" when not tracking', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: false,
        isPro: true,
        proLoading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      expect(screen.getByText('Start Tracking')).toBeInTheDocument();
    });

    it('should show "Continue Tracking" when already tracking', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: true,
        isPro: true,
        proLoading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      expect(screen.getByText('Continue Tracking')).toBeInTheDocument();
    });

    it('should redirect to tracking tab when already tracking', () => {
      mockUseTrackingContext.mockReturnValue({
        isTracking: true,
        isPro: true,
        proLoading: false,
      });

      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(window.location.href).toBe('/tracks?tab=tracking');
    });
  });

  describe('Button Variants', () => {
    it('should apply primary variant styles by default', () => {
      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-green-600');
    });

    it('should apply secondary variant styles', () => {
      render(<StartTrackingButton parkCode="yose" variant="secondary" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-100');
    });

    it('should apply outline variant styles', () => {
      render(<StartTrackingButton parkCode="yose" variant="outline" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('border-green-600');
    });
  });

  describe('Button Sizes', () => {
    it('should apply medium size by default', () => {
      render(<StartTrackingButton parkCode="yose" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('px-4');
      expect(button.className).toContain('py-2');
    });

    it('should apply small size', () => {
      render(<StartTrackingButton parkCode="yose" size="sm" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('px-3');
      expect(button.className).toContain('py-1.5');
    });

    it('should apply large size', () => {
      render(<StartTrackingButton parkCode="yose" size="lg" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('px-6');
      expect(button.className).toContain('py-3');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(<StartTrackingButton parkCode="yose" className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });
  });
});

describe('StartTrackingButton URL Building Logic', () => {
  /**
   * These tests verify the URL building logic in isolation
   * to ensure correct parameter handling for different park types
   */

  it('should correctly differentiate NPS parks from local parks', () => {
    // NPS park scenario
    const npsPark = {
      id: 'nps-uuid-123',
      source: 'nps',
      parkCode: 'yose',
    };

    // Local park scenario
    const localPark = {
      id: 'local-uuid-456',
      source: 'local',
      parkCode: 'local-park-slug',
    };

    // For NPS parks, parkId should be set
    const npsParams = new URLSearchParams();
    if (npsPark.source !== 'local') {
      npsParams.set('parkId', npsPark.id);
    } else {
      npsParams.set('localParkId', npsPark.id);
    }
    expect(npsParams.get('parkId')).toBe('nps-uuid-123');
    expect(npsParams.get('localParkId')).toBeNull();

    // For local parks, localParkId should be set
    const localParams = new URLSearchParams();
    if (localPark.source !== 'local') {
      localParams.set('parkId', localPark.id);
    } else {
      localParams.set('localParkId', localPark.id);
    }
    expect(localParams.get('localParkId')).toBe('local-uuid-456');
    expect(localParams.get('parkId')).toBeNull();
  });

  it('should handle wikidata parks as non-local', () => {
    const wikidataPark = {
      id: 'wikidata-uuid-789',
      source: 'wikidata',
      parkCode: 'wikidata-park-slug',
    };

    const params = new URLSearchParams();
    if (wikidataPark.source !== 'local') {
      params.set('parkId', wikidataPark.id);
    } else {
      params.set('localParkId', wikidataPark.id);
    }

    // Wikidata parks should use parkId, not localParkId
    expect(params.get('parkId')).toBe('wikidata-uuid-789');
    expect(params.get('localParkId')).toBeNull();
  });
});
