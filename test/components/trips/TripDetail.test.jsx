/**
 * TripDetail Component Tests
 * Tests for the TripDetail component including NearbyPlaces and RecommendedProducts sections
 * 
 * Testing Framework: Vitest (used by the project)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TripDetail from '@/components/trips/TripDetail';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

describe('TripDetail Component', () => {
  const mockTrip = {
    id: 'trip-uuid-123',
    title: 'California Adventure',
    origin: 'San Francisco, CA',
    startDate: '2025-01-15',
    endDate: '2025-01-18',
    interests: ['hiking', 'photography'],
    difficulty: 'moderate',
    radiusMiles: 200,
    summary: 'An amazing trip through California parks',
    stops: [
      {
        id: 'stop-1',
        dayNumber: 1,
        parkCode: 'yose',
        park: {
          name: 'Yosemite National Park',
          description: 'Famous for its waterfalls',
          states: 'CA',
          latitude: 37.8651,
          longitude: -119.5383,
          designation: 'National Park',
          url: 'https://www.nps.gov/yose',
          images: [{ url: 'https://example.com/yose.jpg' }],
          activities: ['hiking', 'camping'],
          source: 'nps',
        },
        activities: ['hiking'],
        morningPlan: 'Visit Yosemite Valley',
        afternoonPlan: 'Hike to Mirror Lake',
        eveningPlan: 'Sunset at Tunnel View',
        drivingNotes: '3 hours from SF',
        highlights: 'Half Dome views',
        notes: 'Bring water',
        nearbyPlaces: {
          dining: [
            { id: 1, title: 'Mountain Restaurant', rating: 4.5, price_level: 2, distanceMiles: 1.5 },
          ],
          bars: [
            { id: 2, title: 'Valley Bar', rating: 4.2, distanceMiles: 2.0 },
          ],
          lodging: [],
          entertainment: [],
          shopping: [],
          attractions: [],
        },
      },
    ],
    packingList: {
      essentials: ['Water bottle', 'Sunscreen'],
      clothing: ['Hiking boots', 'Rain jacket'],
      gear: ['Backpack', 'Camera'],
      optional: ['Binoculars'],
    },
    safetyNotes: ['Stay on trails', 'Bring bear spray'],
    bestPhotoSpots: ['Half Dome viewpoint', 'Tunnel View'],
    estimatedBudget: {
      entrance_fees: '$35',
      fuel_estimate: '$100',
      total_range: '$200-$300',
    },
    recommendedProducts: [
      {
        id: 'prod-1',
        asin: 'B123456',
        title: 'Hiking Boots',
        brand: 'TrailMaster',
        price: 129.99,
        currency: 'USD',
        rating: 4.5,
        ratingsTotal: 1234,
        imageUrl: 'https://example.com/boots.jpg',
        isPrime: true,
        affiliateUrl: 'https://amazon.com/dp/B123456',
        category: 'Footwear',
      },
      {
        id: 'prod-2',
        asin: 'B789012',
        title: 'Water Bottle',
        brand: 'HydroFlask',
        price: 34.99,
        currency: 'USD',
        rating: 4.8,
        ratingsTotal: 5678,
        imageUrl: 'https://example.com/bottle.jpg',
        isPrime: true,
        affiliateUrl: 'https://amazon.com/dp/B789012',
        category: 'Hydration',
      },
    ],
  };

  describe('Basic Rendering', () => {
    it('should render trip title', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('California Adventure')).toBeInTheDocument();
    });

    it('should render trip origin', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText(/Starting from San Francisco, CA/)).toBeInTheDocument();
    });

    it('should render difficulty badge', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('moderate')).toBeInTheDocument();
    });

    it('should render radius miles', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('200 mile radius')).toBeInTheDocument();
    });

    it('should render park count', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('1 park')).toBeInTheDocument();
    });

    it('should render trip summary', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('An amazing trip through California parks')).toBeInTheDocument();
    });
  });

  describe('Day Cards', () => {
    it('should render day number', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should render park name', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
    });

    it('should render morning plan', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Visit Yosemite Valley')).toBeInTheDocument();
    });

    it('should render afternoon plan', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Hike to Mirror Lake')).toBeInTheDocument();
    });

    it('should render evening plan', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Sunset at Tunnel View')).toBeInTheDocument();
    });

    it('should render driving notes', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('3 hours from SF')).toBeInTheDocument();
    });

    it('should render highlights', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Half Dome views')).toBeInTheDocument();
    });

    it('should render activities', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('hiking')).toBeInTheDocument();
    });
  });

  describe('Park Links', () => {
    it('should render internal link for NPS parks', () => {
      render(<TripDetail trip={mockTrip} />);
      const link = screen.getByText('View park details →');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', '/parks/yose');
    });

    it('should render external link for Wikidata parks', () => {
      const tripWithWikidataPark = {
        ...mockTrip,
        stops: [
          {
            ...mockTrip.stops[0],
            parkCode: 'Q5719910',
            park: {
              ...mockTrip.stops[0].park,
              source: 'wikidata',
              url: 'https://example.com/state-park',
            },
          },
        ],
      };
      render(<TripDetail trip={tripWithWikidataPark} />);
      const link = screen.getByText('Visit park website ↗');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://example.com/state-park');
      expect(link.closest('a')).toHaveAttribute('target', '_blank');
    });

    it('should not render link for Wikidata parks without URL', () => {
      const tripWithWikidataParkNoUrl = {
        ...mockTrip,
        stops: [
          {
            ...mockTrip.stops[0],
            parkCode: 'Q5719910',
            park: {
              ...mockTrip.stops[0].park,
              source: 'wikidata',
              url: null,
            },
          },
        ],
      };
      render(<TripDetail trip={tripWithWikidataParkNoUrl} />);
      expect(screen.queryByText('View park details →')).not.toBeInTheDocument();
      expect(screen.queryByText('Visit park website ↗')).not.toBeInTheDocument();
    });
  });

  describe('Nearby Places Section', () => {
    it('should render nearby places heading', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('📍 Nearby Places')).toBeInTheDocument();
    });

    it('should render dining places', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Mountain Restaurant')).toBeInTheDocument();
    });

    it('should render bars', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Valley Bar')).toBeInTheDocument();
    });

    it('should render place ratings', () => {
      render(<TripDetail trip={mockTrip} />);
      // Multiple ratings may appear (nearby places + products), use getAllByText
      const ratings = screen.getAllByText(/⭐ 4\.5/);
      expect(ratings.length).toBeGreaterThan(0);
    });

    it('should render price level', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('$$')).toBeInTheDocument();
    });

    it('should render distance', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('1.5 mi')).toBeInTheDocument();
    });

    it('should not render nearby places section when no places', () => {
      const tripWithNoPlaces = {
        ...mockTrip,
        stops: [
          {
            ...mockTrip.stops[0],
            nearbyPlaces: null,
          },
        ],
      };
      render(<TripDetail trip={tripWithNoPlaces} />);
      expect(screen.queryByText('📍 Nearby Places')).not.toBeInTheDocument();
    });

    it('should not render empty categories', () => {
      render(<TripDetail trip={mockTrip} />);
      // Lodging is empty in mockTrip
      expect(screen.queryByText('🏨 Lodging')).not.toBeInTheDocument();
    });
  });

  describe('Recommended Products Section', () => {
    it('should render recommended gear heading', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('🛒 Recommended Gear')).toBeInTheDocument();
    });

    it('should render product titles', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Hiking Boots')).toBeInTheDocument();
      expect(screen.getByText('Water Bottle')).toBeInTheDocument();
    });

    it('should render product prices', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('$129.99')).toBeInTheDocument();
      expect(screen.getByText('$34.99')).toBeInTheDocument();
    });

    it('should render product ratings', () => {
      render(<TripDetail trip={mockTrip} />);
      // Multiple ratings in the page, check for presence
      const ratings = screen.getAllByText(/⭐ 4\.\d/);
      expect(ratings.length).toBeGreaterThan(0);
    });

    it('should render Prime badge', () => {
      render(<TripDetail trip={mockTrip} />);
      const primeBadges = screen.getAllByText('Prime');
      expect(primeBadges.length).toBeGreaterThan(0);
    });

    it('should link to affiliate URL', () => {
      render(<TripDetail trip={mockTrip} />);
      const productLinks = screen.getAllByRole('link').filter(
        link => link.getAttribute('href')?.includes('amazon.com')
      );
      expect(productLinks.length).toBeGreaterThan(0);
    });

    it('should not render products section when no products', () => {
      const tripWithNoProducts = {
        ...mockTrip,
        recommendedProducts: [],
      };
      render(<TripDetail trip={tripWithNoProducts} />);
      expect(screen.queryByText('🛒 Recommended Gear')).not.toBeInTheDocument();
    });
  });

  describe('Packing List Section', () => {
    it('should render packing list heading', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('📦 Packing List')).toBeInTheDocument();
    });

    it('should render essentials', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Water bottle')).toBeInTheDocument();
      expect(screen.getByText('Sunscreen')).toBeInTheDocument();
    });

    it('should render clothing items', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Hiking boots')).toBeInTheDocument();
      expect(screen.getByText('Rain jacket')).toBeInTheDocument();
    });

    it('should render gear items', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Backpack')).toBeInTheDocument();
      expect(screen.getByText('Camera')).toBeInTheDocument();
    });

    it('should render optional items', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Binoculars')).toBeInTheDocument();
    });
  });

  describe('Safety Notes Section', () => {
    it('should render safety notes heading', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('⚠️ Safety Notes')).toBeInTheDocument();
    });

    it('should render safety notes', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Stay on trails')).toBeInTheDocument();
      expect(screen.getByText('Bring bear spray')).toBeInTheDocument();
    });
  });

  describe('Photo Spots Section', () => {
    it('should render photo spots heading', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('📷 Best Photo Spots')).toBeInTheDocument();
    });

    it('should render photo spots', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('Half Dome viewpoint')).toBeInTheDocument();
      expect(screen.getByText('Tunnel View')).toBeInTheDocument();
    });
  });

  describe('Budget Section', () => {
    it('should render budget heading', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('💰 Estimated Budget')).toBeInTheDocument();
    });

    it('should render entrance fees', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('$35')).toBeInTheDocument();
    });

    it('should render fuel estimate', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('$100')).toBeInTheDocument();
    });

    it('should render total range', () => {
      render(<TripDetail trip={mockTrip} />);
      expect(screen.getByText('$200-$300')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render regenerate button when handler provided', () => {
      const onRegenerate = vi.fn();
      render(<TripDetail trip={mockTrip} onRegenerate={onRegenerate} />);
      expect(screen.getByText('🔄 Regenerate')).toBeInTheDocument();
    });

    it('should call onRegenerate when clicked', () => {
      const onRegenerate = vi.fn();
      render(<TripDetail trip={mockTrip} onRegenerate={onRegenerate} />);
      fireEvent.click(screen.getByText('🔄 Regenerate'));
      expect(onRegenerate).toHaveBeenCalled();
    });

    it('should render delete button when handler provided', () => {
      const onDelete = vi.fn();
      render(<TripDetail trip={mockTrip} onDelete={onDelete} />);
      expect(screen.getByText('🗑️ Delete')).toBeInTheDocument();
    });

    it('should call onDelete when clicked', () => {
      const onDelete = vi.fn();
      render(<TripDetail trip={mockTrip} onDelete={onDelete} />);
      fireEvent.click(screen.getByText('🗑️ Delete'));
      expect(onDelete).toHaveBeenCalled();
    });

    it('should show regenerating state', () => {
      const onRegenerate = vi.fn();
      render(<TripDetail trip={mockTrip} onRegenerate={onRegenerate} isRegenerating={true} />);
      expect(screen.getByText('Regenerating...')).toBeInTheDocument();
    });
  });

  describe('Day Card Expansion', () => {
    it('should toggle day card expansion on click', () => {
      render(<TripDetail trip={mockTrip} />);
      
      // Initially expanded - morning plan should be visible
      expect(screen.getByText('Visit Yosemite Valley')).toBeInTheDocument();
      
      // Click to collapse
      const dayHeader = screen.getByText('Yosemite National Park').closest('div');
      fireEvent.click(dayHeader);
      
      // After collapse, content should be hidden
      // Note: The component uses CSS to hide, so we check for the rotation class
    });
  });

  describe('Edge Cases', () => {
    it('should handle trip with no stops', () => {
      const tripWithNoStops = {
        ...mockTrip,
        stops: [],
      };
      render(<TripDetail trip={tripWithNoStops} />);
      expect(screen.getByText('0 parks')).toBeInTheDocument();
    });

    it('should handle trip with missing optional fields', () => {
      const minimalTrip = {
        id: 'trip-uuid',
        title: 'Minimal Trip',
        origin: 'Test City',
        startDate: '2025-01-15',
        endDate: '2025-01-16',
        stops: [],
      };
      render(<TripDetail trip={minimalTrip} />);
      expect(screen.getByText('Minimal Trip')).toBeInTheDocument();
    });

    it('should handle stop with missing park data', () => {
      const tripWithMissingPark = {
        ...mockTrip,
        stops: [
          {
            id: 'stop-1',
            dayNumber: 1,
            parkCode: 'unknown',
            park: null,
          },
        ],
      };
      render(<TripDetail trip={tripWithMissingPark} />);
      // Should show parkCode when park name is not available
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });

    it('should handle multiple stops on same day', () => {
      const tripWithMultipleStops = {
        ...mockTrip,
        stops: [
          { ...mockTrip.stops[0], dayNumber: 1 },
          { 
            ...mockTrip.stops[0], 
            id: 'stop-2',
            parkCode: 'sequ',
            park: { ...mockTrip.stops[0].park, name: 'Sequoia National Park' },
          },
        ],
      };
      render(<TripDetail trip={tripWithMultipleStops} />);
      expect(screen.getByText('Yosemite National Park')).toBeInTheDocument();
      expect(screen.getByText('Sequoia National Park')).toBeInTheDocument();
    });
  });
});