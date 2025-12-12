/**
 * Tests for Local Parks Index Page
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Create a chainable mock builder for Supabase queries
const createChainableMock = (finalResult) => {
  const chainable = {
    select: vi.fn(() => chainable),
    from: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    not: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => Promise.resolve(finalResult)),
    single: vi.fn(() => Promise.resolve(finalResult)),
    then: vi.fn((resolve) => resolve(finalResult)),
  };
  return chainable;
};

// Mock data
const mockStatesData = {
  data: [
    { id: '1', code: 'CA', name: 'California', slug: 'california' },
    { id: '2', code: 'NY', name: 'New York', slug: 'new-york' },
  ],
  error: null,
};

// Mock park counts per state
const mockStateParkCounts = {
  1: 100, // California
  2: 50, // New York
};

const mockFeaturedParksData = {
  data: [
    {
      id: '1',
      name: 'Central Park',
      slug: 'central-park',
      park_type: 'city',
      managing_agency: 'NYC Parks',
      latitude: 40.7829,
      longitude: -73.9654,
      access: 'Open',
      states: { code: 'NY', name: 'New York', slug: 'new-york' },
      counties: { name: 'New York', slug: 'new-york' },
      cities: { name: 'New York City', slug: 'new-york-city' },
    },
    {
      id: '2',
      name: 'Griffith Park',
      slug: 'griffith-park',
      park_type: 'county',
      managing_agency: 'LA County',
      latitude: 34.1341,
      longitude: -118.2944,
      access: 'Open',
      states: { code: 'CA', name: 'California', slug: 'california' },
      counties: { name: 'Los Angeles', slug: 'los-angeles' },
      cities: null,
    },
  ],
  error: null,
};

const mockPhotosData = {
  data: [{ park_id: '1', thumb_url: 'https://example.com/thumb1.jpg' }],
  error: null,
};

const mockCountData = {
  count: 150,
  error: null,
};

// Mock Supabase client
let mockSupabaseClient;

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mockSupabaseClient),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock LocalParkCard
vi.mock('@/components/parks/LocalParkCard', () => ({
  default: ({ park }) => (
    <div data-testid="local-park-card" data-park-name={park.name}>
      {park.name}
    </div>
  ),
}));

describe('Local Parks Index Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock that handles different queries
    const fromMock = vi.fn((tableName) => {
      if (tableName === 'states') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve(mockStatesData)),
          })),
        };
      }
      if (tableName === 'local_parks') {
        return {
          select: vi.fn((fields, options) => {
            // Count query for total parks
            if (options?.count === 'exact' && options?.head === true) {
              return {
                eq: vi.fn((field, value) => {
                  // Per-state count query
                  if (field === 'state_id') {
                    const count = mockStateParkCounts[value] || 0;
                    return Promise.resolve({ count, error: null });
                  }
                  return Promise.resolve(mockCountData);
                }),
                then: vi.fn((resolve) => resolve(mockCountData)),
              };
            }
            // Featured parks query
            return {
              in: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve(mockFeaturedParksData)),
              })),
              limit: vi.fn(() => Promise.resolve(mockFeaturedParksData)),
            };
          }),
        };
      }
      if (tableName === 'park_photos') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [{ park_id: '1' }], error: null })),
            })),
            in: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve(mockPhotosData)),
            })),
          })),
        };
      }
      return createChainableMock({ data: [], error: null });
    });

    mockSupabaseClient = {
      from: fromMock,
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Page Rendering', () => {
    it('should render the page title', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText('County & City Parks')).toBeInTheDocument();
    });

    it('should render the hero section with park count', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText(/local parks across America/i)).toBeInTheDocument();
    });

    it('should render County Parks and City Parks buttons', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      // Multiple instances of these texts exist on the page
      const countyParksElements = screen.getAllByText('County Parks');
      const cityParksElements = screen.getAllByText('City Parks');
      expect(countyParksElements.length).toBeGreaterThan(0);
      expect(cityParksElements.length).toBeGreaterThan(0);
    });

    it('should link County Parks button to /parks/county', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      // Find the hero button (first link with County Parks text)
      const countyLinks = screen.getAllByText('County Parks');
      const heroCountyLink = countyLinks[0].closest('a');
      expect(heroCountyLink).toHaveAttribute('href', '/parks/county');
    });

    it('should link City Parks button to /parks/city', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      // Find the hero button (first link with City Parks text)
      const cityLinks = screen.getAllByText('City Parks');
      const heroCityLink = cityLinks[0].closest('a');
      expect(heroCityLink).toHaveAttribute('href', '/parks/city');
    });

    it('should render Browse by State section', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText('Browse by State')).toBeInTheDocument();
    });

    it('should render Types of Local Parks section', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText('Types of Local Parks')).toBeInTheDocument();
    });
  });

  describe('State Links', () => {
    it('should render state links when states have parks', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      // Check for state codes
      const caLinks = screen.getAllByText('CA');
      expect(caLinks.length).toBeGreaterThan(0);
    });

    it('should show empty message when no states have parks', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn((tableName) => {
          if (tableName === 'states') {
            return {
              select: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            };
          }
          if (tableName === 'local_parks') {
            return {
              select: vi.fn((fields, options) => {
                if (options?.count === 'exact' && options?.head === true) {
                  return {
                    eq: vi.fn(() => Promise.resolve({ count: 0, error: null })),
                    then: vi.fn((resolve) => resolve({ count: 0, error: null })),
                  };
                }
                return {
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                };
              }),
            };
          }
          if (tableName === 'park_photos') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            };
          }
          return createChainableMock({ data: [], error: null });
        }),
      };

      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText(/No local parks have been imported yet/i)).toBeInTheDocument();
    });
  });

  describe('Featured Parks', () => {
    it('should render Featured Local Parks section when parks exist', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText('Featured Local Parks')).toBeInTheDocument();
    });

    it('should render LocalParkCard components for featured parks', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      const parkCards = screen.getAllByTestId('local-park-card');
      expect(parkCards.length).toBeGreaterThan(0);
    });
  });

  describe('Park Type Info Cards', () => {
    it('should render County Parks info card', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      // Find the heading within the info cards section
      const countyHeadings = screen.getAllByRole('heading', { name: 'County Parks' });
      expect(countyHeadings.length).toBeGreaterThan(0);
    });

    it('should render City Parks info card', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      // Find the heading within the info cards section
      const cityHeadings = screen.getAllByRole('heading', { name: 'City Parks' });
      expect(cityHeadings.length).toBeGreaterThan(0);
    });

    it('should have Browse County Parks link', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText('Browse County Parks')).toBeInTheDocument();
    });

    it('should have Browse City Parks link', async () => {
      const LocalParksPage = (await import('@/app/parks/local/page.jsx')).default;
      render(await LocalParksPage());

      expect(screen.getByText('Browse City Parks')).toBeInTheDocument();
    });
  });

  describe('Metadata', () => {
    it('should export correct metadata', async () => {
      const { metadata } = await import('@/app/parks/local/page.jsx');

      expect(metadata.title).toBe('County & City Parks | ParkLookup');
      expect(metadata.description).toContain('county and city parks');
    });
  });
});