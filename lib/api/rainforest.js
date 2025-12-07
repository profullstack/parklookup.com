/**
 * Rainforest API Client
 *
 * This module provides functions to interact with the Rainforest API
 * for fetching Amazon product data.
 *
 * @see https://www.rainforestapi.com/docs
 */

const RAINFOREST_API_BASE = 'https://api.rainforestapi.com/request';
const DEFAULT_AMAZON_DOMAIN = 'amazon.com';

/**
 * Get the Rainforest API key from environment variables
 * @returns {string} The API key
 * @throws {Error} If API key is not configured
 */
const getApiKey = () => {
  const apiKey = process.env.RAINFOREST_API_KEY;
  if (!apiKey) {
    throw new Error('RAINFOREST_API_KEY environment variable is not set');
  }
  return apiKey;
};

/**
 * Get the Amazon affiliate tag from environment variables
 * @returns {string} The affiliate tag
 */
const getAmazonTag = () => {
  return process.env.AMAZON_TAG || 'parklookup-20';
};

/**
 * Build the affiliate URL for a product
 * @param {string} asin - The Amazon Standard Identification Number
 * @returns {string} The affiliate URL
 */
export const buildAffiliateUrl = (asin) => {
  const tag = getAmazonTag();
  return `https://www.amazon.com/dp/${asin}?tag=${tag}`;
};

/**
 * Make a request to the Rainforest API
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} The API response
 * @throws {Error} If the request fails
 */
const makeRequest = async (params) => {
  const apiKey = getApiKey();
  const url = new URL(RAINFOREST_API_BASE);

  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('amazon_domain', DEFAULT_AMAZON_DOMAIN);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Rainforest API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (data.request_info?.success === false) {
    throw new Error(
      `Rainforest API request failed: ${data.request_info?.message || 'Unknown error'}`
    );
  }

  return data;
};

/**
 * Search for products on Amazon
 * @param {string} searchTerm - The search query
 * @param {Object} options - Search options
 * @param {number} [options.page=1] - Page number (1-10)
 * @param {string} [options.sortBy] - Sort order (e.g., 'price_low_to_high', 'price_high_to_low', 'reviews', 'featured')
 * @param {string} [options.category] - Amazon category ID
 * @returns {Promise<Object>} Search results with products array
 */
export const searchProducts = async (searchTerm, options = {}) => {
  const { page = 1, sortBy, category } = options;

  const params = {
    type: 'search',
    search_term: searchTerm,
    page: page.toString(),
  };

  if (sortBy) {
    params.sort_by = sortBy;
  }

  if (category) {
    params.category_id = category;
  }

  const data = await makeRequest(params);

  return {
    searchTerm,
    page,
    totalResults: data.search_information?.total_results || 0,
    products: data.search_results || [],
    pagination: data.pagination || {},
  };
};

/**
 * Get detailed product information by ASIN
 * @param {string} asin - The Amazon Standard Identification Number
 * @returns {Promise<Object>} Product details
 */
export const getProductDetails = async (asin) => {
  const params = {
    type: 'product',
    asin,
  };

  const data = await makeRequest(params);

  return data.product || null;
};

/**
 * Get product reviews by ASIN
 * @param {string} asin - The Amazon Standard Identification Number
 * @param {Object} options - Review options
 * @param {number} [options.page=1] - Page number
 * @param {string} [options.sortBy] - Sort order ('most_recent', 'top_reviews')
 * @returns {Promise<Object>} Product reviews
 */
export const getProductReviews = async (asin, options = {}) => {
  const { page = 1, sortBy = 'top_reviews' } = options;

  const params = {
    type: 'reviews',
    asin,
    page: page.toString(),
    sort_by: sortBy,
  };

  const data = await makeRequest(params);

  return {
    asin,
    page,
    reviews: data.reviews || [],
    summary: data.summary || {},
    pagination: data.pagination || {},
  };
};

/**
 * Transform a search result product to our database format
 * @param {Object} product - Raw product from search results
 * @param {string} searchTerm - The search term used
 * @returns {Object} Transformed product data
 */
export const transformSearchProduct = (product, searchTerm) => {
  const asin = product.asin;

  return {
    asin,
    title: product.title || '',
    description: product.description || null,
    brand: product.brand || null,
    price: parsePrice(product.price?.value),
    currency: product.price?.currency || 'USD',
    original_price: parsePrice(product.price?.before_price?.value),
    rating: product.rating ? parseFloat(product.rating) : null,
    ratings_total: product.ratings_total || 0,
    reviews_total: product.reviews_total || 0,
    main_image_url: product.image || null,
    images: product.images || [],
    is_prime: product.is_prime || false,
    availability: product.availability?.raw || null,
    affiliate_url: buildAffiliateUrl(asin),
    search_term: searchTerm,
    raw_data: product,
  };
};

/**
 * Transform detailed product data to our database format
 * @param {Object} product - Raw product details
 * @param {string} searchTerm - The search term used (optional)
 * @returns {Object} Transformed product data
 */
export const transformProductDetails = (product, searchTerm = null) => {
  const asin = product.asin;

  return {
    asin,
    title: product.title || '',
    description: product.description || product.feature_bullets?.join('\n') || null,
    brand: product.brand || null,
    price: parsePrice(product.buybox_winner?.price?.value),
    currency: product.buybox_winner?.price?.currency || 'USD',
    original_price: parsePrice(product.buybox_winner?.rrp?.value),
    rating: product.rating ? parseFloat(product.rating) : null,
    ratings_total: product.ratings_total || 0,
    reviews_total: product.reviews_total || 0,
    main_image_url: product.main_image?.link || null,
    images: product.images?.map((img) => img.link) || [],
    features: product.feature_bullets || [],
    specifications: product.specifications_flat
      ? Object.fromEntries(
          product.specifications_flat.map((spec) => [spec.name, spec.value])
        )
      : {},
    is_prime: product.buybox_winner?.is_prime || false,
    availability: product.buybox_winner?.availability?.raw || null,
    affiliate_url: buildAffiliateUrl(asin),
    search_term: searchTerm,
    raw_data: product,
  };
};

/**
 * Parse a price value to a number
 * @param {*} value - The price value
 * @returns {number|null} The parsed price or null
 */
const parsePrice = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Search and get detailed product information
 * This combines search and product detail calls for comprehensive data
 * @param {string} searchTerm - The search query
 * @param {Object} options - Options
 * @param {number} [options.maxProducts=10] - Maximum products to fetch details for
 * @param {number} [options.delayMs=1000] - Delay between API calls in milliseconds
 * @returns {Promise<Object[]>} Array of detailed product data
 */
export const searchAndGetDetails = async (searchTerm, options = {}) => {
  const { maxProducts = 10, delayMs = 1000 } = options;

  // First, search for products
  const searchResults = await searchProducts(searchTerm);
  const products = searchResults.products.slice(0, maxProducts);

  const detailedProducts = [];

  for (const product of products) {
    try {
      // Add delay to avoid rate limiting
      if (detailedProducts.length > 0) {
        await delay(delayMs);
      }

      const details = await getProductDetails(product.asin);
      if (details) {
        detailedProducts.push(transformProductDetails(details, searchTerm));
      }
    } catch (error) {
      console.error(`Error fetching details for ASIN ${product.asin}:`, error.message);
      // Fall back to search result data
      detailedProducts.push(transformSearchProduct(product, searchTerm));
    }
  }

  return detailedProducts;
};

/**
 * Delay execution for a specified time
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Predefined search terms for camping and outdoor gear
 */
export const CAMPING_SEARCH_TERMS = [
  'camping gear essentials',
  'hiking backpack',
  'camping tent',
  'sleeping bag camping',
  'camping cookware set',
  'camping lantern',
  'hiking boots waterproof',
  'camping chair portable',
  'water filter camping',
  'first aid kit outdoor',
  'camping hammock',
  'trekking poles',
  'camping stove portable',
  'headlamp camping',
  'camping cooler',
  'binoculars wildlife',
  'camping knife multi tool',
  'rain jacket hiking',
  'camping mattress pad',
  'portable power station camping',
];

/**
 * Activity-specific search terms mapping
 */
export const ACTIVITY_SEARCH_TERMS = {
  camping: ['camping gear essentials', 'camping tent', 'sleeping bag camping', 'camping cookware set'],
  hiking: ['hiking backpack', 'hiking boots waterproof', 'trekking poles', 'hiking water bottle'],
  fishing: ['fishing rod combo', 'fishing tackle box', 'fishing waders', 'fishing vest'],
  'wildlife watching': ['binoculars wildlife', 'bird watching guide', 'wildlife camera trap', 'field guide birds'],
  climbing: ['climbing harness', 'climbing rope', 'climbing shoes', 'climbing helmet'],
  kayaking: ['kayak paddle', 'kayak life jacket', 'dry bag waterproof', 'kayak seat'],
  skiing: ['ski goggles', 'ski gloves', 'ski helmet', 'ski boot bag'],
  snowshoeing: ['snowshoes hiking', 'snow gaiters', 'insulated hiking boots', 'hand warmers'],
  stargazing: ['telescope portable', 'star chart', 'red flashlight astronomy', 'camping chair reclining'],
  photography: ['camera backpack', 'tripod travel', 'camera rain cover', 'memory card case'],
};

export default {
  searchProducts,
  getProductDetails,
  getProductReviews,
  transformSearchProduct,
  transformProductDetails,
  searchAndGetDetails,
  buildAffiliateUrl,
  CAMPING_SEARCH_TERMS,
  ACTIVITY_SEARCH_TERMS,
};