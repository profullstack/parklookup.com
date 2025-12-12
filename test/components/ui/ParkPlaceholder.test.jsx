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
    it('should render placeholder with data-testid', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder />);

      expect(screen.getByTestId('park-placeholder')).toBeInTheDocument();
    });

    it('should render an SVG icon', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder />);

      // Should have an SVG icon
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have absolute positioning by default', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder />);

      expect(container.firstChild).toHaveClass('absolute');
      expect(container.firstChild).toHaveClass('inset-0');
    });
  });

  describe('Park Types', () => {
    it('should render with county park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder parkType="county" />);

      // Should have blue background for county parks
      expect(container.firstChild).toHaveClass('bg-blue-50');
    });

    it('should render with city park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder parkType="city" />);

      // Should have purple background for city parks
      expect(container.firstChild).toHaveClass('bg-purple-50');
    });

    it('should render with state park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder parkType="state" />);

      // Should have amber background for state parks
      expect(container.firstChild).toHaveClass('bg-amber-50');
    });

    it('should render with national park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder parkType="national" />);

      // Should have green background for national parks
      expect(container.firstChild).toHaveClass('bg-green-50');
    });

    it('should render with regional park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder parkType="regional" />);

      // Should have teal background for regional parks
      expect(container.firstChild).toHaveClass('bg-teal-50');
    });

    it('should render with municipal park styling', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder parkType="municipal" />);

      // Should have indigo background for municipal parks
      expect(container.firstChild).toHaveClass('bg-indigo-50');
    });

    it('should render with default styling for unknown park type', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder parkType="unknown" />);

      // Should have gray background for unknown park types
      expect(container.firstChild).toHaveClass('bg-gray-50');
    });

    it('should render with default styling when no parkType provided', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder />);

      // Should have gray background by default
      expect(container.firstChild).toHaveClass('bg-gray-50');
    });
  });

  describe('Sizes', () => {
    it('should render small size', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder size="sm" />);

      const svg = document.querySelector('svg');
      expect(svg).toHaveClass('w-8');
      expect(svg).toHaveClass('h-8');
    });

    it('should render medium size', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder size="md" />);

      const svg = document.querySelector('svg');
      expect(svg).toHaveClass('w-12');
      expect(svg).toHaveClass('h-12');
    });

    it('should render large size', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder size="lg" />);

      const svg = document.querySelector('svg');
      expect(svg).toHaveClass('w-16');
      expect(svg).toHaveClass('h-16');
    });

    it('should render full size by default', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder />);

      const svg = document.querySelector('svg');
      expect(svg).toHaveClass('w-1/3');
      expect(svg).toHaveClass('h-1/3');
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom className', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      const { container } = render(<ParkPlaceholder className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('ParkPlaceholderInline', () => {
    it('should render inline placeholder', async () => {
      const { ParkPlaceholderInline } = await import('@/components/ui/ParkPlaceholder');
      
      const { container } = render(<ParkPlaceholderInline />);

      // Should have relative positioning (not absolute)
      expect(container.firstChild).toHaveClass('relative');
      expect(container.firstChild).not.toHaveClass('absolute');
    });

    it('should have default aspect ratio', async () => {
      const { ParkPlaceholderInline } = await import('@/components/ui/ParkPlaceholder');
      
      const { container } = render(<ParkPlaceholderInline />);

      expect(container.firstChild).toHaveClass('aspect-[4/3]');
    });

    it('should accept custom aspect ratio', async () => {
      const { ParkPlaceholderInline } = await import('@/components/ui/ParkPlaceholder');
      
      const { container } = render(<ParkPlaceholderInline aspectRatio="aspect-video" />);

      expect(container.firstChild).toHaveClass('aspect-video');
    });

    it('should render with park type styling', async () => {
      const { ParkPlaceholderInline } = await import('@/components/ui/ParkPlaceholder');
      
      const { container } = render(<ParkPlaceholderInline parkType="county" />);

      expect(container.firstChild).toHaveClass('bg-blue-50');
    });

    it('should have rounded corners', async () => {
      const { ParkPlaceholderInline } = await import('@/components/ui/ParkPlaceholder');
      
      const { container } = render(<ParkPlaceholderInline />);

      expect(container.firstChild).toHaveClass('rounded-lg');
    });
  });

  describe('Icon Selection', () => {
    it('should render tree icon for county parks', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkType="county" />);

      // Tree icon has a specific path
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      const path = svg.querySelector('path');
      expect(path).toHaveAttribute('d', expect.stringContaining('L12 2'));
    });

    it('should render bench icon for city parks', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkType="city" />);

      // Bench icon has rect elements
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      const rect = svg.querySelector('rect');
      expect(rect).toBeInTheDocument();
    });

    it('should render mountain icon for national parks', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder parkType="national" />);

      // Mountain icon has a specific path
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      const path = svg.querySelector('path');
      expect(path).toHaveAttribute('d', expect.stringContaining('L12 4'));
    });

    it('should render landscape icon for default/unknown parks', async () => {
      const ParkPlaceholder = (await import('@/components/ui/ParkPlaceholder')).default;
      
      render(<ParkPlaceholder />);

      // Landscape icon has a circle element
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      const circle = svg.querySelector('circle');
      expect(circle).toBeInTheDocument();
    });
  });
});