/**
 * ScaleSERP API Library
 *
 * This library provides functions to interact with the ScaleSERP API
 * for searching places, getting place details, and fetching place photos.
 *
 * ScaleSERP is used instead of ValueSERP because it supports place_photos
 * search type which returns actual photos for places.
 *
 * API Documentation: https://www.scaleserp.com/docs
 */

const SCALESERP_BASE_URL = 'https://api.scaleserp.com/search';

/**
 * Get the ScaleSERP API key from environment variables
 * @returns {string} The API key
 * @throws {Error} If the API key is not configured
 */
function getApiKey() {
  const apiKey = process.env.SCALESERP_API_KEY;
  if (!apiKey) {
    throw new Error('SCALESERP_API_KEY environment variable is not configured');
  }
  return apiKey;
}

/**
 * Make a request to the ScaleSERP API
 * @param {Object} params - Query parameters for the API request
 * @returns {Promise<Object>} The API response data
 * @throws {Error} If the API request fails
 */
async function makeRequest(params) {
  const apiKey = getApiKey();

  const searchParams = new URLSearchParams({
    api_key: apiKey,
    ...params,
  });

  const url = `${SCALESERP_BASE_URL}?${searchParams.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ScaleSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Check for API-level errors
  if (data.request_info?.success === false) {
    throw new Error(`ScaleSERP API error: ${data.request_info.message || 'Unknown error'}`);
  }

  return data;
}

/**
 * Search for places using ScaleSERP API
 *
 * @param {string} query - Search query (e.g., "pizza", "restaurants")
 * @param {string} location - Location string (e.g., "Los Gatos,California,United States")
 * @param {Object} options - Additional options
 * @param {string} [options.googleDomain='google.com'] - Google domain to use
 * @param {string} [options.gl='us'] - Country code
 * @param {string} [options.hl='en'] - Language code
 * @returns {Promise<Object>} Search results with places_results array
 *
 * @example
 * const results = await searchPlaces('pizza', 'Los Gatos,California,United States');
 * // Returns: { places_results: [...], search_metadata: {...}, ... }
 */
export async function searchPlaces(query, location, options = {}) {
  const { googleDomain = 'google.com', gl = 'us', hl = 'en' } = options;

  const data = await makeRequest({
    search_type: 'places',
    q: query,
    location,
    google_domain: googleDomain,
    gl,
    hl,
  });

  return data;
}

/**
 * Get detailed information about a place using data_cid
 *
 * Note: ScaleSERP places search returns data_cid, not data_id.
 * Use this function to get place details including the data_id
 * which is required for fetching photos.
 *
 * @param {string} dataCid - The data_cid of the place (from places search results)
 * @returns {Promise<Object>} Place details including address, hours, reviews, data_id, etc.
 *
 * @example
 * const details = await getPlaceDetails('14301515110414832673');
 * // Returns: { place_details: { title, address, phone, hours, data_id, ... }, ... }
 */
export async function getPlaceDetails(dataCid) {
  const data = await makeRequest({
    search_type: 'place_details',
    data_cid: dataCid,
  });

  return data;
}

/**
 * Get detailed information about a place using data_id
 *
 * @param {string} dataId - The data_id of the place
 * @returns {Promise<Object>} Place details including address, hours, reviews, etc.
 *
 * @example
 * const details = await getPlaceDetailsByDataId('0x89c259cea3b62d4d:0x4519bf551f37923f');
 * // Returns: { place_details: { title, address, phone, hours, ... }, ... }
 */
export async function getPlaceDetailsByDataId(dataId) {
  const data = await makeRequest({
    search_type: 'place_details',
    data_id: dataId,
  });

  return data;
}

/**
 * Get photos for a place
 *
 * @param {string} dataId - The data_id of the place (from places search results)
 * @returns {Promise<Object>} Place photos including URLs and metadata
 *
 * @example
 * const photos = await getPlacePhotos('0x808e3409792a4695:0xa860fb51067e472d');
 * // Returns: { place_photos_results: [{ image, thumbnail, ... }, ...], ... }
 */
export async function getPlacePhotos(dataId) {
  const data = await makeRequest({
    search_type: 'place_photos',
    data_id: dataId,
  });

  return data;
}

/**
 * Search for places and get their photos in one operation
 *
 * This is a convenience function that:
 * 1. Searches for places matching the query (returns data_cid)
 * 2. Fetches place details to get data_id (required for photos)
 * 3. Fetches photos for each place using data_id
 *
 * Note: This requires 3 API calls per place (search + details + photos)
 *
 * @param {string} query - Search query
 * @param {string} location - Location string
 * @param {Object} options - Additional options
 * @param {number} [options.maxPlaces=20] - Maximum number of places to fetch photos for
 * @param {boolean} [options.includeDetails=true] - Include place details (always true since we need data_id)
 * @param {boolean} [options.includePhotos=true] - Fetch photos for each place
 * @returns {Promise<Array>} Array of places with photos attached
 *
 * @example
 * const places = await searchPlacesWithPhotos('restaurants', 'San Francisco,CA');
 * // Returns: [{ title, data_id, data_cid, photos: [...], details: {...}, ... }, ...]
 */
export async function searchPlacesWithPhotos(query, location, options = {}) {
  const { maxPlaces = 20, includePhotos = true } = options;

  // First, search for places (returns data_cid, not data_id)
  const searchResults = await searchPlaces(query, location);
  const places = searchResults.places_results || [];

  // Limit the number of places to process
  const placesToProcess = places.slice(0, maxPlaces);

  // Fetch details and photos for each place
  const enrichedPlaces = await Promise.all(
    placesToProcess.map(async (place) => {
      const enrichedPlace = { ...place };

      // Get place details to obtain data_id (required for photos)
      if (place.data_cid) {
        try {
          const detailsData = await getPlaceDetails(place.data_cid);
          const details = detailsData.place_details || {};
          enrichedPlace.details = details;
          enrichedPlace.data_id = details.data_id;

          // Now fetch photos using data_id
          if (includePhotos && details.data_id) {
            try {
              const photosData = await getPlacePhotos(details.data_id);
              enrichedPlace.photos = photosData.place_photos_results || [];

              // Set thumbnail from first photo if available
              if (enrichedPlace.photos.length > 0) {
                enrichedPlace.thumbnail =
                  enrichedPlace.photos[0].thumbnail || enrichedPlace.photos[0].image;
              }
            } catch (err) {
              console.error(`Error fetching photos for ${place.title}:`, err.message);
              enrichedPlace.photos = [];
            }
          }
        } catch (err) {
          console.error(`Error fetching details for ${place.title}:`, err.message);
          enrichedPlace.details = {};
        }
      }

      return enrichedPlace;
    })
  );

  return enrichedPlaces;
}

/**
 * Transform ScaleSERP place data to our database format
 *
 * @param {Object} place - Place data from ScaleSERP
 * @param {string} category - Category for the place (dining, entertainment, etc.)
 * @returns {Object} Transformed place data ready for database insertion
 */
export function transformPlaceForDatabase(place, category) {
  return {
    data_id: place.data_id,
    data_cid: place.data_cid,
    title: place.title,
    category,
    address: place.address,
    phone: place.phone,
    website: place.website,
    latitude: place.gps_coordinates?.latitude,
    longitude: place.gps_coordinates?.longitude,
    rating: place.rating,
    reviews_count: place.reviews,
    price_level: place.price,
    thumbnail: place.thumbnail || place.photos?.[0]?.thumbnail || place.photos?.[0]?.image,
    hours: place.hours || place.details?.hours,
    photos: place.photos?.map((p) => ({
      image: p.image,
      thumbnail: p.thumbnail,
      title: p.title,
    })),
    raw_search_data: place,
  };
}

/**
 * Extract the first photo URL from place data
 *
 * @param {Object} place - Place data (either from search or with photos attached)
 * @returns {string|null} The first photo URL or null if none found
 */
export function getFirstPhotoUrl(place) {
  // Check for photos array first
  if (place.photos && place.photos.length > 0) {
    return place.photos[0].image || place.photos[0].thumbnail;
  }

  // Check for thumbnail
  if (place.thumbnail) {
    return place.thumbnail;
  }

  return null;
}

export default {
  searchPlaces,
  getPlaceDetails,
  getPlaceDetailsByDataId,
  getPlacePhotos,
  searchPlacesWithPhotos,
  transformPlaceForDatabase,
  getFirstPhotoUrl,
};