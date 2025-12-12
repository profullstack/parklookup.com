/**
 * Tests for LocalParkDetailClient Component
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom, className }) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)} data-zoom={zoom} className={className}>
      {children}
    </div>
  ),
  TileLayer: ({ url, attribution }) => (
    <div data-testid="tile-layer" data-url={url} data-attribution={attribution} />
  ),
  Marker: ({ children, position }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }) => (
    <div data-testid="popup">{children}</div>
  ),
}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({})),
    Marker: {
      prototype: {
        options: {},
      },
    },
  },
}));

// Mock leaflet CSS
vi.mock('leaflet/dist/leaflet.css', () => ({}));

describe('LocalParkDetailClient Component', () => {
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
    managing_agency: 'LA County Parks and Recreation',
    county: 'Los Angeles',
    state: 'CA',
    latitude: 34.1341,
    longitude: -118.2944,
    access: 'Open',
    website: 'https://www.laparks.org/griffith',
    wikidata_id: 'Q1544583',
    photos: [
      {
        id: 'p1',
        image_url: 'https://example.com/image1.jpg',
        thumb_url: 'https://example.com/thumb1.jpg',
        license: 'CC BY-SA 4.0',
        attribution: 'John Doe',
        source: 'wikimedia',
      },
      {
        id: 'p2',
        image_url: 'https://example.com/image2.jpg',
        thumb_url: 'https://example.com/thumb2.jpg',
        license: 'CC BY 4.0',
        attribution: 'Jane Smith',
        source: 'wikimedia',
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
    website: null,
    wikidata_id: 'Q160409',
    photos: [],
  };

  describe('Basic Rendering', () => {
    it('should render park name', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByText('Griffith Park')).toBeInTheDocument();
    });

    it('should render county park badge', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByText('County Park')).toBeInTheDocument();
    });

    it('should render city park badge', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCityPark} />);

      expect(screen.getByText('City Park')).toBeInTheDocument();
    });

    it('should render managing agency', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByText('LA County Parks and Recreation')).toBeInTheDocument();
    });

    it('should render location', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByText(/Los Angeles/)).toBeInTheDocument();
      expect(screen.getByText(/CA/)).toBeInTheDocument();
    });

    it('should render access status', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByText('Open')).toBeInTheDocument();
    });
  });

  describe('Hero Image', () => {
    it('should render hero image when photos available', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const heroImage = screen.getByRole('img', { name: /Griffith Park/i });
      expect(heroImage).toBeInTheDocument();
    });

    it('should render placeholder when no photos available', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCityPark} />);

      expect(screen.getByTestId('park-placeholder')).toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('should render Overview tab by default', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
    });

    it('should render Photos tab', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByRole('tab', { name: /Photos/i })).toBeInTheDocument();
    });

    it('should render Map tab', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByRole('tab', { name: /Map/i })).toBeInTheDocument();
    });

    it('should switch to Photos tab when clicked', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const photosTab = screen.getByRole('tab', { name: /Photos/i });
      fireEvent.click(photosTab);

      // Should show photo gallery
      expect(screen.getByText(/Photo Gallery/i)).toBeInTheDocument();
    });

    it('should switch to Map tab when clicked', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const mapTab = screen.getByRole('tab', { name: /Map/i });
      fireEvent.click(mapTab);

      // Should show map container
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Photo Gallery', () => {
    it('should display all photos in gallery', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const photosTab = screen.getByRole('tab', { name: /Photos/i });
      fireEvent.click(photosTab);

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
    });

    it('should display photo attribution', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const photosTab = screen.getByRole('tab', { name: /Photos/i });
      fireEvent.click(photosTab);

      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    it('should display photo license', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const photosTab = screen.getByRole('tab', { name: /Photos/i });
      fireEvent.click(photosTab);

      expect(screen.getByText(/CC BY-SA 4.0/)).toBeInTheDocument();
    });

    it('should show message when no photos available', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCityPark} />);

      const photosTab = screen.getByRole('tab', { name: /Photos/i });
      fireEvent.click(photosTab);

      expect(screen.getByText(/No photos available/i)).toBeInTheDocument();
    });
  });

  describe('External Links', () => {
    it('should render website link when available', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const websiteLink = screen.getByRole('link', { name: /Official Website/i });
      expect(websiteLink).toHaveAttribute('href', 'https://www.laparks.org/griffith');
    });

    it('should not render website link when not available', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCityPark} />);

      expect(screen.queryByRole('link', { name: /Official Website/i })).not.toBeInTheDocument();
    });

    it('should render Google Maps directions link', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const directionsLink = screen.getByRole('link', { name: /Get Directions/i });
      expect(directionsLink).toHaveAttribute(
        'href',
        expect.stringContaining('google.com/maps')
      );
    });

    it('should render Wikidata link when wikidata_id available', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const wikidataLink = screen.getByRole('link', { name: /Wikidata/i });
      expect(wikidataLink).toHaveAttribute(
        'href',
        'https://www.wikidata.org/wiki/Q1544583'
      );
    });
  });

  describe('Map Display', () => {
    it('should render map with correct coordinates', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const mapTab = screen.getByRole('tab', { name: /Map/i });
      fireEvent.click(mapTab);

      const mapContainer = screen.getByTestId('map-container');
      const center = JSON.parse(mapContainer.getAttribute('data-center'));
      
      expect(center[0]).toBeCloseTo(34.1341, 2);
      expect(center[1]).toBeCloseTo(-118.2944, 2);
    });

    it('should render marker at park location', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const mapTab = screen.getByRole('tab', { name: /Map/i });
      fireEvent.click(mapTab);

      expect(screen.getByTestId('marker')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply orange styling for county parks', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const badge = screen.getByText('County Park');
      expect(badge).toHaveClass('bg-orange-100');
    });

    it('should apply teal styling for city parks', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCityPark} />);

      const badge = screen.getByText('City Park');
      expect(badge).toHaveClass('bg-teal-100');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing coordinates gracefully', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      const parkWithoutCoords = { ...mockCountyPark, latitude: null, longitude: null };
      render(<LocalParkDetailClient park={parkWithoutCoords} />);

      const mapTab = screen.getByRole('tab', { name: /Map/i });
      fireEvent.click(mapTab);

      expect(screen.getByText(/Location data not available/i)).toBeInTheDocument();
    });

    it('should handle missing managing_agency', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      const parkWithoutAgency = { ...mockCountyPark, managing_agency: null };
      render(<LocalParkDetailClient park={parkWithoutAgency} />);

      expect(screen.getByText('Griffith Park')).toBeInTheDocument();
    });

    it('should handle restricted access status', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      const restrictedPark = { ...mockCountyPark, access: 'Restricted' };
      render(<LocalParkDetailClient park={restrictedPark} />);

      expect(screen.getByText('Restricted')).toBeInTheDocument();
    });
  });
});