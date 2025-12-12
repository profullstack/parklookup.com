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

// Mock LocalParkUserPhotos component
vi.mock('@/components/parks/LocalParkUserPhotos', () => ({
  default: ({ localParkId, existingPhotos }) => (
    <div data-testid="local-park-user-photos">
      <h2>Photos & Videos</h2>
      {existingPhotos?.length > 0 ? (
        existingPhotos.map((photo, index) => (
          <img key={photo.id || index} src={photo.image_url} alt={`Photo ${index + 1}`} />
        ))
      ) : (
        <p>No photos available for this park yet</p>
      )}
    </div>
  ),
}));

// Mock NearbyParks component
vi.mock('@/components/parks/NearbyParks', () => ({
  default: ({ latitude, longitude, currentParkCode, radius, limit }) => (
    <div data-testid="nearby-parks" data-lat={latitude} data-lng={longitude}>
      Nearby Parks
    </div>
  ),
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    accessToken: null,
  }),
}));

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
    it('should render park name in heading', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByRole('heading', { name: 'Griffith Park' })).toBeInTheDocument();
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

      expect(screen.getByText(/LA County Parks and Recreation/)).toBeInTheDocument();
    });

    it('should render access status', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByText(/Open/)).toBeInTheDocument();
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
    it('should render Overview tab link', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByRole('link', { name: /Overview/i })).toBeInTheDocument();
    });

    it('should render Photos tab link', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByRole('link', { name: /Photos/i })).toBeInTheDocument();
    });

    it('should render Map tab link', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      expect(screen.getByRole('link', { name: /Map/i })).toBeInTheDocument();
    });

    it('should show Photos content when activeTab is photos', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} activeTab="photos" />);

      // Should show photo heading
      expect(screen.getByRole('heading', { name: /Photos/i })).toBeInTheDocument();
    });

    it('should show Map content when activeTab is map', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} activeTab="map" />);

      // Should show map heading
      expect(screen.getByRole('heading', { name: /Map & Location/i })).toBeInTheDocument();
    });
  });

  describe('Photo Gallery', () => {
    it('should display all photos in gallery when activeTab is photos', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} activeTab="photos" />);

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
    });

    it('should show message when no photos available', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCityPark} activeTab="photos" />);

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
    it('should show map heading when activeTab is map', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} activeTab="map" />);

      expect(screen.getByRole('heading', { name: /Map & Location/i })).toBeInTheDocument();
    });

    it('should show location not available message when no coordinates', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      const parkWithoutCoords = { ...mockCountyPark, latitude: null, longitude: null };
      render(<LocalParkDetailClient park={parkWithoutCoords} activeTab="map" />);

      expect(screen.getByText(/coordinates not available/i)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply blue styling for park type badge', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const badge = screen.getByText('County Park');
      expect(badge).toHaveClass('bg-blue-100');
    });

    it('should apply green styling for open access', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      render(<LocalParkDetailClient park={mockCountyPark} />);

      const accessBadge = screen.getByText(/Open/);
      expect(accessBadge).toHaveClass('bg-green-100');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing coordinates gracefully', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      const parkWithoutCoords = { ...mockCountyPark, latitude: null, longitude: null };
      render(<LocalParkDetailClient park={parkWithoutCoords} activeTab="map" />);

      expect(screen.getByText(/coordinates not available/i)).toBeInTheDocument();
    });

    it('should handle missing managing_agency', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      const parkWithoutAgency = { ...mockCountyPark, managing_agency: null };
      render(<LocalParkDetailClient park={parkWithoutAgency} />);

      expect(screen.getByRole('heading', { name: 'Griffith Park' })).toBeInTheDocument();
    });

    it('should handle restricted access status', async () => {
      const LocalParkDetailClient = (await import('@/components/parks/LocalParkDetailClient')).default;
      
      const restrictedPark = { ...mockCountyPark, access: 'Restricted' };
      render(<LocalParkDetailClient park={restrictedPark} />);

      expect(screen.getByText(/Restricted/)).toBeInTheDocument();
    });
  });
});