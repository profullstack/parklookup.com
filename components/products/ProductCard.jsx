'use client';

import Image from 'next/image';

/**
 * ProductCard component - displays a single product with affiliate link
 *
 * @param {Object} props
 * @param {Object} props.product - Product data
 * @param {string} props.product.title - Product title
 * @param {string} props.product.brand - Product brand
 * @param {number} props.product.price - Product price
 * @param {string} props.product.currency - Currency code
 * @param {number} props.product.original_price - Original price (for showing discount)
 * @param {number} props.product.rating - Product rating (0-5)
 * @param {number} props.product.ratings_total - Total number of ratings
 * @param {string} props.product.main_image_url - Product image URL
 * @param {boolean} props.product.is_prime - Whether product has Prime shipping
 * @param {string} props.product.affiliate_url - Amazon affiliate URL
 */
export function ProductCard({ product }) {
  const {
    title,
    brand,
    price,
    currency = 'USD',
    original_price,
    rating,
    ratings_total,
    main_image_url,
    is_prime,
    affiliate_url,
  } = product;

  // Format price
  const formatPrice = (amount, curr) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
    }).format(amount);
  };

  // Calculate discount percentage
  const discountPercent =
    original_price && price && original_price > price
      ? Math.round(((original_price - price) / original_price) * 100)
      : null;

  // Render star rating
  const renderStars = (rating) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {/* Full stars */}
        {[...Array(fullStars)].map((_, i) => (
          <svg
            key={`full-${i}`}
            className="w-4 h-4 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        {/* Half star */}
        {hasHalfStar && (
          <svg
            className="w-4 h-4 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <defs>
              <linearGradient id="halfGradient">
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="#D1D5DB" />
              </linearGradient>
            </defs>
            <path
              fill="url(#halfGradient)"
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            />
          </svg>
        )}
        {/* Empty stars */}
        {[...Array(emptyStars)].map((_, i) => (
          <svg
            key={`empty-${i}`}
            className="w-4 h-4 text-gray-300 dark:text-gray-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        {ratings_total && (
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
            ({ratings_total.toLocaleString()})
          </span>
        )}
      </div>
    );
  };

  // Truncate title to reasonable length
  const truncatedTitle =
    title && title.length > 60 ? `${title.substring(0, 60)}...` : title;

  return (
    <a
      href={affiliate_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
        {main_image_url ? (
          <Image
            src={main_image_url}
            alt={title || 'Product image'}
            fill
            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Prime badge */}
        {is_prime && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
            Prime
          </div>
        )}

        {/* Discount badge */}
        {discountPercent && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded">
            -{discountPercent}%
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3">
        {/* Brand */}
        {brand && (
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {brand}
          </p>
        )}

        {/* Title */}
        <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
          {truncatedTitle}
        </h3>

        {/* Rating */}
        {rating && <div className="mb-2">{renderStars(rating)}</div>}

        {/* Price */}
        <div className="flex items-baseline gap-2">
          {price && (
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatPrice(price, currency)}
            </span>
          )}
          {original_price && original_price > price && (
            <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
              {formatPrice(original_price, currency)}
            </span>
          )}
        </div>

        {/* Shop button */}
        <div className="mt-3">
          <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400 font-medium group-hover:underline">
            Shop on Amazon
            <svg
              className="w-3 h-3 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * ProductCarousel component - displays a horizontal scrollable list of products
 */
export function ProductCarousel({ products, title = 'Recommended Gear', loading = false }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-40 sm:w-48 bg-white dark:bg-gray-800 rounded-lg shadow-sm animate-pulse"
            >
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-t-lg" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Affiliate links
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
        {products.map((product) => (
          <div
            key={product.id || product.asin}
            className="flex-shrink-0 w-40 sm:w-48 snap-start"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductCard;