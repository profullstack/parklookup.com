/**
 * TripPlannerPromo Component Tests
 * Tests for the Trip Planner promotional section
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TripPlannerPromo from '@/components/trips/TripPlannerPromo';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

describe('TripPlannerPromo', () => {
  describe('Rendering', () => {
    it('should render the main heading', () => {
      render(<TripPlannerPromo />);

      expect(
        screen.getByRole('heading', { name: /plan your perfect park adventure with ai/i })
      ).toBeInTheDocument();
    });

    it('should render the AI-Powered badge', () => {
      render(<TripPlannerPromo />);

      expect(screen.getByText('AI-Powered')).toBeInTheDocument();
    });

    it('should render the feature description', () => {
      render(<TripPlannerPromo />);

      expect(
        screen.getByText(/our ai trip planner creates personalized multi-day itineraries/i)
      ).toBeInTheDocument();
    });

    it('should render all feature bullet points', () => {
      render(<TripPlannerPromo />);

      expect(
        screen.getByText(/personalized itineraries based on your interests/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/day-by-day plans with morning, afternoon, and evening activities/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/driving routes and estimated travel times/i)).toBeInTheDocument();
      expect(screen.getByText(/must-see highlights and hidden gems/i)).toBeInTheDocument();
    });
  });

  describe('Example Trip Preview', () => {
    it('should render the example trip heading', () => {
      render(<TripPlannerPromo />);

      expect(screen.getByText(/example: 3-day yellowstone adventure/i)).toBeInTheDocument();
    });

    it('should render all three days of the example trip', () => {
      render(<TripPlannerPromo />);

      expect(screen.getByText(/day 1:/i)).toBeInTheDocument();
      expect(screen.getByText(/old faithful/i)).toBeInTheDocument();
      expect(screen.getByText(/day 2:/i)).toBeInTheDocument();
      expect(screen.getByText(/grand canyon of yellowstone/i)).toBeInTheDocument();
      expect(screen.getByText(/day 3:/i)).toBeInTheDocument();
      expect(screen.getByText(/mammoth hot springs/i)).toBeInTheDocument();
    });
  });

  describe('Pricing Tiers', () => {
    describe('Free Tier', () => {
      it('should render the Free tier heading', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByRole('heading', { name: /free/i })).toBeInTheDocument();
      });

      it('should render the Free tier price', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByText('$0')).toBeInTheDocument();
        expect(screen.getByText('/forever')).toBeInTheDocument();
      });

      it('should render Free tier features', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByText(/1 ai-generated trip/i)).toBeInTheDocument();
        expect(screen.getByText(/browse all parks/i)).toBeInTheDocument();
        expect(screen.getByText(/save favorites/i)).toBeInTheDocument();
      });

      it('should render Sign Up Free button with correct link', () => {
        render(<TripPlannerPromo />);

        const signUpButton = screen.getByRole('link', { name: /sign up free/i });
        expect(signUpButton).toBeInTheDocument();
        expect(signUpButton).toHaveAttribute('href', '/signup');
      });
    });

    describe('Pro Tier', () => {
      it('should render the Pro tier heading', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByRole('heading', { name: /pro/i })).toBeInTheDocument();
      });

      it('should render the Pro tier price', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByText('$9.99')).toBeInTheDocument();
        expect(screen.getByText('/month')).toBeInTheDocument();
      });

      it('should render the BEST VALUE badge', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByText('BEST VALUE')).toBeInTheDocument();
      });

      it('should render the Most Popular badge', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByText('Most Popular')).toBeInTheDocument();
      });

      it('should render Pro tier features', () => {
        render(<TripPlannerPromo />);

        expect(screen.getByText(/unlimited ai trips/i)).toBeInTheDocument();
        expect(screen.getByText(/priority ai processing/i)).toBeInTheDocument();
        expect(screen.getByText(/export trips to pdf/i)).toBeInTheDocument();
        expect(screen.getByText(/early access to new features/i)).toBeInTheDocument();
        expect(screen.getByText(/support development/i)).toBeInTheDocument();
      });

      it('should render Upgrade to Pro button with correct link', () => {
        render(<TripPlannerPromo />);

        const upgradeButton = screen.getByRole('link', { name: /upgrade to pro/i });
        expect(upgradeButton).toBeInTheDocument();
        expect(upgradeButton).toHaveAttribute('href', '/payments');
      });
    });
  });

  describe('Call to Action', () => {
    it('should render the Create Your First Trip button', () => {
      render(<TripPlannerPromo />);

      const ctaButton = screen.getByRole('link', { name: /create your first trip/i });
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveAttribute('href', '/trip/new');
    });

    it('should render the no credit card required text', () => {
      render(<TripPlannerPromo />);

      expect(screen.getByText(/no credit card required for free tier/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<TripPlannerPromo />);

      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2).toBeInTheDocument();

      const h3s = screen.getAllByRole('heading', { level: 3 });
      expect(h3s.length).toBeGreaterThanOrEqual(2); // Free and Pro headings
    });

    it('should have accessible links', () => {
      render(<TripPlannerPromo />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    });
  });
});