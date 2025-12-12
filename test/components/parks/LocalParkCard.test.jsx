/**
 * Tests for LocalParkCard Component
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('LocalParkCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const mockCountyPark = {
    id: '1',
    name: 'Griffith Park',
    slug: 'griffith-park',
    park_type: 'county',
    managing_agency: 'LA County Parks',
    county: 'Los Angeles',
    state: 'CA',
    latitude: 34.1341,
    longitude: -118.2944,
    access: 'Open',
    photos: [
      {
        thumb_url: 'https://example.com/thumb.jpg',
        image_url: 'https://example.com/image.jpg',
      },
    ],
  };

  const mockCityPark = {
    id: '2',
    name: 'Central Park',
    slug: 'central-park',
    park_type: 'city',
    managing_agency: 'NYC Parks Department',
    county: 'New York',
    city: 'New York',
    state: 'NY',
    latitude: 40.7829,
    longitude: -73.9654,
    access: 'Open',
    photos: [],
  };

  describe('Rendering', () => {
    it('should render park name', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCountyPark} />);

      expect(screen.getByText('Griffith Park')).toBeInTheDocument();
    });

    it('should render county park badge', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCountyPark} />);

      expect(screen.getByText('County Park')).toBeInTheDocument();
    });

    it('should render city park badge', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCityPark} />);

      expect(screen.getByText('City Park')).toBeInTheDocument();
    });

    it('should render managing agency', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCountyPark} />);

      expect(screen.getByText('LA County Parks')).toBeInTheDocument();
    });

    it('should render location (county, state)', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCountyPark} />);

      expect(screen.getByText(/Los Angeles/)).toBeInTheDocument();
      expect(screen.getByText(/CA/)).toBeInTheDocument();
    });

    it('should render access status', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCountyPark} />);

      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('should render photo when available', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCountyPark} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', expect.stringContaining('thumb.jpg'));
    });

    it('should render placeholder when no photo available', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCityPark} />);

      // Should render ParkPlaceholder component
      expect(screen.getByTestId('park-placeholder')).toBeInTheDocument();
    });
  });

  describe('Links', () => {
    it('should link to county park detail page', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCountyPark} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        '/parks/county/ca/los-angeles/griffith-park'
      );
    });

    it('should link to city park detail page', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      render(<LocalParkCard park={mockCityPark} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        '/parks/city/ny/new-york/central-park'
      );
    });
  });

  describe('Styling', () => {
    it('should apply orange color for county parks', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      const { container } = render(<LocalParkCard park={mockCountyPark} />);

      const badge = screen.getByText('County Park');
      expect(badge).toHaveClass('bg-orange-100');
    });

    it('should apply teal color for city parks', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      const { container } = render(<LocalParkCard park={mockCityPark} />);

      const badge = screen.getByText('City Park');
      expect(badge).toHaveClass('bg-teal-100');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing managing_agency', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      const parkWithoutAgency = { ...mockCountyPark, managing_agency: null };
      render(<LocalParkCard park={parkWithoutAgency} />);

      expect(screen.getByText('Griffith Park')).toBeInTheDocument();
    });

    it('should handle missing county', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      const parkWithoutCounty = { ...mockCountyPark, county: null };
      render(<LocalParkCard park={parkWithoutCounty} />);

      expect(screen.getByText('Griffith Park')).toBeInTheDocument();
    });

    it('should handle restricted access', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      const restrictedPark = { ...mockCountyPark, access: 'Restricted' };
      render(<LocalParkCard park={restrictedPark} />);

      expect(screen.getByText('Restricted')).toBeInTheDocument();
    });

    it('should handle unknown access', async () => {
      const LocalParkCard = (await import('@/components/parks/LocalParkCard')).default;
      
      const unknownAccessPark = { ...mockCountyPark, access: 'Unknown' };
      render(<LocalParkCard park={unknownAccessPark} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});