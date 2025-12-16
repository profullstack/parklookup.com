/**
 * Tests for Products API endpoint
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  or: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  limit: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
};

// Mock the createServiceClient from lib/supabase/server
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mockSupabaseClient),
}));

describe('Products API Route', () => {
  const mockProducts = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      asin: 'B0748HGDVD',
      title: 'Coleman Sundome Camping Tent',
      brand: 'Coleman',
      price: 89.99,
      currency: 'USD',
      original_price: 109.99,
      rating: 4.5,
      ratings_total: 12500,
      main_image_url: 'https://m.media-amazon.com/images/I/tent.jpg',
      is_prime: true,
      affiliate_url: 'https://www.amazon.com/dp/B0748HGDVD?tag=parklookup-20',
      category_id: 'cat-123',
      product_categories: {
        name: 'Tents & Shelters',
        slug: 'tents-shelters',
      },
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      asin: 'B07FKCTM7X',
      title: 'Osprey Atmos AG 65 Backpack',
      brand: 'Osprey',
      price: 270.0,
      currency: 'USD',
      original_price: 300.0,
      rating: 4.8,
      ratings_total: 5000,
      main_image_url: 'https://m.media-amazon.com/images/I/backpack.jpg',
      is_prime: true,
      affiliate_url: 'https://www.amazon.com/dp/B07FKCTM7X?tag=parklookup-20',
      category_id: 'cat-456',
      product_categories: {
        name: 'Backpacks & Bags',
        slug: 'backpacks-bags',
      },
    },
    {
      id: '323e4567-e89b-12d3-a456-426614174002',
      asin: 'B08XYZ1234',
      title: 'Camping Lantern LED',
      brand: 'Generic',
      price: 24.99,
      currency: 'USD',
      original_price: null,
      rating: 4.2,
      ratings_total: 800,
      main_image_url: 'https://m.media-amazon.com/images/I/lantern.jpg',
      is_prime: false,
      affiliate_url: 'https://www.amazon.com/dp/B08XYZ1234?tag=parklookup-20',
      category_id: 'cat-789',
      product_categories: {
        name: 'Lighting',
        slug: 'lighting',
      },
    },
  ];

  const mockCategories = [
    { id: 'cat-123', slug: 'tents-shelters' },
    { id: 'cat-456', slug: 'backpacks-bags' },
    { id: 'cat-789', slug: 'lighting' },
  ];

  const mockActivityProducts = [
    { product_id: '123e4567-e89b-12d3-a456-426614174000' },
    { product_id: '223e4567-e89b-12d3-a456-426614174001' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');

    // Reset mock chain
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.or.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.limit.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.in.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('GET /api/products', () => {
    it('should return products with default limit', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockProducts.slice(0, 2),
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toBeDefined();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should respect limit parameter', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockProducts.slice(0, 1),
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products?limit=5');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.limit).toHaveBeenCalled();
    });

    it('should filter by category when provided', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: mockCategories[0],
        error: null,
      });
      mockSupabaseClient.limit.mockResolvedValue({
        data: [mockProducts[0]],
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request(
        'http://localhost:3000/api/products?category=tents-shelters'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('product_categories');
    });

    it('should filter by search term when provided', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: [mockProducts[0]],
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request(
        'http://localhost:3000/api/products?search=tent'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.or).toHaveBeenCalledWith(
        expect.stringContaining('tent')
      );
    });

    it('should return random products when random=true', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request(
        'http://localhost:3000/api/products?random=true&limit=2'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toBeDefined();
      // Random should fetch more products than limit
      expect(mockSupabaseClient.limit).toHaveBeenCalled();
    });

    it('should filter by activity when provided', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      // Mock activity_products query
      const mockActivityQuery = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockActivityProducts,
          error: null,
        }),
      };

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request(
        'http://localhost:3000/api/products?activity=camping'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should return 500 when database error occurs', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch products');
    });

    it('should return 500 when createServiceClient throws', async () => {
      // Import the mock to make it throw
      const { createServiceClient } = await import('@/lib/supabase/server');
      createServiceClient.mockImplementationOnce(() => {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should order products by rating descending', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products');
      await GET(request);

      expect(mockSupabaseClient.order).toHaveBeenCalledWith('rating', {
        ascending: false,
        nullsFirst: false,
      });
    });

    it('should include product category in response', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        expect.stringContaining('product_categories')
      );
    });
  });

  describe('Response format', () => {
    it('should return products array in response', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('products');
      expect(Array.isArray(data.products)).toBe(true);
    });

    it('should return empty array when no products found', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const { GET } = await import('@/app/api/products/route.js');
      const request = new Request('http://localhost:3000/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toEqual([]);
    });
  });
});