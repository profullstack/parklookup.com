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
  const mockTrip = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'California Adventure',
    origin: 'San Francisco, CA',
    start_date: '2025-01-15',
    end_date: '2025-01-18',
    ai_summary: {
      overall_summary: 'A 4-day trip through California parks',
      daily_schedule: [
        { day: 1, park_name: 'Yosemite National Park' },
        { day: 2, park_name: 'Sequoia National Park' },
        { day: 3, park_name: 'Kings Canyon National Park' },
        { day: 4, park_name: 'Death Valley National Park' },
      ],
    },
    created_at: '2025-01-10T10:00:00Z',
  };

  describe('Rendering', () => {
    it('should render trip title', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText('California Adventure')).toBeInTheDocument();
    });

    it('should render trip dates', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText(/jan 15/i)).toBeInTheDocument();
      expect(screen.getByText(/jan 18/i)).toBeInTheDocument();
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
      expect(screen.getByText(/4 days/i)).toBeInTheDocument();
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
        ai_summary: { daily_schedule: [] },
      };
      render(<TripCard trip={tripWithoutSummary} />);
      expect(screen.getByText('California Adventure')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      render(<TripCard trip={mockTrip} />);
      // Should show formatted dates
      const dateText = screen.getByText(/jan/i);
      expect(dateText).toBeInTheDocument();
    });

    it('should handle same-day trips', () => {
      const sameDayTrip = {
        ...mockTrip,
        start_date: '2025-01-15',
        end_date: '2025-01-15',
      };
      render(<TripCard trip={sameDayTrip} />);
      expect(screen.getByText(/1 day/i)).toBeInTheDocument();
    });
  });

  describe('Park Count', () => {
    it('should show singular "park" for 1 park', () => {
      const singleParkTrip = {
        ...mockTrip,
        ai_summary: {
          daily_schedule: [{ day: 1, park_name: 'Yosemite' }],
        },
      };
      render(<TripCard trip={singleParkTrip} />);
      expect(screen.getByText(/1 park/i)).toBeInTheDocument();
    });

    it('should show plural "parks" for multiple parks', () => {
      render(<TripCard trip={mockTrip} />);
      expect(screen.getByText(/4 parks/i)).toBeInTheDocument();
    });

    it('should handle empty schedule', () => {
      const emptyTrip = {
        ...mockTrip,
        ai_summary: { daily_schedule: [] },
      };
      render(<TripCard trip={emptyTrip} />);
      expect(screen.getByText(/0 parks/i)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have card styling', () => {
      const { container } = render(<TripCard trip={mockTrip} />);
      expect(container.firstChild).toHaveClass('rounded');
    });

    it('should have hover effect', () => {
      const { container } = render(<TripCard trip={mockTrip} />);
      expect(container.firstChild).toHaveClass('hover:shadow-lg');
    });
  });
});

describe('TripCard Edge Cases', () => {
  it('should handle missing ai_summary', () => {
    const tripWithoutAI = {
      id: '123',
      title: 'Test Trip',
      origin: 'Test',
      start_date: '2025-01-15',
      end_date: '2025-01-16',
    };
    render(<TripCard trip={tripWithoutAI} />);
    expect(screen.getByText('Test Trip')).toBeInTheDocument();
  });

  it('should handle very long titles', () => {
    const longTitleTrip = {
      id: '123',
      title: 'This is a very long trip title that should be truncated or handled gracefully',
      origin: 'Test',
      start_date: '2025-01-15',
      end_date: '2025-01-16',
      ai_summary: { daily_schedule: [] },
    };
    render(<TripCard trip={longTitleTrip} />);
    expect(screen.getByText(/very long trip title/i)).toBeInTheDocument();
  });
});