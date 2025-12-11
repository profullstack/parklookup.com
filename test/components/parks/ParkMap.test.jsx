/**
 * Tests for ParkMap Component
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

describe('ParkMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('ParkMap (single park)', () => {
    it('should render map with valid coordinates', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
        />
      );

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
      expect(screen.getByTestId('marker')).toBeInTheDocument();
    });

    it('should display "Location data not available" when coordinates are missing', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      render(
        <ParkMap
          latitude={null}
          longitude={null}
          parkName="Test Park"
        />
      );

      expect(screen.getByText('Location data not available')).toBeInTheDocument();
      expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    });

    it('should display coordinates when no address is provided', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
        />
      );

      // Should show coordinates formatted to 4 decimal places (appears in both address bar and popup)
      const coordElements = screen.getAllByText('37.8651, -119.5383');
      expect(coordElements.length).toBeGreaterThan(0);
    });

    it('should display physical address when provided', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      const testAddress = '9035 Village Dr, Yosemite Valley, CA 95389';
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
          address={testAddress}
        />
      );

      // Address appears in both address bar and popup
      const addressElements = screen.getAllByText(testAddress);
      expect(addressElements.length).toBeGreaterThan(0);
    });

    it('should include address in popup when provided', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      const testAddress = '9035 Village Dr, Yosemite Valley, CA 95389';
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
          address={testAddress}
        />
      );

      const popup = screen.getByTestId('popup');
      expect(popup).toHaveTextContent(testAddress);
    });

    it('should render Google Maps directions link', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
        />
      );

      const directionsLink = screen.getAllByText(/Get Directions/)[0];
      expect(directionsLink).toBeInTheDocument();
      expect(directionsLink.closest('a')).toHaveAttribute(
        'href',
        'https://www.google.com/maps/dir/?api=1&destination=37.8651,-119.5383'
      );
    });

    it('should use default zoom level of 10', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
        />
      );

      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer).toHaveAttribute('data-zoom', '10');
    });

    it('should accept custom zoom level', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
          zoom={15}
        />
      );

      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer).toHaveAttribute('data-zoom', '15');
    });

    it('should apply custom className', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      const { container } = render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should display park name in popup', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      
      render(
        <ParkMap
          latitude={37.8651}
          longitude={-119.5383}
          parkName="Yosemite National Park"
        />
      );

      const popup = screen.getByTestId('popup');
      expect(popup).toHaveTextContent('Yosemite National Park');
    });

    it('should handle state park with address from database', async () => {
      const ParkMap = (await import('@/components/parks/ParkMap')).default;
      const stateAddress = '201 Tabor Rd, Morris Plains, NJ 07950';
      
      render(
        <ParkMap
          latitude={40.8234}
          longitude={-74.4567}
          parkName="Frelinghuysen Arboretum"
          address={stateAddress}
        />
      );

      // Address should be displayed
      expect(screen.getByText(stateAddress)).toBeInTheDocument();
      
      // Map should be rendered
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('ParksMap (multiple parks)', () => {
    it('should render map with multiple parks', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      const parks = [
        { id: '1', park_code: 'yose', full_name: 'Yosemite', latitude: 37.8651, longitude: -119.5383 },
        { id: '2', park_code: 'grca', full_name: 'Grand Canyon', latitude: 36.0544, longitude: -112.1401 },
      ];
      
      render(<ParksMap parks={parks} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
      expect(screen.getAllByTestId('marker')).toHaveLength(2);
    });

    it('should display "No parks with location data" when parks array is empty', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      render(<ParksMap parks={[]} />);

      expect(screen.getByText('No parks with location data to display')).toBeInTheDocument();
    });

    it('should filter out parks without valid coordinates', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      const parks = [
        { id: '1', park_code: 'yose', full_name: 'Yosemite', latitude: 37.8651, longitude: -119.5383 },
        { id: '2', park_code: 'invalid', full_name: 'Invalid Park', latitude: null, longitude: null },
      ];
      
      render(<ParksMap parks={parks} />);

      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it('should calculate center from parks coordinates', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      const parks = [
        { id: '1', park_code: 'yose', full_name: 'Yosemite', latitude: 40, longitude: -120 },
        { id: '2', park_code: 'grca', full_name: 'Grand Canyon', latitude: 36, longitude: -112 },
      ];
      
      render(<ParksMap parks={parks} />);

      const mapContainer = screen.getByTestId('map-container');
      const center = JSON.parse(mapContainer.getAttribute('data-center'));
      
      // Center should be average of coordinates
      expect(center[0]).toBe(38); // (40 + 36) / 2
      expect(center[1]).toBe(-116); // (-120 + -112) / 2
    });

    it('should use default US center when no parks provided', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      // Parks with invalid coordinates should result in empty validParks
      const parks = [
        { id: '1', park_code: 'invalid', full_name: 'Invalid', latitude: null, longitude: null },
      ];
      
      render(<ParksMap parks={parks} />);

      // Should show "no parks" message since all parks are invalid
      expect(screen.getByText('No parks with location data to display')).toBeInTheDocument();
    });

    it('should include both NPS and state parks on map', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      const parks = [
        { id: '1', park_code: 'yose', full_name: 'Yosemite National Park', latitude: 37.8651, longitude: -119.5383, source: 'nps' },
        { id: '2', park_code: 'Q123456', full_name: 'New Brighton State Beach', latitude: 36.9783, longitude: -121.9386, source: 'wikidata' },
      ];
      
      render(<ParksMap parks={parks} />);

      expect(screen.getAllByTestId('marker')).toHaveLength(2);
      
      // Both parks should have popups with their names
      const popups = screen.getAllByTestId('popup');
      expect(popups[0]).toHaveTextContent('Yosemite National Park');
      expect(popups[1]).toHaveTextContent('New Brighton State Beach');
    });

    it('should link to park detail page in popup', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      const parks = [
        { id: '1', park_code: 'yose', full_name: 'Yosemite', latitude: 37.8651, longitude: -119.5383 },
      ];
      
      render(<ParksMap parks={parks} />);

      const viewDetailsLink = screen.getByText('View Details');
      expect(viewDetailsLink).toHaveAttribute('href', '/parks/yose');
    });

    it('should display state information in popup', async () => {
      const { ParksMap } = await import('@/components/parks/ParkMap');
      
      const parks = [
        { id: '1', park_code: 'yose', full_name: 'Yosemite', latitude: 37.8651, longitude: -119.5383, states: 'CA' },
      ];
      
      render(<ParksMap parks={parks} />);

      const popup = screen.getByTestId('popup');
      expect(popup).toHaveTextContent('CA');
    });
  });
});

describe('ParkMap GPS Coordinates Copy Feature', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  it('should display GPS coordinates in {lat,lon} format', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
      />
    );

    // Should show coordinates in the specified format
    expect(screen.getByText('{37.8651,-119.5383}')).toBeInTheDocument();
  });

  it('should have a copy button for GPS coordinates', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
      />
    );

    const copyButton = screen.getByText('Copy');
    expect(copyButton).toBeInTheDocument();
  });

  it('should copy coordinates to clipboard when copy button is clicked', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
      />
    );

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{37.8651,-119.5383}');
  });

  it('should show "Copied!" feedback after clicking copy button', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
      />
    );

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('should display coordinates alongside address when address is provided', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    const testAddress = '9035 Village Dr, Yosemite Valley, CA 95389';
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
        address={testAddress}
      />
    );

    // Both address and coordinates should be visible
    expect(screen.getByText(testAddress)).toBeInTheDocument();
    expect(screen.getByText('{37.8651,-119.5383}')).toBeInTheDocument();
  });
});

describe('ParkMap Address Display', () => {
  it('should not make API calls for address - uses prop instead', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
        address="9035 Village Dr, Yosemite Valley, CA 95389"
      />
    );

    // Should not call fetch for geocoding
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/geocode')
    );
    
    fetchSpy.mockRestore();
  });

  it('should handle multiline addresses', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    const multilineAddress = '9035 Village Dr\nYosemite Valley, CA 95389';
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
        address={multilineAddress}
      />
    );

    // The address should be displayed with whitespace preserved
    // Use getAllByText since address appears in both address bar and popup
    const addressElements = screen.getAllByText((content, element) => element?.classList?.contains('whitespace-pre-line') &&
             content.includes('9035 Village Dr') &&
             content.includes('Yosemite Valley'));
    expect(addressElements.length).toBeGreaterThan(0);
  });

  it('should gracefully handle null address', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
        address={null}
      />
    );

    // Should fall back to coordinates (appears in both address bar and popup)
    const coordElements = screen.getAllByText('37.8651, -119.5383');
    expect(coordElements.length).toBeGreaterThan(0);
  });

  it('should gracefully handle undefined address', async () => {
    const ParkMap = (await import('@/components/parks/ParkMap')).default;
    
    render(
      <ParkMap
        latitude={37.8651}
        longitude={-119.5383}
        parkName="Yosemite National Park"
      />
    );

    // Should fall back to coordinates (appears in both address bar and popup)
    const coordElements = screen.getAllByText('37.8651, -119.5383');
    expect(coordElements.length).toBeGreaterThan(0);
  });
});
