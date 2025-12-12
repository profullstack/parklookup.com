/**
 * Tests for InteractiveParksMap Component
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  Marker: ({ children, position, icon }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)} data-icon={icon?.options?.className}>
      {children}
    </div>
  ),
  Popup: ({ children }) => (
    <div data-testid="popup">{children}</div>
  ),
  Circle: ({ center, radius }) => (
    <div data-testid="circle" data-center={JSON.stringify(center)} data-radius={radius} />
  ),
  useMap: () => ({
    setView: vi.fn(),
  }),
}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn((options) => ({ options })),
    Marker: {
      prototype: {
        options: {},
      },
    },
  },
}));

// Mock leaflet CSS
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock fetch for address lookup
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ found: true, shortAddress: '123 Park Ave' }),
  })
);

describe('InteractiveParksMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const mockNationalParks = [
    {
      id: '1',
      park_code: 'yose',
      full_name: 'Yosemite National Park',
      latitude: 37.8651,
      longitude: -119.5383,
      states: 'CA',
      source: 'nps',
    },
    {
      id: '2',
      park_code: 'grca',
      full_name: 'Grand Canyon National Park',
      latitude: 36.0544,
      longitude: -112.1401,
      states: 'AZ',
      source: 'nps',
    },
  ];

  const mockStateParks = [
    {
      id: '3',
      park_code: 'Q123456',
      full_name: 'Big Basin Redwoods State Park',
      latitude: 37.1725,
      longitude: -122.2274,
      states: 'California',
      source: 'wikidata',
      designation: 'State Park',
    },
  ];

  const mockLocalParks = [
    {
      id: '4',
      name: 'Griffith Park',
      slug: 'griffith-park',
      park_type: 'county',
      managing_agency: 'LA County Parks',
      county: 'Los Angeles',
      state: 'CA',
      latitude: 34.1341,
      longitude: -118.2944,
    },
    {
      id: '5',
      name: 'Central Park',
      slug: 'central-park',
      park_type: 'city',
      managing_agency: 'NYC Parks',
      county: 'New York',
      city: 'New York',
      state: 'NY',
      latitude: 40.7829,
      longitude: -73.9654,
    },
  ];

  describe('Basic Rendering', () => {
    it('should render map container', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={mockNationalParks} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should render loading state', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={[]} loading={true} />);

      expect(screen.getByText('Loading parks...')).toBeInTheDocument();
    });

    it('should render markers for national parks', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={mockNationalParks} />);

      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(2);
    });
  });

  describe('Local Parks Support', () => {
    it('should render markers for local parks', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={[]} localParks={mockLocalParks} />);

      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(2);
    });

    it('should render both national and local parks', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(
        <InteractiveParksMap 
          parks={mockNationalParks} 
          localParks={mockLocalParks} 
        />
      );

      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(4); // 2 national + 2 local
    });

    it('should display county park name in popup', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={[]} localParks={mockLocalParks} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('Griffith Park');
    });

    it('should display city park name in popup', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={[]} localParks={mockLocalParks} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[1]).toHaveTextContent('Central Park');
    });

    it('should display park type badge in popup', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={[]} localParks={mockLocalParks} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('County Park');
      expect(popups[1]).toHaveTextContent('City Park');
    });

    it('should display managing agency in popup', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={[]} localParks={mockLocalParks} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('LA County Parks');
    });
  });

  describe('Park Type Detection', () => {
    it('should identify national parks', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={mockNationalParks} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('National Park');
    });

    it('should identify state parks', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={mockStateParks} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('State Park');
    });

    it('should identify county parks', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      const countyPark = [mockLocalParks[0]];
      render(<InteractiveParksMap parks={[]} localParks={countyPark} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('County Park');
    });

    it('should identify city parks', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      const cityPark = [mockLocalParks[1]];
      render(<InteractiveParksMap parks={[]} localParks={cityPark} />);

      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('City Park');
    });
  });

  describe('Park URLs', () => {
    it('should link to national park detail page', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={mockNationalParks} />);

      const link = screen.getAllByText('View Details →')[0];
      expect(link).toHaveAttribute('href', '/parks/yose');
    });

    it('should link to county park detail page', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      const countyPark = [mockLocalParks[0]];
      render(<InteractiveParksMap parks={[]} localParks={countyPark} />);

      const link = screen.getByText('View Details →');
      expect(link).toHaveAttribute('href', '/parks/county/ca/los-angeles/griffith-park');
    });

    it('should link to city park detail page', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      const cityPark = [mockLocalParks[1]];
      render(<InteractiveParksMap parks={[]} localParks={cityPark} />);

      const link = screen.getByText('View Details →');
      expect(link).toHaveAttribute('href', '/parks/city/ny/new-york/central-park');
    });
  });

  describe('User Location', () => {
    const userLocation = { lat: 37.7749, lng: -122.4194 };

    it('should render user location marker', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(
        <InteractiveParksMap 
          parks={mockNationalParks} 
          userLocation={userLocation} 
        />
      );

      // Should have user marker + park markers
      const markers = screen.getAllByTestId('marker');
      expect(markers.length).toBeGreaterThan(2);
    });

    it('should render radius circle around user location', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(
        <InteractiveParksMap 
          parks={mockNationalParks} 
          userLocation={userLocation} 
        />
      );

      expect(screen.getByTestId('circle')).toBeInTheDocument();
    });

    it('should filter parks within radius when user location is set', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      // Parks far from San Francisco
      const farParks = [
        {
          id: '1',
          park_code: 'ever',
          full_name: 'Everglades National Park',
          latitude: 25.2866,
          longitude: -80.8987,
          states: 'FL',
          source: 'nps',
        },
      ];
      
      render(
        <InteractiveParksMap 
          parks={farParks} 
          userLocation={userLocation} 
        />
      );

      // Should show message about no parks nearby
      expect(screen.getByText(/No parks found within/)).toBeInTheDocument();
    });
  });

  describe('Filtering Invalid Coordinates', () => {
    it('should filter out parks without coordinates', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      const parksWithInvalid = [
        ...mockNationalParks,
        {
          id: '99',
          park_code: 'invalid',
          full_name: 'Invalid Park',
          latitude: null,
          longitude: null,
          source: 'nps',
        },
      ];
      
      render(<InteractiveParksMap parks={parksWithInvalid} />);

      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(2); // Only valid parks
    });

    it('should filter out local parks without coordinates', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      const localParksWithInvalid = [
        ...mockLocalParks,
        {
          id: '99',
          name: 'Invalid Local Park',
          slug: 'invalid',
          park_type: 'county',
          latitude: null,
          longitude: null,
        },
      ];
      
      render(<InteractiveParksMap parks={[]} localParks={localParksWithInvalid} />);

      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(2); // Only valid local parks
    });
  });

  describe('Empty States', () => {
    it('should handle empty parks array', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={[]} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
      expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    });

    it('should handle empty localParks array', async () => {
      const InteractiveParksMap = (await import('@/components/parks/InteractiveParksMap')).default;
      
      render(<InteractiveParksMap parks={mockNationalParks} localParks={[]} />);

      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(2); // Only national parks
    });
  });
});