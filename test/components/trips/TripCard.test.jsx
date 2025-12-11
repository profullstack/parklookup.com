/**
 * TripCard Component Tests
 * Tests for the trip summary card
 * 
 * Testing Framework: Vitest with React Testing Library
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TripCard from '@/components/trips/TripCard';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

describe('TripCard Component', () => {
  // TripCard expects camelCase props: startDate, endDate, parkCount, dayCount, summary, createdAt
  const mockTrip = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'California Adventure',
    origin: 'San Francisco, CA',
    startDate: '2025-01-15',
    endDate: '2025-01-18',
    parkCount: 4,
    dayCount: 4,
    summary: 'A 4-day trip through California parks',
    createdAt: '2025-01-10T10:00:00Z',
  };

  describe('Rendering', () => {
    it('should render trip title', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText('California Adventure')).toBeInTheDocument();
    });

    it('should render trip dates', () => {
      render(<TripCard trip={mockTrip} />);
      // Dates appear in the date range display
      const dateElements = screen.getAllByText(/jan/i);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it('should render origin location', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText(/san francisco/i)).toBeInTheDocument();
    });

    it('should render park count', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText(/4 parks/i)).toBeInTheDocument();
    });

    it('should render day count', () => {
      render(<TripCard trip={mockTrip} />);
      // Day count appears in both duration and dayCount display
      const dayElements = screen.getAllByText(/4 day/i);
      expect(dayElements.length).toBeGreaterThan(0);
    });

    it('should link to trip detail page', () => {
      render(<TripCard trip={mockTrip} />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/trip/123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('Summary Display', () => {
    it('should show overall summary if available', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText(/4-day trip through California/i)).toBeInTheDocument();
    });

    it('should handle missing summary gracefully', () => {
      const tripWithoutSummary = {
        ...mockTrip,
        summary: null,
      };
      render(<TripCard trip={tripWithoutSummary} />);
      expect(screen.getByText('California Adventure')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      render(<TripCard trip={mockTrip} />);
      // Should show formatted dates - multiple elements may contain "jan"
      const dateElements = screen.getAllByText(/jan/i);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it('should handle same-day trips', () => {
      const sameDayTrip = {
        ...mockTrip,
        startDate: '2025-01-15',
        endDate: '2025-01-15',
      };
      render(<TripCard trip={sameDayTrip} />);
      expect(screen.getByText(/1 day/i)).toBeInTheDocument();
    });
  });

  describe('Park Count', () => {
    it('should show singular "park" for 1 park', () => {
      const singleParkTrip = {
        ...mockTrip,
        parkCount: 1,
      };
      render(<TripCard trip={singleParkTrip} />);
      expect(screen.getByText(/1 park(?!s)/i)).toBeInTheDocument();
    });

    it('should show plural "parks" for multiple parks', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText(/4 parks/i)).toBeInTheDocument();
    });

    it('should not show park count when zero', () => {
      const emptyTrip = {
        ...mockTrip,
        parkCount: 0,
      };
      render(<TripCard trip={emptyTrip} />);
      // Component doesn't render park count when parkCount is 0 (see line 162-169)
      expect(screen.queryByText(/0 parks/i)).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should render as a link', () => {
      render(<TripCard trip={mockTrip} />);
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });

    it('should have correct href', () => {
      render(<TripCard trip={mockTrip} />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', `/trip/${mockTrip.id}`);
    });
  });
});

describe('TripCard Edge Cases', () => {
  it('should handle missing optional fields', () => {
    const tripWithoutOptional = {
      id: '123',
      title: 'Test Trip',
      origin: 'Test',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
    };
    render(<TripCard trip={tripWithoutOptional} />);
    expect(screen.getByText('Test Trip')).toBeInTheDocument();
  });

  it('should handle very long titles', () => {
    const longTitleTrip = {
      id: '123',
      title: 'This is a very long trip title that should be truncated or handled gracefully',
      origin: 'Test',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
    };
    render(<TripCard trip={longTitleTrip} />);
    expect(screen.getByText(/very long trip title/i)).toBeInTheDocument();
  });
});