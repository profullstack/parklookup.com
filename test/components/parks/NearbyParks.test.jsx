/**
 * NearbyParks Component Tests
 * Tests for the nearby parks display functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NearbyParks, { NearbyParksCompact } from '@/components/parks/NearbyParks';

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

// Mock park data
const mockParks = [
  {
    id: '1',
    park_code: 'yose',
    full_name: 'Yosemite National Park',
    description: 'A beautiful national park in California',
    states: 'CA',
    designation: 'National Park',
    latitude: 37.8651,
    longitude: -119.5383,
    distance: 50,
    images: [{ url: 'https://example.com/yosemite.jpg' }],
  },
  {
    id: '2',
    park_code: 'sequ',
    full_name: 'Sequoia National Park',
    description: 'Home of the giant sequoias',
    states: 'CA',
    designation: 'National Park',
    latitude: 36.4864,
    longitude: -118.5658,
    distance: 75,
    images: [{ url: 'https://example.com/sequoia.jpg' }],
  },
  {
    id: '3',
    park_code: 'kica',
    full_name: 'Kings Canyon National Park',
    description: 'Deep canyons and towering peaks',
    states: 'CA',
    designation: 'National Park',
    latitude: 36.8879,
    longitude: -118.5551,
    distance: 80,
  },
];

describe('NearbyParks', () => {
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
                  json: async () => ({ parks: mockParks }),
                }),
              100
            )
          )
      );

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      // Should show loading skeleton
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should render nearby parks when data is fetched successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: mockParks }),
      });

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
      });

      expect(screen.getByText('Sequoia National Park')).toBeInTheDocument();
      expect(screen.getByText('Kings Canyon National Park')).toBeInTheDocument();
    });

    it('should filter out the current park from results', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: mockParks }),
      });

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="yose"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sequoia National Park')).toBeInTheDocument();
      });

      // Yosemite should be filtered out since it's the current park
      expect(screen.queryByText('Yosemite National Park')).not.toBeInTheDocument();
    });

    it('should display distance badges when distance is provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: mockParks }),
      });

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('50 km')).toBeInTheDocument();
      });

      expect(screen.getByText('75 km')).toBeInTheDocument();
      expect(screen.getByText('80 km')).toBeInTheDocument();
    });

    it('should display park type badges with correct icons', async () => {
      const parksWithTypes = [
        { ...mockParks[0], designation: 'National Park' },
        { ...mockParks[1], park_code: 'test2', designation: 'National Monument' },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: parksWithTypes }),
      });

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="other"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
      });

      // Check for park type badges
      expect(screen.getByText(/🏞️ National Park/)).toBeInTheDocument();
      expect(screen.getByText(/🗿 National Monument/)).toBeInTheDocument();
    });

    it('should link to park detail pages', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: [mockParks[0]] }),
      });

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/parks/yose');
    });
  });

  describe('Error State', () => {
    it('should render error state when fetch fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to load nearby parks')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Empty States', () => {
    it('should render message when no coordinates are provided', () => {
      render(
        <NearbyParks
          latitude={null}
          longitude={null}
          currentParkCode="test"
        />
      );

      expect(screen.getByText('Location coordinates not available for this park')).toBeInTheDocument();
    });

    it('should render message when no nearby parks are found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: [] }),
      });

      render(
        <NearbyParks
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
          radius={50}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No nearby parks found within 50 km')).toBeInTheDocument();
      });
    });
  });

  describe('API Call', () => {
    it('should call API with correct parameters', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: [] }),
      });

      render(
        <NearbyParks
          latitude={37.5}
          longitude={-119.5}
          currentParkCode="test"
          radius={100}
          limit={6}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/parks/nearby?lat=37.5&lng=-119.5&radius=100&limit=7'
        );
      });
    });

    it('should not call API if coordinates are missing', () => {
      render(
        <NearbyParks
          latitude={null}
          longitude={null}
          currentParkCode="test"
        />
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});

describe('NearbyParksCompact', () => {
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
                  json: async () => ({ parks: mockParks }),
                }),
              100
            )
          )
      );

      render(
        <NearbyParksCompact
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should render compact version with park names', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: mockParks }),
      });

      render(
        <NearbyParksCompact
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
      });

      expect(screen.getByText('Sequoia National Park')).toBeInTheDocument();
    });

    it('should display state and distance in compact view', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: mockParks }),
      });

      render(
        <NearbyParksCompact
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/CA.*50 km/)).toBeInTheDocument();
      });
    });

    it('should link to park detail pages', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: [mockParks[0]] }),
      });

      render(
        <NearbyParksCompact
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        const links = document.querySelectorAll('a[href*="/parks/"]');
        expect(links.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty State', () => {
    it('should return null when no parks are found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: [] }),
      });

      const { container } = render(
        <NearbyParksCompact
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('should not call API when no coordinates are provided', () => {
      render(
        <NearbyParksCompact
          latitude={null}
          longitude={null}
          currentParkCode="test"
        />
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Limit Parameter', () => {
    it('should pass limit parameter to API', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: mockParks }),
      });

      render(
        <NearbyParksCompact
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
          limit={3}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/parks/nearby?lat=37&lng=-119&radius=100&limit=4'
        );
      });
    });

    it('should use default limit of 5', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parks: mockParks }),
      });

      render(
        <NearbyParksCompact
          latitude={37.0}
          longitude={-119.0}
          currentParkCode="test"
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/parks/nearby?lat=37&lng=-119&radius=100&limit=6'
        );
      });
    });
  });
});