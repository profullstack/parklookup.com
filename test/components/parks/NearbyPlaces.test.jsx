/**
 * NearbyPlaces Component Tests
 * Tests for the nearby places display functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NearbyPlaces, { NearbyPlacesCompact } from '@/components/parks/NearbyPlaces';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock fetch
global.fetch = vi.fn();

// Mock place data
const mockPlacesData = {
  parkCode: 'yose',
  places: [
    {
      id: 'place-1',
      data_cid: '11240000532159598531',
      title: "Coppolillo's Italian Steakhouse",
      category: 'dining',
      address: 'Crown Point, IN',
      rating: 4.6,
      reviews_count: 409,
      price_level: '$$',
      thumbnail: 'https://example.com/image1.jpg',
      phone: '(219) 555-1234',
      latitude: 41.4169,
      longitude: -87.3653,
    },
    {
      id: 'place-2',
      data_cid: '22340000532159598532',
      title: 'Mountain View Lodge',
      category: 'lodging',
      address: 'Yosemite Valley, CA',
      rating: 4.8,
      reviews_count: 250,
      price_level: '$$$',
      thumbnail: 'https://example.com/image2.jpg',
      phone: null,
      latitude: 37.7456,
      longitude: -119.5936,
    },
    {
      id: 'place-3',
      data_cid: '33440000532159598533',
      title: 'Valley Bar & Grill',
      category: 'bars',
      address: 'El Portal, CA',
      rating: 4.2,
      reviews_count: 120,
      price_level: '$',
      thumbnail: null,
      phone: '(209) 555-5678',
      latitude: 37.6789,
      longitude: -119.7823,
    },
  ],
  byCategory: {
    dining: [
      {
        id: 'place-1',
        data_cid: '11240000532159598531',
        title: "Coppolillo's Italian Steakhouse",
        category: 'dining',
        address: 'Crown Point, IN',
        rating: 4.6,
        reviews_count: 409,
        price_level: '$$',
        thumbnail: 'https://example.com/image1.jpg',
        phone: '(219) 555-1234',
        latitude: 41.4169,
        longitude: -87.3653,
      },
    ],
    lodging: [
      {
        id: 'place-2',
        data_cid: '22340000532159598532',
        title: 'Mountain View Lodge',
        category: 'lodging',
        address: 'Yosemite Valley, CA',
        rating: 4.8,
        reviews_count: 250,
        price_level: '$$$',
        thumbnail: 'https://example.com/image2.jpg',
        phone: null,
        latitude: 37.7456,
        longitude: -119.5936,
      },
    ],
    bars: [
      {
        id: 'place-3',
        data_cid: '33440000532159598533',
        title: 'Valley Bar & Grill',
        category: 'bars',
        address: 'El Portal, CA',
        rating: 4.2,
        reviews_count: 120,
        price_level: '$',
        thumbnail: null,
        phone: '(209) 555-5678',
        latitude: 37.6789,
        longitude: -119.7823,
      },
    ],
  },
  total: 3,
};

const emptyPlacesData = {
  parkCode: 'test',
  places: [],
  byCategory: {},
  total: 0,
};

describe('NearbyPlaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching', async () => {
      global.fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockPlacesData,
                }),
              100
            )
          )
      );

      render(<NearbyPlaces parkCode="yose" />);

      // Should show loading skeleton
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no places found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyPlacesData,
      });

      render(<NearbyPlaces parkCode="test" />);

      await waitFor(() => {
        expect(screen.getByText(/no nearby places found/i)).toBeInTheDocument();
      });
    });

    it('should handle 404 response gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { container } = render(<NearbyPlaces parkCode="nonexistent" />);

      await waitFor(() => {
        // 404 should result in empty state - component renders empty div
        expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message on fetch failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/unable to load nearby places/i)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Places Display', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData,
      });
    });

    it('should display places grouped by category', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText("Coppolillo's Italian Steakhouse")).toBeInTheDocument();
        expect(screen.getByText('Mountain View Lodge')).toBeInTheDocument();
        expect(screen.getByText('Valley Bar & Grill')).toBeInTheDocument();
      });
    });

    it('should display category headers', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('Dining')).toBeInTheDocument();
        expect(screen.getByText('Lodging')).toBeInTheDocument();
        // Use getAllByText since "Bars & Nightlife" appears in multiple places (filter, header, badge)
        const barsElements = screen.getAllByText(/Bars & Nightlife/i);
        expect(barsElements.length).toBeGreaterThan(0);
      });
    });

    it('should display ratings and review counts', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('4.6')).toBeInTheDocument();
        expect(screen.getByText('(409)')).toBeInTheDocument();
      });
    });

    it('should display addresses', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/Crown Point, IN/)).toBeInTheDocument();
        expect(screen.getByText(/Yosemite Valley, CA/)).toBeInTheDocument();
      });
    });

    it('should display price levels', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText('$$')).toBeInTheDocument();
        expect(screen.getByText('$$$')).toBeInTheDocument();
      });
    });
  });

  describe('Category Filter', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData,
      });
    });

    it('should show category filter tabs', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
      });
    });

    it('should filter places by category when tab clicked', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText("Coppolillo's Italian Steakhouse")).toBeInTheDocument();
      });

      // Click on Dining filter
      const diningButton = screen.getByRole('button', { name: /dining/i });
      fireEvent.click(diningButton);

      // Should only show dining places
      expect(screen.getByText("Coppolillo's Italian Steakhouse")).toBeInTheDocument();
      // Other categories should not be visible as section headers
      expect(screen.queryByText('Lodging')).not.toBeInTheDocument();
    });

    it('should show all places when All tab clicked', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText("Coppolillo's Italian Steakhouse")).toBeInTheDocument();
      });

      // Click on Dining filter first
      const diningButton = screen.getByRole('button', { name: /dining/i });
      fireEvent.click(diningButton);

      // Then click All
      const allButton = screen.getByRole('button', { name: /all/i });
      fireEvent.click(allButton);

      // Should show all categories
      await waitFor(() => {
        expect(screen.getByText('Dining')).toBeInTheDocument();
        expect(screen.getByText('Lodging')).toBeInTheDocument();
      });
    });
  });

  describe('Place Links', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData,
      });
    });

    it('should link to place detail page', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        const links = document.querySelectorAll('a[href*="/places/"]');
        expect(links.length).toBeGreaterThan(0);
      });
    });

    it('should have View Details button linking to place page', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        const viewDetailsLinks = screen.getAllByText('View Details');
        expect(viewDetailsLinks.length).toBeGreaterThan(0);
      });
    });

    it('should have directions link for places with coordinates', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        // The component uses "🗺️ Directions" text
        const directionsLinks = screen.getAllByText(/Directions/);
        expect(directionsLinks.length).toBeGreaterThan(0);
      });
    });

    it('should have call button for places with phone', async () => {
      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        // The component uses "📞 Call" text
        const callLinks = screen.getAllByText(/Call/);
        expect(callLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('API Call', () => {
    it('should call API with correct park code', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData,
      });

      render(<NearbyPlaces parkCode="yose" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/yose/nearby-places');
      });
    });

    it('should not call API if parkCode is missing', async () => {
      render(<NearbyPlaces parkCode="" />);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});

describe('NearbyPlacesCompact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching', async () => {
      global.fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockPlacesData,
                }),
              100
            )
          )
      );

      render(<NearbyPlacesCompact parkCode="yose" />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render nothing when no places found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyPlacesData,
      });

      const { container } = render(<NearbyPlacesCompact parkCode="test" />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('Places Display', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData,
      });
    });

    it('should display places in compact format', async () => {
      render(<NearbyPlacesCompact parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText("Coppolillo's Italian Steakhouse")).toBeInTheDocument();
      });
    });

    it('should display ratings', async () => {
      render(<NearbyPlacesCompact parkCode="yose" />);

      await waitFor(() => {
        expect(screen.getByText(/★ 4.6/)).toBeInTheDocument();
      });
    });

    it('should link to place detail pages', async () => {
      render(<NearbyPlacesCompact parkCode="yose" />);

      await waitFor(() => {
        const links = document.querySelectorAll('a[href*="/places/"]');
        expect(links.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Limit Parameter', () => {
    it('should pass limit parameter to API', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData,
      });

      render(<NearbyPlacesCompact parkCode="yose" limit={3} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/yose/nearby-places?limit=3');
      });
    });

    it('should use default limit of 5', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData,
      });

      render(<NearbyPlacesCompact parkCode="yose" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/yose/nearby-places?limit=5');
      });
    });
  });
});