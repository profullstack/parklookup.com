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

// Sample park data for testing - each park has unique data
const mockParksData = {
  yell: {
    park_code: 'yell',
    full_name: 'Yellowstone National Park',
    description: 'Yellowstone National Park is a nearly 3,500-sq.-mile wilderness recreation area.',
    states: 'WY,MT,ID',
    images: [{ url: 'https://example.com/yellowstone.jpg', title: 'Yellowstone' }],
  },
  grca: {
    park_code: 'grca',
    full_name: 'Grand Canyon National Park',
    description: 'Grand Canyon National Park is a stunning natural wonder.',
    states: 'AZ',
    images: [{ url: 'https://example.com/grandcanyon.jpg', title: 'Grand Canyon' }],
  },
  yose: {
    park_code: 'yose',
    full_name: 'Yosemite National Park',
    description: 'Yosemite National Park is known for its waterfalls and granite cliffs.',
    states: 'CA',
    images: [{ url: 'https://example.com/yosemite.jpg', title: 'Yosemite' }],
  },
  zion: {
    park_code: 'zion',
    full_name: 'Zion National Park',
    description: 'Zion National Park features stunning red cliffs and canyons.',
    states: 'UT',
    images: [{ url: 'https://example.com/zion.jpg', title: 'Zion' }],
  },
  romo: {
    park_code: 'romo',
    full_name: 'Rocky Mountain National Park',
    description: 'Rocky Mountain National Park offers alpine lakes and mountain peaks.',
    states: 'CO',
    images: [{ url: 'https://example.com/rockymountain.jpg', title: 'Rocky Mountain' }],
  },
  acad: {
    park_code: 'acad',
    full_name: 'Acadia National Park',
    description: 'Acadia National Park features rugged Atlantic coastline.',
    states: 'ME',
    images: [{ url: 'https://example.com/acadia.jpg', title: 'Acadia' }],
  },
  glac: {
    park_code: 'glac',
    full_name: 'Glacier National Park',
    description: 'Glacier National Park has pristine forests and alpine meadows.',
    states: 'MT',
    images: [{ url: 'https://example.com/glacier.jpg', title: 'Glacier' }],
  },
  jotr: {
    park_code: 'jotr',
    full_name: 'Joshua Tree National Park',
    description: 'Joshua Tree National Park features unique desert landscapes.',
    states: 'CA',
    images: [{ url: 'https://example.com/joshuatree.jpg', title: 'Joshua Tree' }],
  },
};

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
      // Mock successful fetch for each park - return unique data for each park code
      global.fetch.mockImplementation((url) => {
        const parkCode = url.split('/').pop();
        const park = mockParksData[parkCode] || mockParksData.yell;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(park),
        });
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
        const stateElements = screen.getAllByText(/WY|AZ|CA|UT|CO|ME|MT/);
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
    it('should not render section when all fetches fail', async () => {
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

    it('should handle partial fetch failures gracefully', async () => {
      const parkCodes = ['yell', 'grca', 'yose', 'zion', 'romo', 'acad', 'glac', 'jotr'];
      let callIndex = 0;
      global.fetch.mockImplementation((url) => {
        const parkCode = url.split('/').pop();
        callIndex++;
        // Only first 2 calls succeed
        if (callIndex <= 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockParksData[parkCode] || mockParksData.yell),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<PopularParks />);

      await waitFor(() => {
        // Should still render with partial data - at least one park should be visible
        const parkLinks = document.querySelectorAll('a[href^="/parks/"]');
        expect(parkLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty State', () => {
    it('should not render section when no parks are returned', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
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
      global.fetch.mockImplementation((url) => {
        const parkCode = url.split('/').pop();
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockParksData[parkCode] || mockParksData.yell),
        });
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
    it('should fetch data for all popular park codes', async () => {
      global.fetch.mockImplementation((url) => {
        const parkCode = url.split('/').pop();
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockParksData[parkCode] || mockParksData.yell),
        });
      });

      render(<PopularParks />);

      await waitFor(() => {
        // Should have called fetch for each popular park
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/yell');
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/grca');
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/yose');
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/zion');
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/romo');
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/acad');
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/glac');
        expect(global.fetch).toHaveBeenCalledWith('/api/parks/jotr');
      });
    });
  });
});
