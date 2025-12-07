/**
 * ValueSERP API Library
 *
 * Provides functions to search for places and get place details
 * using the ValueSERP API.
 */

const VALUESERP_BASE_URL = 'https://api.valueserp.com/search';

/**
 * Valid place categories for nearby searches
 */
export const PLACE_CATEGORIES = ['dining', 'entertainment', 'bars', 'lodging', 'shopping', 'attractions'];

/**
 * Search query mappings for each category
 */
export const CATEGORY_QUERIES = {
  dining: 'restaurants',
  entertainment: 'entertainment',
  bars: 'bars nightlife',
  lodging: 'hotels motels',
  shopping: 'shopping',
  attractions: 'tourist attractions things to do',
};

/**
 * Get the ValueSERP API key from environment
 * @returns {string|null} API key or null if not configured
 */
export function getApiKey() {
  return process.env.VALUESERP_API_KEY || null;
}

/**
 * Check if ValueSERP API is configured
 * @returns {boolean}
 */
export function isConfigured() {
  return !!getApiKey();
}

/**
 * Format location string for ValueSERP API
 * @param {string} city - City name
 * @param {string} state - State name
 * @param {string} [country='United States'] - Country name
 * @returns {string} Formatted location string
 */
export function formatLocation(city, state, country = 'United States') {
  return `${city},${state},${country}`;
}

/**
 * Search for places near a location
 * @param {Object} options - Search options
 * @param {string} options.query - Search query (e.g., 'restaurants', 'bars')
 * @param {string} options.location - Location string (e.g., 'Santa Cruz,California,United States')
 * @param {string} [options.googleDomain='google.com'] - Google domain
 * @param {string} [options.gl='us'] - Country code
 * @param {string} [options.hl='en'] - Language code
 * @returns {Promise<Object>} Search results
 */
export async function searchPlaces(options) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('ValueSERP API key is not configured');
  }

  const { query, location, googleDomain = 'google.com', gl = 'us', hl = 'en' } = options;

  if (!query) {
    throw new Error('Search query is required');
  }

  if (!location) {
    throw new Error('Location is required');
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    search_type: 'places',
    q: query,
    location: location,
    google_domain: googleDomain,
    gl: gl,
    hl: hl,
  });

  const url = `${VALUESERP_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ValueSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return data;
}

/**
 * Get detailed information about a place
 * @param {string} dataCid - Google's place CID
 * @returns {Promise<Object>} Place details
 */
export async function getPlaceDetails(dataCid) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('ValueSERP API key is not configured');
  }

  if (!dataCid) {
    throw new Error('data_cid is required');
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    search_type: 'place_details',
    data_cid: dataCid,
  });

  const url = `${VALUESERP_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ValueSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return data;
}

/**
 * Extract place data from search results
 * @param {Object} searchResult - Raw search result from ValueSERP
 * @param {string} category - Place category
 * @returns {Array<Object>} Normalized place objects
 */
export function extractPlacesFromSearch(searchResult, category) {
  const places = searchResult?.places_results || [];

  return places.map((place) => ({
    dataCid: place.data_cid,
    title: place.title,
    category: category,
    address: place.address,
    phone: place.phone,
    website: place.website,
    latitude: place.gps_coordinates?.latitude,
    longitude: place.gps_coordinates?.longitude,
    rating: place.rating,
    reviewsCount: place.reviews,
    priceLevel: place.price,
    thumbnail: place.thumbnail,
    hours: place.hours,
    rawSearchData: place,
  }));
}

/**
 * Extract detailed place data from place_details response
 * @param {Object} detailsResult - Raw details result from ValueSERP
 * @returns {Object} Normalized place details
 */
export function extractPlaceDetails(detailsResult) {
  const place = detailsResult?.place_results || {};

  return {
    title: place.title,
    address: place.address,
    phone: place.phone,
    website: place.website,
    latitude: place.gps_coordinates?.latitude,
    longitude: place.gps_coordinates?.longitude,
    rating: place.rating,
    reviewsCount: place.reviews,
    priceLevel: place.price,
    description: place.description,
    hours: place.hours,
    popularTimes: place.popular_times,
    images: place.images,
    reviews: place.reviews_results?.slice(0, 5), // Keep top 5 reviews
    rawDetailsData: place,
  };
}

/**
 * Search for places by category near a location
 * @param {string} category - Place category (dining, entertainment, bars, etc.)
 * @param {string} city - City name
 * @param {string} state - State name
 * @returns {Promise<Array<Object>>} Array of places
 */
export async function searchPlacesByCategory(category, city, state) {
  if (!PLACE_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: ${category}. Must be one of: ${PLACE_CATEGORIES.join(', ')}`);
  }

  const query = CATEGORY_QUERIES[category];
  const location = formatLocation(city, state);

  const searchResult = await searchPlaces({ query, location });

  return extractPlacesFromSearch(searchResult, category);
}

/**
 * Search for multiple categories near a location
 * @param {Array<string>} categories - Array of categories to search
 * @param {string} city - City name
 * @param {string} state - State name
 * @param {number} [delayMs=1000] - Delay between requests in milliseconds
 * @returns {Promise<Object>} Object with category keys and place arrays
 */
export async function searchMultipleCategories(categories, city, state, delayMs = 1000) {
  const results = {};

  for (const category of categories) {
    try {
      results[category] = await searchPlacesByCategory(category, city, state);

      // Rate limiting delay between requests
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Error searching ${category}:`, error.message);
      results[category] = [];
    }
  }

  return results;
}