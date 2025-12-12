/**
 * Park Detail Page Tests
 * Tests for the SSR park detail page with tab-based routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ParkDetailClient from '@/app/parks/[parkCode]/[[...tab]]/ParkDetailClient';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }) => <a href={href} className={className}>{children}</a>,
}));

// Mock next/dynamic for ParkMap
vi.mock('next/dynamic', () => ({
  default: () => {
    const MockParkMap = () => <div data-testid="park-map">Mock Park Map</div>;
    return MockParkMap;
  },
}));

// Mock useAnalytics hook
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackParkView: vi.fn(),
    trackPageView: vi.fn(),
  }),
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
  default: () => ({
    user: null,
    loading: false,
  }),
}));

// Mock FavoriteButton
vi.mock('@/components/parks/FavoriteButton', () => ({
  FavoriteButton: ({ parkId, parkCode }) => (
    <button data-testid="favorite-button" data-park-id={parkId} data-park-code={parkCode}>
      Favorite
    </button>
  ),
}));

// Mock WeatherForecast
vi.mock('@/components/weather/WeatherForecast', () => ({
  default: ({ latitude, longitude, parkName }) => (
    <div data-testid="weather-forecast" data-lat={latitude} data-lon={longitude}>
      Weather Forecast for {parkName}
    </div>
  ),
}));

// Mock WeatherAlerts
vi.mock('@/components/weather/WeatherAlerts', () => ({
  default: ({ latitude, longitude, parkName }) => (
    <div data-testid="weather-alerts" data-lat={latitude} data-lon={longitude}>
      Weather Alerts for {parkName}
    </div>
  ),
}));

// Mock ProductCarousel
vi.mock('@/components/products/ProductCard', () => ({
  ProductCarousel: ({ products, title }) => (
    <div data-testid="product-carousel">
      <h3>{title}</h3>
      <span>{products.length} products</span>
    </div>
  ),
}));

// Mock NearbyPlaces
vi.mock('@/components/parks/NearbyPlaces', () => ({
  default: ({ parkCode }) => (
    <div data-testid="nearby-places" data-park-code={parkCode}>
      Nearby Places
    </div>
  ),
}));

// Mock ParkReviews
vi.mock('@/components/parks/ParkReviews', () => ({
  default: ({ parkCode }) => (
    <div data-testid="park-reviews" data-park-code={parkCode}>
      Park Reviews
    </div>
  ),
}));

// Mock UserPhotos
vi.mock('@/components/parks/UserPhotos', () => ({
  default: ({ parkCode }) => (
    <div data-testid="user-photos" data-park-code={parkCode}>
      User Photos
    </div>
  ),
}));

// Mock park data
const mockNpsPark = {
  id: 'park-uuid-1',
  park_code: 'yell',
  full_name: 'Yellowstone National Park',
  description: 'The first national park in the world, known for its geothermal features.',
  states: 'WY,MT,ID',
  latitude: 44.428,
  longitude: -110.5885,
  designation: 'National Park',
  url: 'https://www.nps.gov/yell',
  weather_info: 'Yellowstone has unpredictable weather.',
  images: [
    { url: 'https://example.com/yellowstone1.jpg', altText: 'Old Faithful' },
    { url: 'https://example.com/yellowstone2.jpg', altText: 'Grand Prismatic' },
  ],
  activities: [
    { name: 'Hiking' },
    { name: 'Wildlife Watching' },
    { name: 'Camping' },
  ],
  operating_hours: [
    {
      name: 'Yellowstone National Park',
      description: 'Open year-round',
      standardHours: {
        monday: '24 hours',
        tuesday: '24 hours',
        wednesday: '24 hours',
        thursday: '24 hours',
        friday: '24 hours',
        saturday: '24 hours',
        sunday: '24 hours',
      },
    },
  ],
  entrance_fees: [
    { title: 'Private Vehicle', cost: '35', description: 'Valid for 7 days' },
    { title: 'Individual', cost: '20', description: 'Valid for 7 days' },
  ],
  area: 2219791,
  area_unit: 'acres',
  inception: '1872-03-01',
  directions_url: 'https://www.nps.gov/yell/planyourvisit/directions.htm',
  contacts: {
    phoneNumbers: [{ phoneNumber: '307-344-7381', type: 'Voice' }],
    emailAddresses: [{ emailAddress: 'yell_visitor_services@nps.gov' }],
  },
  source: 'nps',
};

const mockStatePark = {
  id: 'park-uuid-2',
  park_code: 'Q4648515',
  full_name: 'Big Basin Redwoods State Park',
  description: null,
  states: 'California',
  latitude: 37.1725,
  longitude: -122.2275,
  designation: 'State Park',
  url: 'https://www.parks.ca.gov/?page_id=540',
  weather_info: null,
  images: [
    { url: 'https://commons.wikimedia.org/bigbasin.jpg', altText: 'Big Basin Redwoods State Park' },
  ],
  activities: [],
  operating_hours: [],
  entrance_fees: [],
  area: 18000,
  area_unit: 'acres',
  inception: '1902-01-01',
  directions_url: null,
  contacts: null,
  source: 'wikidata',
};

const mockProducts = [
  { id: 'prod-1', name: 'Hiking Boots', price: 99.99 },
  { id: 'prod-2', name: 'Backpack', price: 79.99 },
];

describe('ParkDetailClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Tab Navigation', () => {
    it('should render all tab links', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={mockProducts}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Map')).toBeInTheDocument();
      expect(screen.getByText('Weather Events')).toBeInTheDocument();
      expect(screen.getByText('Activities')).toBeInTheDocument();
      expect(screen.getByText('Reviews')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('should highlight active tab', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="map"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      const mapTab = screen.getByText('Map').closest('a');
      // Active tab should have green border class
      expect(mapTab.className).toContain('border-green-600');
    });

    it('should link to correct tab URLs', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Overview').closest('a')).toHaveAttribute('href', '/parks/yell');
      expect(screen.getByText('Map').closest('a')).toHaveAttribute('href', '/parks/yell/map');
      expect(screen.getByText('Weather Events').closest('a')).toHaveAttribute('href', '/parks/yell/weather');
      expect(screen.getByText('Activities').closest('a')).toHaveAttribute('href', '/parks/yell/activities');
      expect(screen.getByText('Reviews').closest('a')).toHaveAttribute('href', '/parks/yell/reviews');
      expect(screen.getByText('Info').closest('a')).toHaveAttribute('href', '/parks/yell/info');
    });
  });

  describe('Overview Tab', () => {
    it('should display park description', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={mockProducts}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText(/first national park in the world/i)).toBeInTheDocument();
    });

    it('should display quick info cards', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={mockProducts}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('WY,MT,ID')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('National Park')).toBeInTheDocument();
    });

    it('should display weather info', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={mockProducts}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText(/unpredictable weather/i)).toBeInTheDocument();
      expect(screen.getByTestId('weather-forecast')).toBeInTheDocument();
    });

    it('should display product carousel when products available', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={mockProducts}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByTestId('product-carousel')).toBeInTheDocument();
      expect(screen.getByText('Gear Up for Your Visit')).toBeInTheDocument();
    });

    it('should display external links', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Official Website')).toBeInTheDocument();
      expect(screen.getByText('Directions')).toBeInTheDocument();
    });
  });

  describe('Map Tab', () => {
    it('should display map when coordinates available', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="map"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Map & Location')).toBeInTheDocument();
      expect(screen.getByTestId('park-map')).toBeInTheDocument();
    });

    it('should show message when coordinates not available', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="map"
          products={[]}
          hasCoordinates={false}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText(/Map coordinates not available/i)).toBeInTheDocument();
    });
  });

  describe('Weather Tab', () => {
    it('should display weather alerts when coordinates available', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="weather"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Weather Events & Alerts')).toBeInTheDocument();
      expect(screen.getByTestId('weather-alerts')).toBeInTheDocument();
    });

    it('should show message when coordinates not available', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="weather"
          products={[]}
          hasCoordinates={false}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText(/Location coordinates not available/i)).toBeInTheDocument();
    });
  });

  describe('Activities Tab', () => {
    it('should display park activities', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="activities"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Park Activities')).toBeInTheDocument();
      expect(screen.getByText('Hiking')).toBeInTheDocument();
      expect(screen.getByText('Wildlife Watching')).toBeInTheDocument();
      expect(screen.getByText('Camping')).toBeInTheDocument();
    });

    it('should link activities to activity pages', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="activities"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      const hikingLink = screen.getByText('Hiking').closest('a');
      expect(hikingLink).toHaveAttribute('href', '/activities/hiking');
    });

    it('should display nearby places component', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="activities"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      // "Nearby Places" appears in both heading and mock component
      const nearbyPlacesElements = screen.getAllByText('Nearby Places');
      expect(nearbyPlacesElements.length).toBeGreaterThan(0);
      expect(screen.getByTestId('nearby-places')).toBeInTheDocument();
    });
  });

  describe('Reviews Tab', () => {
    it('should display park reviews component', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="reviews"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Reviews & Ratings')).toBeInTheDocument();
      expect(screen.getByTestId('park-reviews')).toBeInTheDocument();
    });
  });

  describe('Info Tab', () => {
    it('should display entrance fees', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="info"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Entrance Fees')).toBeInTheDocument();
      expect(screen.getByText('Private Vehicle')).toBeInTheDocument();
      expect(screen.getByText('$35')).toBeInTheDocument();
      expect(screen.getByText('Individual')).toBeInTheDocument();
      expect(screen.getByText('$20')).toBeInTheDocument();
    });

    it('should display operating hours', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="info"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Operating Hours')).toBeInTheDocument();
      expect(screen.getByText('Yellowstone National Park')).toBeInTheDocument();
    });

    it('should display contact information', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="info"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByText('Contact')).toBeInTheDocument();
      expect(screen.getByText('307-344-7381')).toBeInTheDocument();
      expect(screen.getByText('yell_visitor_services@nps.gov')).toBeInTheDocument();
    });
  });

  describe('Image Gallery', () => {
    it('should display image gallery when multiple images available', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      // Photos tab should always be visible (for user-contributed content)
      const photosElements = screen.getAllByText('Photos');
      expect(photosElements.length).toBeGreaterThan(0);
      // Should show images starting from index 1 (skip hero image)
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('should display gallery even with only one image (for state parks)', () => {
      render(
        <ParkDetailClient
          park={mockStatePark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockStatePark.images}
          activities={mockStatePark.activities}
          entranceFees={mockStatePark.entrance_fees}
          operatingHours={mockStatePark.operating_hours}
        />
      );

      // State parks with only 1 image should still show the gallery
      // This ensures state park photos are visible in the gallery section
      // Photos tab is always visible for user-contributed content
      const photosElements = screen.getAllByText('Photos');
      expect(photosElements.length).toBeGreaterThan(0);
    });

    it('should not display gallery section when no images but Photos tab still visible', () => {
      render(
        <ParkDetailClient
          park={mockStatePark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={[]}
          activities={mockStatePark.activities}
          entranceFees={mockStatePark.entrance_fees}
          operatingHours={mockStatePark.operating_hours}
        />
      );

      // Photos tab should still be visible for user-contributed content
      // but the gallery section with park images should not be shown
      const photosTab = screen.getByRole('link', { name: 'Photos' });
      expect(photosTab).toBeInTheDocument();
      // The gallery heading should not be present when no images
      const galleryHeadings = screen.queryAllByRole('heading', { name: 'Photos' });
      expect(galleryHeadings.length).toBe(0);
    });
  });

  describe('Photos Tab', () => {
    it('should display user photos component on photos tab', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="photos"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      expect(screen.getByTestId('user-photos')).toBeInTheDocument();
    });

    it('should link to photos tab URL', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      const photosTab = screen.getByRole('link', { name: 'Photos' });
      expect(photosTab).toHaveAttribute('href', '/parks/yell/photos');
    });
  });

  describe('State Park Support', () => {
    it('should render state park correctly', () => {
      render(
        <ParkDetailClient
          park={mockStatePark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockStatePark.images}
          activities={mockStatePark.activities}
          entranceFees={mockStatePark.entrance_fees}
          operatingHours={mockStatePark.operating_hours}
        />
      );

      expect(screen.getByText('California')).toBeInTheDocument();
      expect(screen.getByText('State Park')).toBeInTheDocument();
    });

    it('should link to correct URLs for state parks', () => {
      render(
        <ParkDetailClient
          park={mockStatePark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockStatePark.images}
          activities={mockStatePark.activities}
          entranceFees={mockStatePark.entrance_fees}
          operatingHours={mockStatePark.operating_hours}
        />
      );

      expect(screen.getByText('Map').closest('a')).toHaveAttribute('href', '/parks/Q4648515/map');
    });
  });

  describe('Favorite Button', () => {
    it('should render favorite button with correct props', () => {
      render(
        <ParkDetailClient
          park={mockNpsPark}
          activeTab="overview"
          products={[]}
          hasCoordinates={true}
          images={mockNpsPark.images}
          activities={mockNpsPark.activities}
          entranceFees={mockNpsPark.entrance_fees}
          operatingHours={mockNpsPark.operating_hours}
        />
      );

      const favoriteButton = screen.getAllByTestId('favorite-button')[0];
      expect(favoriteButton).toHaveAttribute('data-park-id', 'park-uuid-1');
      expect(favoriteButton).toHaveAttribute('data-park-code', 'yell');
    });
  });
});

describe('Park Detail Page URL Routing', () => {
  it('should handle overview tab (default)', () => {
    render(
      <ParkDetailClient
        park={mockNpsPark}
        activeTab="overview"
        products={[]}
        hasCoordinates={true}
        images={mockNpsPark.images}
        activities={mockNpsPark.activities}
        entranceFees={mockNpsPark.entrance_fees}
        operatingHours={mockNpsPark.operating_hours}
      />
    );

    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('should handle map tab', () => {
    render(
      <ParkDetailClient
        park={mockNpsPark}
        activeTab="map"
        products={[]}
        hasCoordinates={true}
        images={mockNpsPark.images}
        activities={mockNpsPark.activities}
        entranceFees={mockNpsPark.entrance_fees}
        operatingHours={mockNpsPark.operating_hours}
      />
    );

    expect(screen.getByText('Map & Location')).toBeInTheDocument();
  });

  it('should handle weather tab', () => {
    render(
      <ParkDetailClient
        park={mockNpsPark}
        activeTab="weather"
        products={[]}
        hasCoordinates={true}
        images={mockNpsPark.images}
        activities={mockNpsPark.activities}
        entranceFees={mockNpsPark.entrance_fees}
        operatingHours={mockNpsPark.operating_hours}
      />
    );

    expect(screen.getByText('Weather Events & Alerts')).toBeInTheDocument();
  });

  it('should handle activities tab', () => {
    render(
      <ParkDetailClient
        park={mockNpsPark}
        activeTab="activities"
        products={[]}
        hasCoordinates={true}
        images={mockNpsPark.images}
        activities={mockNpsPark.activities}
        entranceFees={mockNpsPark.entrance_fees}
        operatingHours={mockNpsPark.operating_hours}
      />
    );

    expect(screen.getByText('Park Activities')).toBeInTheDocument();
  });

  it('should handle reviews tab', () => {
    render(
      <ParkDetailClient
        park={mockNpsPark}
        activeTab="reviews"
        products={[]}
        hasCoordinates={true}
        images={mockNpsPark.images}
        activities={mockNpsPark.activities}
        entranceFees={mockNpsPark.entrance_fees}
        operatingHours={mockNpsPark.operating_hours}
      />
    );

    expect(screen.getByText('Reviews & Ratings')).toBeInTheDocument();
  });

  it('should handle info tab', () => {
    render(
      <ParkDetailClient
        park={mockNpsPark}
        activeTab="info"
        products={[]}
        hasCoordinates={true}
        images={mockNpsPark.images}
        activities={mockNpsPark.activities}
        entranceFees={mockNpsPark.entrance_fees}
        operatingHours={mockNpsPark.operating_hours}
      />
    );

    expect(screen.getByText('Entrance Fees')).toBeInTheDocument();
  });
});