/**
 * HERE API Library
 *
 * Provides reverse geocoding functionality using the HERE Geocoding & Search API.
 * Converts GPS coordinates to physical addresses.
 *
 * @see https://developer.here.com/documentation/geocoding-search-api/dev_guide/index.html
 */

const HERE_REVERSE_GEOCODE_URL = 'https://revgeocode.search.hereapi.com/v1/revgeocode';

/**
 * Gets the HERE API key from environment
 * @returns {string|undefined} The API key
 */
const getApiKey = () => process.env.HERE_API_KEY;

/**
 * Validates latitude value
 * @param {number} lat - Latitude value
 * @returns {boolean} True if valid
 */
export const isValidLatitude = (lat) => {
  const num = parseFloat(lat);
  return !isNaN(num) && num >= -90 && num <= 90;
};

/**
 * Validates longitude value
 * @param {number} lng - Longitude value
 * @returns {boolean} True if valid
 */
export const isValidLongitude = (lng) => {
  const num = parseFloat(lng);
  return !isNaN(num) && num >= -180 && num <= 180;
};

/**
 * Formats an address object into a readable string
 * @param {Object} address - HERE API address object
 * @returns {string} Formatted address string
 */
export const formatAddress = (address) => {
  if (!address) {return null;}

  const parts = [];

  // Street address
  if (address.houseNumber && address.street) {
    parts.push(`${address.houseNumber} ${address.street}`);
  } else if (address.street) {
    parts.push(address.street);
  }

  // City, State, Postal Code
  const cityStateZip = [];
  if (address.city) {cityStateZip.push(address.city);}
  if (address.stateCode || address.state) {
    cityStateZip.push(address.stateCode || address.state);
  }
  if (address.postalCode) {cityStateZip.push(address.postalCode);}

  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(', '));
  }

  // Country (optional, usually USA for parks)
  if (address.countryName && address.countryCode !== 'USA') {
    parts.push(address.countryName);
  }

  return parts.join('\n') || null;
};

/**
 * Extracts a short address (city, state) from HERE API response
 * @param {Object} address - HERE API address object
 * @returns {string} Short address string
 */
export const getShortAddress = (address) => {
  if (!address) {return null;}

  const parts = [];
  if (address.city) {parts.push(address.city);}
  if (address.stateCode || address.state) {
    parts.push(address.stateCode || address.state);
  }

  return parts.join(', ') || null;
};

/**
 * Reverse geocodes GPS coordinates to a physical address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Optional parameters
 * @param {string} options.lang - Language for results (default: 'en-US')
 * @returns {Promise<Object>} Address information
 */
export const reverseGeocode = async (lat, lng, options = {}) => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error('HERE_API_KEY environment variable is not set');
  }

  if (!isValidLatitude(lat)) {
    throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
  }

  if (!isValidLongitude(lng)) {
    throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`);
  }

  const { lang = 'en-US' } = options;

  const params = new URLSearchParams({
    at: `${lat},${lng}`,
    lang,
    apiKey,
  });

  const url = `${HERE_REVERSE_GEOCODE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HERE API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return {
        success: true,
        found: false,
        address: null,
        formattedAddress: null,
        shortAddress: null,
        coordinates: { lat, lng },
      };
    }

    const item = data.items[0];
    const address = item.address || {};

    return {
      success: true,
      found: true,
      address: {
        label: address.label,
        houseNumber: address.houseNumber,
        street: address.street,
        district: address.district,
        city: address.city,
        county: address.county,
        state: address.state,
        stateCode: address.stateCode,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
        countryName: address.countryName,
      },
      formattedAddress: formatAddress(address),
      shortAddress: getShortAddress(address),
      coordinates: {
        lat: item.position?.lat || lat,
        lng: item.position?.lng || lng,
      },
      mapView: item.mapView,
      resultType: item.resultType,
      houseNumberType: item.houseNumberType,
    };
  } catch (error) {
    if (error.message.includes('HERE API error')) {
      throw error;
    }
    throw new Error(`Failed to reverse geocode: ${error.message}`);
  }
};

/**
 * Batch reverse geocode multiple coordinates
 * @param {Array<{lat: number, lng: number, id?: string}>} coordinates - Array of coordinate objects
 * @param {Object} options - Optional parameters
 * @param {number} options.concurrency - Max concurrent requests (default: 5)
 * @param {number} options.delayMs - Delay between batches in ms (default: 100)
 * @returns {Promise<Array<Object>>} Array of address results
 */
export const batchReverseGeocode = async (coordinates, options = {}) => {
  const { concurrency = 5, delayMs = 100 } = options;

  const results = [];
  const batches = [];

  // Split into batches
  for (let i = 0; i < coordinates.length; i += concurrency) {
    batches.push(coordinates.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (coord) => {
      try {
        const result = await reverseGeocode(coord.lat, coord.lng);
        return {
          id: coord.id,
          ...result,
        };
      } catch (error) {
        return {
          id: coord.id,
          success: false,
          error: error.message,
          coordinates: { lat: coord.lat, lng: coord.lng },
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches to avoid rate limiting
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
};

export default {
  reverseGeocode,
  batchReverseGeocode,
  formatAddress,
  getShortAddress,
  isValidLatitude,
  isValidLongitude,
};