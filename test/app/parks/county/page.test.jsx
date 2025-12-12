/**
 * Tests for County Parks Index Page
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
    {
      state_id: '1',
      states: { id: '1', code: 'CA', name: 'California', slug: 'california' },
    },
    {
      state_id: '1',
      states: { id: '1', code: 'CA', name: 'California', slug: 'california' },
    },
    {
      state_id: '2',
      states: { id: '2', code: 'NY', name: 'New York', slug: 'new-york' },
    },
  ],
  error: null,
};

const mockCountData = {
  count: 75,
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

describe('County Parks Index Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock that handles different queries
    const fromMock = vi.fn((tableName) => {
      if (tableName === 'local_parks') {
        return {
          select: vi.fn((fields, options) => {
            // Count query
            if (options?.count === 'exact' && options?.head === true) {
              return {
                eq: vi.fn(() => Promise.resolve(mockCountData)),
              };
            }
            // States query (has states!inner)
            if (fields.includes('state_id')) {
              return {
                eq: vi.fn(() => ({
                  not: vi.fn(() => Promise.resolve(mockStatesData)),
                })),
              };
            }
            return createChainableMock({ data: [], error: null });
          }),
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
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      expect(screen.getByRole('heading', { name: 'County Parks' })).toBeInTheDocument();
    });

    it('should render the hero section with park count', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      expect(screen.getByText(/county parks across/i)).toBeInTheDocument();
    });

    it('should render Back to All Local Parks link', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      const backLink = screen.getByText('← Back to All Local Parks');
      expect(backLink).toBeInTheDocument();
      expect(backLink.closest('a')).toHaveAttribute('href', '/parks/local');
    });

    it('should render Browse by State section', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      expect(screen.getByText('Browse by State')).toBeInTheDocument();
    });

    it('should render About County Parks section', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      expect(screen.getByText('About County Parks')).toBeInTheDocument();
    });
  });

  describe('State Links', () => {
    it('should render state links when states have county parks', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      // Check for state codes
      const caLinks = screen.getAllByText('CA');
      expect(caLinks.length).toBeGreaterThan(0);
    });

    it('should link states to /parks/county/[state]', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      // Find California link
      const californiaLink = screen.getByText('California').closest('a');
      expect(californiaLink).toHaveAttribute('href', '/parks/county/california');
    });

    it('should show park count for each state', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      // Should show "2 parks" for California (2 entries in mock data)
      expect(screen.getByText('2 parks')).toBeInTheDocument();
    });

    it('should show empty message when no states have county parks', async () => {
      vi.resetModules();
      mockSupabaseClient = {
        from: vi.fn((tableName) => {
          if (tableName === 'local_parks') {
            return {
              select: vi.fn((fields, options) => {
                if (options?.count === 'exact') {
                  return {
                    eq: vi.fn(() => Promise.resolve({ count: 0, error: null })),
                  };
                }
                if (fields.includes('state_id')) {
                  return {
                    eq: vi.fn(() => ({
                      not: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                  };
                }
                return createChainableMock({ data: [], error: null });
              }),
            };
          }
          return createChainableMock({ data: [], error: null });
        }),
      };

      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      expect(screen.getByText('No County Parks Yet')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('should have Browse City Parks link', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      const cityParksLink = screen.getByText('Browse City Parks');
      expect(cityParksLink.closest('a')).toHaveAttribute('href', '/parks/city');
    });

    it('should have All Parks link', async () => {
      const CountyParksPage = (await import('@/app/parks/county/page.jsx')).default;
      render(await CountyParksPage());

      const allParksLink = screen.getByText('All Parks');
      expect(allParksLink.closest('a')).toHaveAttribute('href', '/parks');
    });
  });

  describe('Metadata', () => {
    it('should export correct metadata', async () => {
      const { metadata } = await import('@/app/parks/county/page.jsx');

      expect(metadata.title).toBe('County Parks by State | ParkLookup');
      expect(metadata.description).toContain('county parks');
    });
  });
});