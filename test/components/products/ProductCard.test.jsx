/**
 * ProductCard Component Tests
 * Tests for the product card and carousel components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard, ProductCarousel } from '@/components/products/ProductCard';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

describe('ProductCard', () => {
  const mockProduct = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render product title', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByText(/Coleman Sundome Camping Tent/i)).toBeInTheDocument();
    });

    it('should render product brand', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByText('Coleman')).toBeInTheDocument();
    });

    it('should render product price', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByText('$89.99')).toBeInTheDocument();
    });

    it('should render original price when discounted', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByText('$109.99')).toBeInTheDocument();
    });

    it('should render product image', () => {
      render(<ProductCard product={mockProduct} />);

      const image = screen.getByAltText('Coleman Sundome Camping Tent');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', mockProduct.main_image_url);
    });

    it('should render Prime badge when product is Prime', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByText('Prime')).toBeInTheDocument();
    });

    it('should not render Prime badge when product is not Prime', () => {
      const nonPrimeProduct = { ...mockProduct, is_prime: false };
      render(<ProductCard product={nonPrimeProduct} />);

      expect(screen.queryByText('Prime')).not.toBeInTheDocument();
    });

    it('should render discount badge when product has discount', () => {
      render(<ProductCard product={mockProduct} />);

      // 109.99 -> 89.99 is about 18% off
      expect(screen.getByText(/-18%/)).toBeInTheDocument();
    });

    it('should not render discount badge when no original price', () => {
      const noDiscountProduct = { ...mockProduct, original_price: null };
      render(<ProductCard product={noDiscountProduct} />);

      expect(screen.queryByText(/-%/)).not.toBeInTheDocument();
    });

    it('should render star rating', () => {
      render(<ProductCard product={mockProduct} />);

      // Should have rating stars (SVG elements)
      const svgs = document.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('should render ratings count', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByText('(12,500)')).toBeInTheDocument();
    });

    it('should render "Shop on Amazon" link text', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByText('Shop on Amazon')).toBeInTheDocument();
    });
  });

  describe('Affiliate Link', () => {
    it('should link to affiliate URL', () => {
      render(<ProductCard product={mockProduct} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', mockProduct.affiliate_url);
    });

    it('should open link in new tab', () => {
      render(<ProductCard product={mockProduct} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('should have noopener noreferrer sponsored rel attribute', () => {
      render(<ProductCard product={mockProduct} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer sponsored');
    });
  });

  describe('Missing Data Handling', () => {
    it('should handle missing brand', () => {
      const productWithoutBrand = { ...mockProduct, brand: null };
      render(<ProductCard product={productWithoutBrand} />);

      expect(screen.getByText(/Coleman Sundome/)).toBeInTheDocument();
    });

    it('should handle missing price', () => {
      const productWithoutPrice = { ...mockProduct, price: null };
      render(<ProductCard product={productWithoutPrice} />);

      expect(screen.queryByText('$89.99')).not.toBeInTheDocument();
    });

    it('should handle missing rating', () => {
      const productWithoutRating = { ...mockProduct, rating: null };
      render(<ProductCard product={productWithoutRating} />);

      // Should still render without crashing
      expect(screen.getByText(/Coleman Sundome/)).toBeInTheDocument();
    });

    it('should handle missing image', () => {
      const productWithoutImage = { ...mockProduct, main_image_url: null };
      render(<ProductCard product={productWithoutImage} />);

      // Should render placeholder
      expect(screen.queryByAltText('Coleman Sundome Camping Tent')).not.toBeInTheDocument();
    });

    it('should truncate long titles', () => {
      const longTitleProduct = {
        ...mockProduct,
        title:
          'This is a very long product title that should be truncated because it exceeds the maximum length allowed for display',
      };
      render(<ProductCard product={longTitleProduct} />);

      // Title should be truncated with ellipsis
      const titleElement = screen.getByText(/This is a very long product title/);
      expect(titleElement.textContent).toContain('...');
    });
  });

  describe('Star Rating Display', () => {
    it('should display correct number of full stars for rating 4.5', () => {
      render(<ProductCard product={mockProduct} />);

      // 4.5 rating = 4 full stars + 1 half star
      const yellowStars = document.querySelectorAll('svg.text-yellow-400');
      expect(yellowStars.length).toBe(5); // 4 full + 1 half
    });

    it('should display correct stars for rating 3.0', () => {
      const threeStarProduct = { ...mockProduct, rating: 3.0 };
      render(<ProductCard product={threeStarProduct} />);

      // Should have 3 full stars and 2 empty stars
      const yellowStars = document.querySelectorAll('svg.text-yellow-400');
      const grayStars = document.querySelectorAll('svg.text-gray-300');
      expect(yellowStars.length).toBe(3);
      expect(grayStars.length).toBe(2);
    });

    it('should display correct stars for rating 5.0', () => {
      const fiveStarProduct = { ...mockProduct, rating: 5.0 };
      render(<ProductCard product={fiveStarProduct} />);

      const yellowStars = document.querySelectorAll('svg.text-yellow-400');
      expect(yellowStars.length).toBe(5);
    });
  });
});

describe('ProductCarousel', () => {
  const mockProducts = [
    {
      id: '1',
      asin: 'B0748HGDVD',
      title: 'Coleman Tent',
      brand: 'Coleman',
      price: 89.99,
      currency: 'USD',
      rating: 4.5,
      ratings_total: 12500,
      main_image_url: 'https://example.com/tent.jpg',
      is_prime: true,
      affiliate_url: 'https://amazon.com/dp/B0748HGDVD?tag=test',
    },
    {
      id: '2',
      asin: 'B07FKCTM7X',
      title: 'Osprey Backpack',
      brand: 'Osprey',
      price: 270.0,
      currency: 'USD',
      rating: 4.8,
      ratings_total: 5000,
      main_image_url: 'https://example.com/backpack.jpg',
      is_prime: true,
      affiliate_url: 'https://amazon.com/dp/B07FKCTM7X?tag=test',
    },
    {
      id: '3',
      asin: 'B08XYZ1234',
      title: 'Camping Lantern',
      brand: 'Generic',
      price: 24.99,
      currency: 'USD',
      rating: 4.2,
      ratings_total: 800,
      main_image_url: 'https://example.com/lantern.jpg',
      is_prime: false,
      affiliate_url: 'https://amazon.com/dp/B08XYZ1234?tag=test',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render carousel title', () => {
      render(<ProductCarousel products={mockProducts} title="Recommended Gear" />);

      expect(screen.getByText('Recommended Gear')).toBeInTheDocument();
    });

    it('should render custom title', () => {
      render(<ProductCarousel products={mockProducts} title="Gear Up for Your Visit" />);

      expect(screen.getByText('Gear Up for Your Visit')).toBeInTheDocument();
    });

    it('should render all products', () => {
      render(<ProductCarousel products={mockProducts} />);

      expect(screen.getByText(/Coleman Tent/)).toBeInTheDocument();
      expect(screen.getByText(/Osprey Backpack/)).toBeInTheDocument();
      expect(screen.getByText(/Camping Lantern/)).toBeInTheDocument();
    });

    it('should render affiliate links disclaimer', () => {
      render(<ProductCarousel products={mockProducts} />);

      expect(screen.getByText('Affiliate links')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render loading skeleton when loading', () => {
      render(<ProductCarousel products={[]} loading={true} />);

      // Should have skeleton elements with animate-pulse class
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render title even when loading', () => {
      render(<ProductCarousel products={[]} loading={true} title="Loading Products" />);

      expect(screen.getByText('Loading Products')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should return null when no products and not loading', () => {
      const { container } = render(<ProductCarousel products={[]} loading={false} />);

      expect(container.firstChild).toBeNull();
    });

    it('should return null when products is undefined', () => {
      const { container } = render(<ProductCarousel products={undefined} loading={false} />);

      expect(container.firstChild).toBeNull();
    });

    it('should return null when products is null', () => {
      const { container } = render(<ProductCarousel products={null} loading={false} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Product Cards', () => {
    it('should render ProductCard for each product', () => {
      render(<ProductCarousel products={mockProducts} />);

      const links = screen.getAllByRole('link');
      expect(links.length).toBe(mockProducts.length);
    });

    it('should pass correct props to ProductCard', () => {
      render(<ProductCarousel products={mockProducts} />);

      // Check that product data is rendered correctly
      expect(screen.getByText('$89.99')).toBeInTheDocument();
      expect(screen.getByText('$270.00')).toBeInTheDocument();
      expect(screen.getByText('$24.99')).toBeInTheDocument();
    });
  });

  describe('Scrollable Container', () => {
    it('should have horizontal scroll container', () => {
      render(<ProductCarousel products={mockProducts} />);

      // Find the scrollable container
      const scrollContainer = document.querySelector('.overflow-x-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('should have snap scroll behavior', () => {
      render(<ProductCarousel products={mockProducts} />);

      const scrollContainer = document.querySelector('.snap-x');
      expect(scrollContainer).toBeInTheDocument();
    });
  });
});