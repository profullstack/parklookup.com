/**
 * PopularParks Component Tests
 * Tests for the Popular Parks section on the homepage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PopularParks from '@/components/parks/PopularParks';

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

// Sample park data for testing - parks with images
const mockParksWithImages = [
  {
    id: 'park-1',
    park_code: 'yell',
    full_name: 'Yellowstone National Park',
    description: 'Yellowstone National Park is a nearly 3,500-sq.-mile wilderness recreation area.',
    states: 'WY,MT,ID',
    images: [{ url: 'https://example.com/yellowstone.jpg', title: 'Yellowstone' }],
  },
  {
    id: 'park-2',
    park_code: 'grca',
    full_name: 'Grand Canyon National Park',
    description: 'Grand Canyon National Park is a stunning natural wonder.',
    states: 'AZ',
    images: [{ url: 'https://example.com/grandcanyon.jpg', title: 'Grand Canyon' }],
  },
  {
    id: 'park-3',
    park_code: 'yose',
    full_name: 'Yosemite National Park',
    description: 'Yosemite National Park is known for its waterfalls and granite cliffs.',
    states: 'CA',
    images: [{ url: 'https://example.com/yosemite.jpg', title: 'Yosemite' }],
  },
  {
    id: 'park-4',
    park_code: 'zion',
    full_name: 'Zion National Park',
    description: 'Zion National Park features stunning red cliffs and canyons.',
    states: 'UT',
    images: [{ url: 'https://example.com/zion.jpg', title: 'Zion' }],
  },
];

// Parks without images (should be filtered out)
const mockParksWithoutImages = [
  {
    id: 'park-5',
    park_code: 'noimg1',
    full_name: 'Park Without Image 1',
    description: 'This park has no image.',
    states: 'TX',
    images: null,
  },
  {
    id: 'park-6',
    park_code: 'noimg2',
    full_name: 'Park Without Image 2',
    description: 'This park also has no image.',
    states: 'FL',
    images: [],
  },
];

// Park with wikidata_image (should be included)
const mockParkWithWikidataImage = {
  id: 'park-7',
  park_code: 'wiki1',
  full_name: 'Park With Wikidata Image',
  description: 'This park has a wikidata image.',
  states: 'OR',
  images: null,
  wikidata_image: 'https://example.com/wikidata-image.jpg',
};

// Combined mock data for API response
const mockAllParks = [
  ...mockParksWithImages,
  ...mockParksWithoutImages,
  mockParkWithWikidataImage,
];

describe('PopularParks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching parks', () => {
      // Mock fetch to never resolve
      global.fetch.mockImplementation(() => new Promise(() => {}));

      render(<PopularParks />);

      // Should show loading skeletons
      expect(screen.getByText('Popular Parks')).toBeInTheDocument();
      expect(
        screen.getByText("Discover America's most visited national parks")
      ).toBeInTheDocument();

      // Should have skeleton elements (animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Successful Data Fetch', () => {
    beforeEach(() => {
      // Mock successful fetch from search API with mixed parks (some with images, some without)
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: mockAllParks }),
      });
    });

    it('should render the section heading', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /popular parks/i })).toBeInTheDocument();
      });
    });

    it('should render the section description', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        expect(
          screen.getByText(/discover america's most visited national parks/i)
        ).toBeInTheDocument();
      });
    });

    it('should render park cards after loading', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        expect(screen.getByText('Yellowstone National Park')).toBeInTheDocument();
        expect(screen.getByText('Grand Canyon National Park')).toBeInTheDocument();
        expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
      });
    });

    it('should render park images', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });
    });

    it('should render park states', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        // Check that at least one state is rendered
        const stateElements = screen.getAllByText(/WY|AZ|CA|UT/);
        expect(stateElements.length).toBeGreaterThan(0);
      });
    });

    it('should render park descriptions', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        // Check that at least one description is rendered
        const descriptions = screen.getAllByText(/national park/i);
        expect(descriptions.length).toBeGreaterThan(0);
      });
    });

    it('should render Explore Park links for each park', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        const exploreLinks = screen.getAllByText('Explore Park');
        expect(exploreLinks.length).toBeGreaterThan(0);
      });
    });

    it('should render View All Parks button', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        const viewAllButton = screen.getByRole('link', { name: /view all parks/i });
        expect(viewAllButton).toBeInTheDocument();
        expect(viewAllButton).toHaveAttribute('href', '/parks');
      });
    });

    it('should link park cards to correct park pages', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        const parkLinks = document.querySelectorAll('a[href^="/parks/"]');
        expect(parkLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should not render section when fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<PopularParks />);

      await waitFor(() => {
        // Section should not be visible after error
        const section = document.querySelector('section');
        expect(section).toBeNull();
      });

      consoleSpy.mockRestore();
    });

    it('should not render section when API returns error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<PopularParks />);

      await waitFor(() => {
        const section = document.querySelector('section');
        expect(section).toBeNull();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Empty State', () => {
    it('should not render section when no parks are returned', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: [] }),
      });

      render(<PopularParks />);

      await waitFor(() => {
        const section = document.querySelector('section');
        expect(section).toBeNull();
      });
    });

    it('should not render section when no parks have images', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: mockParksWithoutImages }),
      });

      render(<PopularParks />);

      await waitFor(() => {
        const section = document.querySelector('section');
        expect(section).toBeNull();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: mockAllParks }),
      });
    });

    it('should have proper heading hierarchy', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        const h2 = screen.getByRole('heading', { level: 2 });
        expect(h2).toBeInTheDocument();
        expect(h2).toHaveTextContent('Popular Parks');
      });
    });

    it('should have alt text for images', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        images.forEach((img) => {
          expect(img).toHaveAttribute('alt');
        });
      });
    });

    it('should have accessible links', async () => {
      render(<PopularParks />);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        links.forEach((link) => {
          expect(link).toHaveAttribute('href');
        });
      });
    });
  });

  describe('API Calls', () => {
    it('should fetch data from search API with limit of 30', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: mockAllParks }),
      });

      render(<PopularParks />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/search?limit=30');
      });
    });

    it('should only make one API call', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: mockAllParks }),
      });

      render(<PopularParks />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Image Filtering', () => {
    it('should only display parks with images', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: mockAllParks }),
      });

      render(<PopularParks />);

      await waitFor(() => {
        // Parks with images should be displayed
        expect(screen.getByText('Yellowstone National Park')).toBeInTheDocument();
        expect(screen.getByText('Grand Canyon National Park')).toBeInTheDocument();
      });

      // Parks without images should NOT be displayed
      expect(screen.queryByText('Park Without Image 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Park Without Image 2')).not.toBeInTheDocument();
    });

    it('should include parks with wikidata_image', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: mockAllParks }),
      });

      render(<PopularParks />);

      await waitFor(() => {
        // Park with wikidata_image should be displayed
        expect(screen.getByText('Park With Wikidata Image')).toBeInTheDocument();
      });
    });

    it('should limit displayed parks to 8', async () => {
      // Create more than 8 parks with images
      const manyParksWithImages = Array.from({ length: 15 }, (_, i) => ({
        id: `park-${i}`,
        park_code: `park${i}`,
        full_name: `Park Number ${i}`,
        description: `Description for park ${i}`,
        states: 'CA',
        images: [{ url: `https://example.com/park${i}.jpg`, title: `Park ${i}` }],
      }));

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ parks: manyParksWithImages }),
      });

      render(<PopularParks />);

      await waitFor(() => {
        // Should only show 8 parks
        const parkLinks = document.querySelectorAll('a[href^="/parks/"]');
        // Each park card has multiple links, so we check for park names instead
        const parkNames = screen.getAllByText(/Park Number \d/);
        expect(parkNames.length).toBeLessThanOrEqual(8);
      });
    });
  });
});
