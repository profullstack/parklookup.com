/**
 * Tests for Rainforest API client
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Rainforest API Client', () => {
  const mockSearchResponse = {
    request_info: {
      success: true,
    },
    search_information: {
      total_results: 1000,
    },
    search_results: [
      {
        asin: 'B0748HGDVD',
        title: 'Coleman Sundome Camping Tent',
        brand: 'Coleman',
        price: {
          value: 89.99,
          currency: 'USD',
        },
        rating: 4.5,
        ratings_total: 12500,
        reviews_total: 8000,
        image: 'https://m.media-amazon.com/images/I/tent.jpg',
        is_prime: true,
        availability: {
          raw: 'In Stock',
        },
      },
      {
        asin: 'B07FKCTM7X',
        title: 'Osprey Atmos AG 65 Backpack',
        brand: 'Osprey',
        price: {
          value: 270.0,
          currency: 'USD',
          before_price: {
            value: 300.0,
          },
        },
        rating: 4.8,
        ratings_total: 5000,
        reviews_total: 3000,
        image: 'https://m.media-amazon.com/images/I/backpack.jpg',
        is_prime: true,
        availability: {
          raw: 'In Stock',
        },
      },
    ],
    pagination: {
      current_page: 1,
      total_pages: 20,
    },
  };

  const mockProductResponse = {
    request_info: {
      success: true,
    },
    product: {
      asin: 'B0748HGDVD',
      title: 'Coleman Sundome Camping Tent',
      brand: 'Coleman',
      description: 'Easy setup camping tent with weatherproof design',
      feature_bullets: [
        'Easy 10-minute setup',
        'WeatherTec system',
        'Fits 4 people',
      ],
      main_image: {
        link: 'https://m.media-amazon.com/images/I/tent-main.jpg',
      },
      images: [
        { link: 'https://m.media-amazon.com/images/I/tent-1.jpg' },
        { link: 'https://m.media-amazon.com/images/I/tent-2.jpg' },
      ],
      buybox_winner: {
        price: {
          value: 89.99,
          currency: 'USD',
        },
        rrp: {
          value: 109.99,
        },
        is_prime: true,
        availability: {
          raw: 'In Stock',
        },
      },
      rating: 4.5,
      ratings_total: 12500,
      reviews_total: 8000,
      specifications_flat: [
        { name: 'Capacity', value: '4 Person' },
        { name: 'Weight', value: '9.5 lbs' },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RAINFOREST_API_KEY', 'test-api-key');
    vi.stubEnv('AMAZON_TAG', 'test-tag-20');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('buildAffiliateUrl', () => {
    it('should build affiliate URL with correct tag', async () => {
      const { buildAffiliateUrl } = await import('@/lib/api/rainforest.js');
      const url = buildAffiliateUrl('B0748HGDVD');

      expect(url).toBe('https://www.amazon.com/dp/B0748HGDVD?tag=test-tag-20');
    });

    it('should use default tag when AMAZON_TAG is not set', async () => {
      vi.stubEnv('AMAZON_TAG', '');

      // Re-import to get fresh module
      vi.resetModules();
      const { buildAffiliateUrl } = await import('@/lib/api/rainforest.js');
      const url = buildAffiliateUrl('B0748HGDVD');

      expect(url).toBe('https://www.amazon.com/dp/B0748HGDVD?tag=parklookup-20');
    });
  });

  describe('searchProducts', () => {
    it('should search products with correct parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      });

      const { searchProducts } = await import('@/lib/api/rainforest.js');
      const result = await searchProducts('camping tent');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api_key=test-api-key')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=search')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search_term=camping+tent')
      );
      expect(result.products).toHaveLength(2);
      expect(result.totalResults).toBe(1000);
    });

    it('should handle pagination parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      });

      const { searchProducts } = await import('@/lib/api/rainforest.js');
      await searchProducts('camping tent', { page: 2 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
    });

    it('should handle sort parameter', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      });

      const { searchProducts } = await import('@/lib/api/rainforest.js');
      await searchProducts('camping tent', { sortBy: 'price_low_to_high' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sort_by=price_low_to_high')
      );
    });

    it('should throw error when API returns non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const { searchProducts } = await import('@/lib/api/rainforest.js');

      await expect(searchProducts('camping tent')).rejects.toThrow(
        'Rainforest API error (401)'
      );
    });

    it('should throw error when API returns success: false', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            request_info: {
              success: false,
              message: 'Invalid API key',
            },
          }),
      });

      const { searchProducts } = await import('@/lib/api/rainforest.js');

      await expect(searchProducts('camping tent')).rejects.toThrow(
        'Rainforest API request failed'
      );
    });

    it('should throw error when RAINFOREST_API_KEY is not set', async () => {
      vi.stubEnv('RAINFOREST_API_KEY', '');
      vi.resetModules();

      const { searchProducts } = await import('@/lib/api/rainforest.js');

      await expect(searchProducts('camping tent')).rejects.toThrow(
        'RAINFOREST_API_KEY environment variable is not set'
      );
    });
  });

  describe('getProductDetails', () => {
    it('should fetch product details by ASIN', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProductResponse),
      });

      const { getProductDetails } = await import('@/lib/api/rainforest.js');
      const result = await getProductDetails('B0748HGDVD');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=product')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('asin=B0748HGDVD')
      );
      expect(result.asin).toBe('B0748HGDVD');
      expect(result.title).toBe('Coleman Sundome Camping Tent');
    });

    it('should return null when product not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            request_info: { success: true },
            product: null,
          }),
      });

      const { getProductDetails } = await import('@/lib/api/rainforest.js');
      const result = await getProductDetails('INVALID123');

      expect(result).toBeNull();
    });
  });

  describe('transformSearchProduct', () => {
    it('should transform search result to database format', async () => {
      const { transformSearchProduct } = await import('@/lib/api/rainforest.js');
      const transformed = transformSearchProduct(
        mockSearchResponse.search_results[0],
        'camping tent'
      );

      expect(transformed).toEqual({
        asin: 'B0748HGDVD',
        title: 'Coleman Sundome Camping Tent',
        description: null,
        brand: 'Coleman',
        price: 89.99,
        currency: 'USD',
        original_price: null,
        rating: 4.5,
        ratings_total: 12500,
        reviews_total: 8000,
        main_image_url: 'https://m.media-amazon.com/images/I/tent.jpg',
        images: [],
        is_prime: true,
        availability: 'In Stock',
        affiliate_url: 'https://www.amazon.com/dp/B0748HGDVD?tag=test-tag-20',
        search_term: 'camping tent',
        raw_data: mockSearchResponse.search_results[0],
      });
    });

    it('should handle product with discount', async () => {
      const { transformSearchProduct } = await import('@/lib/api/rainforest.js');
      const transformed = transformSearchProduct(
        mockSearchResponse.search_results[1],
        'backpack'
      );

      expect(transformed.price).toBe(270.0);
      expect(transformed.original_price).toBe(300.0);
    });

    it('should handle missing optional fields', async () => {
      const { transformSearchProduct } = await import('@/lib/api/rainforest.js');
      const minimalProduct = {
        asin: 'TEST123',
        title: 'Test Product',
      };

      const transformed = transformSearchProduct(minimalProduct, 'test');

      expect(transformed.asin).toBe('TEST123');
      expect(transformed.title).toBe('Test Product');
      expect(transformed.brand).toBeNull();
      expect(transformed.price).toBeNull();
      expect(transformed.rating).toBeNull();
    });
  });

  describe('transformProductDetails', () => {
    it('should transform product details to database format', async () => {
      const { transformProductDetails } = await import('@/lib/api/rainforest.js');
      const transformed = transformProductDetails(
        mockProductResponse.product,
        'camping tent'
      );

      expect(transformed.asin).toBe('B0748HGDVD');
      expect(transformed.title).toBe('Coleman Sundome Camping Tent');
      expect(transformed.description).toContain('Easy 10-minute setup');
      expect(transformed.price).toBe(89.99);
      expect(transformed.original_price).toBe(109.99);
      expect(transformed.main_image_url).toBe(
        'https://m.media-amazon.com/images/I/tent-main.jpg'
      );
      expect(transformed.images).toHaveLength(2);
      expect(transformed.features).toHaveLength(3);
      expect(transformed.specifications).toEqual({
        Capacity: '4 Person',
        Weight: '9.5 lbs',
      });
    });

    it('should handle product without buybox_winner', async () => {
      const { transformProductDetails } = await import('@/lib/api/rainforest.js');
      const productWithoutBuybox = {
        ...mockProductResponse.product,
        buybox_winner: null,
      };

      const transformed = transformProductDetails(productWithoutBuybox, 'test');

      expect(transformed.price).toBeNull();
      expect(transformed.is_prime).toBe(false);
    });
  });

  describe('CAMPING_SEARCH_TERMS', () => {
    it('should export predefined camping search terms', async () => {
      const { CAMPING_SEARCH_TERMS } = await import('@/lib/api/rainforest.js');

      expect(Array.isArray(CAMPING_SEARCH_TERMS)).toBe(true);
      expect(CAMPING_SEARCH_TERMS.length).toBeGreaterThan(0);
      expect(CAMPING_SEARCH_TERMS).toContain('camping gear essentials');
      expect(CAMPING_SEARCH_TERMS).toContain('hiking backpack');
    });
  });

  describe('ACTIVITY_SEARCH_TERMS', () => {
    it('should export activity-specific search terms', async () => {
      const { ACTIVITY_SEARCH_TERMS } = await import('@/lib/api/rainforest.js');

      expect(typeof ACTIVITY_SEARCH_TERMS).toBe('object');
      expect(ACTIVITY_SEARCH_TERMS.camping).toBeDefined();
      expect(ACTIVITY_SEARCH_TERMS.hiking).toBeDefined();
      expect(ACTIVITY_SEARCH_TERMS.fishing).toBeDefined();
      expect(Array.isArray(ACTIVITY_SEARCH_TERMS.camping)).toBe(true);
    });
  });
});