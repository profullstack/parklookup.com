/**
 * NPS (National Park Service) API Data Fetcher
 *
 * This module provides functions to fetch park data from the NPS API
 * and transform it for storage in the database.
 *
 * API Documentation: https://www.nps.gov/subjects/developer/api-documentation.htm
 */

/** Base URL for the NPS API */
export const NPS_API_BASE_URL = 'https://developer.nps.gov/api/v1';

/** Default batch size for pagination */
const DEFAULT_LIMIT = 50;

/**
 * Gets the NPS API key from environment
 * @returns {string} The NPS API key
 */
const getNpsApiKey = () => process.env.NPS_API_KEY;

/**
 * Fetches parks from the NPS API
 *
 * @param {Object} options - Fetch options
 * @param {number} [options.limit=50] - Number of results per page (max 50)
 * @param {number} [options.start=0] - Pagination offset
 * @param {string} [options.stateCode] - Filter by state code (e.g., 'CA', 'NY')
 * @param {string} [options.parkCode] - Filter by park code
 * @param {string} [options.q] - Search query
 * @returns {Promise<{data: Array, total: number, limit: number, start: number}>}
 * @throws {Error} If the API request fails
 */
export const fetchParks = async ({
  limit = DEFAULT_LIMIT,
  start = 0,
  stateCode,
  parkCode,
  q,
} = {}) => {
  const apiKey = getNpsApiKey();
  
  const params = new URLSearchParams({
    limit: String(limit),
    start: String(start),
    api_key: apiKey,
  });

  if (stateCode) {
    params.append('stateCode', stateCode);
  }

  if (parkCode) {
    params.append('parkCode', parkCode);
  }

  if (q) {
    params.append('q', q);
  }

  const url = `${NPS_API_BASE_URL}/parks?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'X-Api-Key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`NPS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    data: data.data,
    total: parseInt(data.total, 10),
    limit: parseInt(data.limit, 10),
    start: parseInt(data.start, 10),
  };
};

/**
 * Fetches all parks from the NPS API with automatic pagination
 *
 * @param {Object} options - Fetch options
 * @param {Function} [options.onProgress] - Callback for progress updates
 * @param {string} [options.stateCode] - Filter by state code
 * @returns {Promise<Array>} All parks from the API
 */
export const fetchAllParks = async ({ onProgress, stateCode } = {}) => {
  const allParks = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const result = await fetchParks({
      limit: DEFAULT_LIMIT,
      start,
      stateCode,
    });

    allParks.push(...result.data);
    total = result.total;
    start += result.limit;

    if (onProgress) {
      onProgress({
        fetched: allParks.length,
        total,
        percentage: Math.min(100, Math.round((allParks.length / total) * 100)),
      });
    }
  }

  return allParks;
};

/**
 * Transforms NPS API park data to database format
 *
 * @param {Object} park - Park data from NPS API
 * @returns {Object} Transformed park data for database
 */
export const transformParkData = (park) => ({
  park_code: park.parkCode,
  full_name: park.fullName,
  description: park.description ?? null,
  states: park.states ?? null,
  designation: park.designation ?? null,
  latitude: park.latitude ? parseFloat(park.latitude) : null,
  longitude: park.longitude ? parseFloat(park.longitude) : null,
  url: park.url ?? null,
  weather_info: park.weatherInfo ?? null,
  images: park.images ?? [],
  activities: park.activities ?? [],
  topics: park.topics ?? [],
  contacts: park.contacts ?? {},
  entrance_fees: park.entranceFees ?? [],
  operating_hours: park.operatingHours ?? [],
  addresses: park.addresses ?? [],
});

/**
 * Fetches and transforms all parks for database import
 *
 * @param {Object} options - Options
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<Array>} Transformed park data ready for database
 */
export const fetchAndTransformAllParks = async ({ onProgress } = {}) => {
  const parks = await fetchAllParks({ onProgress });
  return parks.map(transformParkData);
};

/**
 * Fetches a single park by park code
 *
 * @param {string} parkCode - The park code (e.g., 'acad', 'yose')
 * @returns {Promise<Object|null>} Park data or null if not found
 */
export const fetchParkByCode = async (parkCode) => {
  try {
    const result = await fetchParks({ parkCode });
    return result.data.length > 0 ? transformParkData(result.data[0]) : null;
  } catch (error) {
    console.error(`Error fetching park ${parkCode}:`, error);
    return null;
  }
};

/**
 * Searches parks by query string
 *
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @param {number} [options.limit=20] - Number of results
 * @returns {Promise<Array>} Matching parks
 */
export const searchParks = async (query, { limit = 20 } = {}) => {
  const result = await fetchParks({ q: query, limit });
  return result.data.map(transformParkData);
};

export default {
  NPS_API_BASE_URL,
  fetchParks,
  fetchAllParks,
  transformParkData,
  fetchAndTransformAllParks,
  fetchParkByCode,
  searchParks,
};