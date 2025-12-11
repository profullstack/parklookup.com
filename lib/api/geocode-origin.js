/**
 * Geocode Origin Helper
 * Converts origin text (city, zip, address) to lat/lng coordinates using HERE API
 */

const HERE_API_KEY = process.env.HERE_API_KEY;
const HERE_GEOCODE_URL = 'https://geocode.search.hereapi.com/v1/geocode';

/**
 * Geocode an origin string to coordinates
 * @param {string} origin - Origin text (city name, zip code, or address)
 * @returns {Promise<Object>} Geocoded location with lat, lng, and formatted address
 */
export const geocodeOrigin = async (origin) => {
  if (!HERE_API_KEY) {
    throw new Error('HERE_API_KEY is not configured');
  }

  if (!origin || typeof origin !== 'string' || origin.trim().length === 0) {
    throw new Error('Origin is required and must be a non-empty string');
  }

  const params = new URLSearchParams({
    q: origin.trim(),
    apiKey: HERE_API_KEY,
    limit: '1',
    // Bias results to US
    in: 'countryCode:USA',
  });

  const response = await fetch(`${HERE_GEOCODE_URL}?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HERE API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error(`Could not find location for: ${origin}`);
  }

  const location = data.items[0];
  const { lat, lng } = location.position;

  return {
    lat,
    lng,
    formattedAddress: location.address?.label || origin,
    city: location.address?.city || null,
    state: location.address?.state || null,
    stateCode: location.address?.stateCode || null,
    county: location.address?.county || null,
    postalCode: location.address?.postalCode || null,
    country: location.address?.countryName || 'United States',
    countryCode: location.address?.countryCode || 'USA',
  };
};

/**
 * Validate latitude value
 * @param {number} lat - Latitude to validate
 * @returns {boolean} True if valid
 */
export const isValidLatitude = (lat) => {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
};

/**
 * Validate longitude value
 * @param {number} lng - Longitude to validate
 * @returns {boolean} True if valid
 */
export const isValidLongitude = (lng) => {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
};

/**
 * Validate coordinates object
 * @param {Object} coords - Coordinates object with lat and lng
 * @returns {boolean} True if valid
 */
export const isValidCoordinates = (coords) => {
  return coords && isValidLatitude(coords.lat) && isValidLongitude(coords.lng);
};

/**
 * Convert miles to meters
 * @param {number} miles - Distance in miles
 * @returns {number} Distance in meters
 */
export const milesToMeters = (miles) => {
  return miles * 1609.344;
};

/**
 * Convert kilometers to miles
 * @param {number} km - Distance in kilometers
 * @returns {number} Distance in miles
 */
export const kmToMiles = (km) => {
  return km * 0.621371;
};

/**
 * Convert miles to kilometers
 * @param {number} miles - Distance in miles
 * @returns {number} Distance in kilometers
 */
export const milesToKm = (miles) => {
  return miles * 1.60934;
};

export default {
  geocodeOrigin,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  milesToMeters,
  kmToMiles,
  milesToKm,
};