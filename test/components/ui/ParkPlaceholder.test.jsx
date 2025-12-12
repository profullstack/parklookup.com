/**
 * Tests for ParkPlaceholder Component
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('ParkPlaceholder Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Rendering', () => {
    it('should render placeholder with park name', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkName="Central Park" />);

      expect(screen.getByText('Central Park')).toBeInTheDocument();
    });

    it('should render tree icon', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkName="Test Park" />);

      // Should have an SVG icon
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have data-testid for testing', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkName="Test Park" />);

      expect(screen.getByTestId('park-placeholder')).toBeInTheDocument();
    });
  });

  describe('Park Types', () => {
    it('should render with county park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Griffith Park" parkType="county" />
      );

      // Should have orange gradient for county parks
      expect(container.firstChild).toHaveClass('from-orange-100');
    });

    it('should render with city park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Central Park" parkType="city" />
      );

      // Should have teal gradient for city parks
      expect(container.firstChild).toHaveClass('from-teal-100');
    });

    it('should render with state park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Big Basin" parkType="state" />
      );

      // Should have purple gradient for state parks
      expect(container.firstChild).toHaveClass('from-purple-100');
    });

    it('should render with national park styling by default', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Yosemite" />
      );

      // Should have green gradient for national parks (default)
      expect(container.firstChild).toHaveClass('from-green-100');
    });
  });

  describe('Sizes', () => {
    it('should render small size', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Test Park" size="sm" />
      );

      expect(container.firstChild).toHaveClass('h-32');
    });

    it('should render medium size by default', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Test Park" />
      );

      expect(container.firstChild).toHaveClass('h-48');
    });

    it('should render large size', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Test Park" size="lg" />
      );

      expect(container.firstChild).toHaveClass('h-64');
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom className', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(
        <ParkPlaceholder parkName="Test Park" className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty park name', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkName="" />);

      expect(screen.getByTestId('park-placeholder')).toBeInTheDocument();
    });

    it('should handle very long park name', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const longName = 'This Is A Very Long Park Name That Should Be Truncated Or Wrapped Properly';
      render(<ParkPlaceholder parkName={longName} />);

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle special characters in park name', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkName="O'Brien's Park & Recreation Area" />);

      expect(screen.getByText("O'Brien's Park & Recreation Area")).toBeInTheDocument();
    });
  });
});