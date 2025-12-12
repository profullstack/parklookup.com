/**
 * Tests for State Local Parks Page
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
const mockStateData = {
  data: { id: '1', code: 'CA', name: 'California', slug: 'california' },
  error: null,
};

const mockCountiesData = {
  data: [
    {
      county_id: '1',
      counties: { id: '1', name: 'Los Angeles', slug: 'los-angeles' },
    },
    {
      county_id: '1',
      counties: { id: '1', name: 'Los Angeles', slug: 'los-angeles' },
    },
    {
      county_id: '2',
      counties: { id: '2', name: 'San Francisco', slug: 'san-francisco' },
    },
  ],
  error: null,
};

const mockParksData = {
  data: [
    {
      id: '1',
      name: 'Griffith Park',
      slug: 'griffith-park',
      park_type: 'county',
      managing_agency: 'LA County Parks',
      latitude: 34.1341,
      longitude: -118.2944,
      access: 'Open',
      states: { code: 'CA', name: 'California', slug: 'california' },
      counties: { name: 'Los Angeles', slug: 'los-angeles' },
      cities: null,
    },
    {
      id: '2',
      name: 'Golden Gate Park',
      slug: 'golden-gate-park',
      park_type: 'city',
      managing_agency: 'SF Recreation & Parks',
      latitude: 37.7694,
      longitude: -122.4862,
      access: 'Open',
      states: { code: 'CA', name: 'California', slug: 'california' },
      counties: { name: 'San Francisco', slug: 'san-francisco' },
      cities: { name: 'San Francisco', slug: 'san-francisco' },
    },
  ],
  count: 50,
  error: null,
};

const mockPhotosData = {
  data: [{ park_id: '1', thumb_url: 'https://example.com/thumb1.jpg' }],
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

// Mock next/navigation
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// Mock LocalParkCard
vi.mock('@/components/parks/LocalParkCard', () => ({
  default: ({ park }) => (
    <div data-testid="local-park-card" data-park-name={park.name}>
      {park.name}
    </div>
  ),
}));

describe('State Local Parks Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock that handles different queries
    const fromMock = vi.fn((tableName) => {
      if (tableName === 'states') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve(mockStateData)),
            })),
          })),
        };
      }
      if (tableName === 'local_parks') {
        return {
          select: vi.fn((fields, options) => {
            // Counties query
            if (fields.includes('county_id')) {
              return {
                eq: vi.fn(() => ({
                  not: vi.fn(() => Promise.resolve(mockCountiesData)),
                })),
              };
            }
            // Parks query with count
            return {
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve(mockParksData)),
                })),
              })),
            };
          }),
        };
      }
      if (tableName === 'park_photos') {
        return {
          select: vi.fn(() => ({
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
    it('should render the page title with state name', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      expect(screen.getByText(/Local Parks in California/i)).toBeInTheDocument();
    });

    it('should render the state code badge', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      expect(screen.getByText('CA')).toBeInTheDocument();
    });

    it('should render breadcrumb navigation', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Local Parks')).toBeInTheDocument();
    });

    it('should render Browse by County section', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      expect(screen.getByText('Browse by County')).toBeInTheDocument();
    });

    it('should render All Local Parks section', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      // Use getAllByText since "All Local Parks" appears in multiple places
      const allLocalParksElements = screen.getAllByText(/All Local Parks/i);
      expect(allLocalParksElements.length).toBeGreaterThan(0);
    });
  });

  describe('County Links', () => {
    it('should render county links', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      expect(screen.getByText('Los Angeles')).toBeInTheDocument();
      expect(screen.getByText('San Francisco')).toBeInTheDocument();
    });

    it('should link counties to /parks/county/[state]/[county]', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      const laLink = screen.getByText('Los Angeles').closest('a');
      expect(laLink).toHaveAttribute('href', '/parks/county/california/los-angeles');
    });

    it('should show park count for each county', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      // Los Angeles has 2 parks in mock data
      expect(screen.getByText('2 parks')).toBeInTheDocument();
      // San Francisco has 1 park
      expect(screen.getByText('1 park')).toBeInTheDocument();
    });
  });

  describe('Parks Grid', () => {
    it('should render LocalParkCard components', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      const parkCards = screen.getAllByTestId('local-park-card');
      expect(parkCards.length).toBe(2);
    });

    it('should show park names', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      expect(screen.getByText('Griffith Park')).toBeInTheDocument();
      expect(screen.getByText('Golden Gate Park')).toBeInTheDocument();
    });

    it('should show pagination info when more parks exist', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      // Total is 50, showing 2
      expect(screen.getByText(/Showing 2 of 50 parks/i)).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('should have Back to All Local Parks link', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      const backLink = screen.getByText('← Back to All Local Parks');
      expect(backLink.closest('a')).toHaveAttribute('href', '/parks/local');
    });

    it('should have View All State Parks link', async () => {
      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      const stateLink = screen.getByText(/View All California Parks/i);
      expect(stateLink.closest('a')).toHaveAttribute('href', '/states/california');
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no parks exist', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn((tableName) => {
          if (tableName === 'states') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve(mockStateData)),
                })),
              })),
            };
          }
          if (tableName === 'local_parks') {
            return {
              select: vi.fn((fields, options) => {
                if (fields.includes('county_id')) {
                  return {
                    eq: vi.fn(() => ({
                      not: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => Promise.resolve({ data: [], count: 0, error: null })),
                    })),
                  })),
                };
              }),
            };
          }
          if (tableName === 'park_photos') {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            };
          }
          return createChainableMock({ data: [], error: null });
        }),
      };

      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;
      render(await StateLocalParksPage({ params: Promise.resolve({ state: 'california' }) }));

      expect(screen.getByText('No Local Parks Yet')).toBeInTheDocument();
    });
  });

  describe('Not Found', () => {
    it('should call notFound when state does not exist', async () => {
      vi.resetModules();
      const notFoundMock = vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
      });
      vi.doMock('next/navigation', () => ({
        notFound: notFoundMock,
      }));

      mockSupabaseClient = {
        from: vi.fn((tableName) => {
          if (tableName === 'states') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } })),
                })),
              })),
            };
          }
          return createChainableMock({ data: [], error: null });
        }),
      };

      const StateLocalParksPage = (await import('@/app/parks/local/[state]/page.jsx')).default;

      await expect(
        StateLocalParksPage({ params: Promise.resolve({ state: 'invalid-state' }) })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });
  });

  describe('Metadata', () => {
    it('should generate correct metadata for valid state', async () => {
      const { generateMetadata } = await import('@/app/parks/local/[state]/page.jsx');

      const metadata = await generateMetadata({ params: Promise.resolve({ state: 'california' }) });

      expect(metadata.title).toBe('Local Parks in California | ParkLookup');
      expect(metadata.description).toContain('California');
    });

    it('should return not found metadata for invalid state', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn((tableName) => {
          if (tableName === 'states') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } })),
                })),
              })),
            };
          }
          return createChainableMock({ data: [], error: null });
        }),
      };

      const { generateMetadata } = await import('@/app/parks/local/[state]/page.jsx');

      const metadata = await generateMetadata({
        params: Promise.resolve({ state: 'invalid-state' }),
      });

      expect(metadata.title).toBe('State Not Found | ParkLookup');
    });
  });
});