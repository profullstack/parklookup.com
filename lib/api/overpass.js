/**
 * OpenStreetMap Overpass API Client
 *
 * Fetches trail data from OSM using the Overpass API.
 * Uses multiple endpoints for redundancy and rate limiting.
 *
 * @module lib/api/overpass
 */

// Overpass API endpoints (multiple for redundancy)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Default timeout for Overpass queries (in seconds)
const DEFAULT_TIMEOUT = 60;

// Rate limiting: minimum delay between requests (ms)
const MIN_REQUEST_DELAY = 2000;

// Maximum retries per endpoint
const MAX_RETRIES = 5;

// Backoff delays in seconds for each retry attempt (5s, 10s, 15s, 20s, 25s)
const BACKOFF_DELAYS = [5, 10, 15, 20, 25];

// Track last request time for rate limiting
let lastRequestTime = 0;

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enforce rate limiting between requests
 * @returns {Promise<void>}
 */
const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_DELAY) {
    await sleep(MIN_REQUEST_DELAY - timeSinceLastRequest);
  }

  lastRequestTime = Date.now();
};

/**
 * Build an Overpass QL query for trails within a bounding box
 *
 * @param {Object} bbox - Bounding box coordinates
 * @param {number} bbox.south - Southern latitude
 * @param {number} bbox.west - Western longitude
 * @param {number} bbox.north - Northern latitude
 * @param {number} bbox.east - Eastern longitude
 * @param {number} timeout - Query timeout in seconds
 * @returns {string} Overpass QL query
 */
export const buildTrailQuery = (bbox, timeout = DEFAULT_TIMEOUT) => {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  // Query for hiking trails:
  // - Ways with highway=path|footway|track that have a name
  // - Relations with route=hiking
  return `
[out:json][timeout:${timeout}];
(
  // Named paths, footways, and tracks
  way["highway"~"path|footway|track"]["name"](${bboxStr});
  
  // Hiking routes (relations)
  relation["route"="hiking"](${bboxStr});
  
  // Ways with sac_scale (hiking difficulty rating)
  way["sac_scale"](${bboxStr});
);
out body geom;
`.trim();
};

/**
 * Build an Overpass QL query for trails near a point
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radiusMeters - Search radius in meters
 * @param {number} timeout - Query timeout in seconds
 * @returns {string} Overpass QL query
 */
export const buildTrailQueryNearPoint = (lat, lng, radiusMeters = 5000, timeout = DEFAULT_TIMEOUT) => `
[out:json][timeout:${timeout}];
(
  // Named paths, footways, and tracks
  way["highway"~"path|footway|track"]["name"](around:${radiusMeters},${lat},${lng});
  
  // Hiking routes (relations)
  relation["route"="hiking"](around:${radiusMeters},${lat},${lng});
  
  // Ways with sac_scale (hiking difficulty rating)
  way["sac_scale"](around:${radiusMeters},${lat},${lng});
);
out body geom;
`.trim();

/**
 * Execute an Overpass API query
 *
 * @param {string} query - Overpass QL query
 * @param {Object} options - Query options
 * @param {number} options.retries - Number of retry attempts
 * @param {number} options.endpointIndex - Starting endpoint index
 * @returns {Promise<Object>} Overpass API response
 * @throws {Error} If all endpoints fail
 */
export const executeQuery = async (query, options = {}) => {
  const { retries = MAX_RETRIES, endpointIndex = 0 } = options;

  await enforceRateLimit();

  let lastError = null;

  // Try each endpoint
  for (let endpointAttempt = 0; endpointAttempt < OVERPASS_ENDPOINTS.length; endpointAttempt++) {
    const endpoint = OVERPASS_ENDPOINTS[(endpointIndex + endpointAttempt) % OVERPASS_ENDPOINTS.length];

    // Retry each endpoint multiple times
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Check for rate limiting (429) or server errors (502, 503, 504)
          if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
            // Use Retry-After header if present, otherwise use our backoff schedule
            const retryAfterHeader = response.headers.get('Retry-After');
            const backoffSeconds = retryAfterHeader
              ? parseInt(retryAfterHeader, 10)
              : BACKOFF_DELAYS[Math.min(attempt, BACKOFF_DELAYS.length - 1)];
            const waitTime = backoffSeconds * 1000;
            console.warn(`\n⏳ ${endpoint} returned ${response.status}, waiting ${backoffSeconds}s...`);
            await sleep(waitTime);
            continue;
          }

          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error;

        // Don't log abort errors as warnings
        if (error.name === 'AbortError') {
          console.warn(`\n⏳ Request to ${endpoint} timed out, retrying...`);
        } else {
          console.warn(`\n⚠️  Overpass query failed on ${endpoint}: ${error.message}`);
        }

        if (attempt < retries - 1) {
          // Use our backoff schedule (5s, 10s, 15s, etc.)
          const backoffSeconds = BACKOFF_DELAYS[Math.min(attempt, BACKOFF_DELAYS.length - 1)];
          console.warn(`   Waiting ${backoffSeconds}s before retry ${attempt + 2}/${retries}...`);
          await sleep(backoffSeconds * 1000);
        }
      }
    }

    // If this endpoint failed all retries, try next endpoint
    if (endpointAttempt < OVERPASS_ENDPOINTS.length - 1) {
      console.warn(`\n🔄 Switching to next Overpass endpoint...`);
      await sleep(2000);
    }
  }

  throw new Error(`All Overpass endpoints failed after ${retries} retries each: ${lastError?.message}`);
};

/**
 * Fetch trails within a bounding box
 *
 * @param {Object} bbox - Bounding box coordinates
 * @param {number} bbox.south - Southern latitude
 * @param {number} bbox.west - Western longitude
 * @param {number} bbox.north - Northern latitude
 * @param {number} bbox.east - Eastern longitude
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of OSM elements (ways and relations)
 */
export const fetchTrailsInBbox = async (bbox, options = {}) => {
  const query = buildTrailQuery(bbox, options.timeout);
  const response = await executeQuery(query, options);
  return response.elements || [];
};

/**
 * Fetch trails near a point
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radiusMeters - Search radius in meters
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of OSM elements (ways and relations)
 */
export const fetchTrailsNearPoint = async (lat, lng, radiusMeters = 5000, options = {}) => {
  const query = buildTrailQueryNearPoint(lat, lng, radiusMeters, options.timeout);
  const response = await executeQuery(query, options);
  return response.elements || [];
};

/**
 * Calculate bounding box from a center point and radius
 *
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} Bounding box {south, west, north, east}
 */
export const calculateBbox = (lat, lng, radiusKm) => {
  // Approximate degrees per km at given latitude
  const latDegPerKm = 1 / 111.32;
  const lngDegPerKm = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));

  const latDelta = radiusKm * latDegPerKm;
  const lngDelta = radiusKm * lngDegPerKm;

  return {
    south: lat - latDelta,
    west: lng - lngDelta,
    north: lat + latDelta,
    east: lng + lngDelta,
  };
};

/**
 * Extract coordinates from an OSM way element
 *
 * @param {Object} element - OSM way element with geometry
 * @returns {Array<Array<number>>} Array of [lng, lat] coordinates
 */
export const extractCoordinates = (element) => {
  if (!element.geometry) {
    return [];
  }

  return element.geometry.map((point) => [point.lon, point.lat]);
};

/**
 * Convert OSM element to GeoJSON LineString feature
 *
 * @param {Object} element - OSM way element
 * @returns {Object|null} GeoJSON Feature or null if invalid
 */
export const osmToGeoJSON = (element) => {
  const coordinates = extractCoordinates(element);

  if (coordinates.length < 2) {
    return null;
  }

  return {
    type: 'Feature',
    properties: {
      id: element.id,
      type: element.type,
      ...element.tags,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
};

export default {
  buildTrailQuery,
  buildTrailQueryNearPoint,
  executeQuery,
  fetchTrailsInBbox,
  fetchTrailsNearPoint,
  calculateBbox,
  extractCoordinates,
  osmToGeoJSON,
};