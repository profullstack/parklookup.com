/**
 * Local Parks API Client
 *
 * This module provides functions to fetch county and city park data from
 * OpenStreetMap via the Overpass API. This is a fallback since the PAD-US
 * ArcGIS service has been unreliable.
 *
 * Data Source: OpenStreetMap via Overpass API
 * Overpass API: https://overpass-api.de/api/interpreter
 */

/** Overpass API URL */
export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

/** Alternative Overpass endpoints for fallback */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/** Default batch size for pagination */
const DEFAULT_LIMIT = 1000;

/** Maximum records per request (ArcGIS limit) */
const MAX_RECORDS_PER_REQUEST = 2000;

/**
 * Manager type codes used in PAD-US
 * @see https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-data-manual
 */
export const MANAGER_TYPES = {
  COUNTY: 'CNTY',
  LOCAL: 'LOC',
  CITY: 'CITY',
  REGIONAL: 'REG',
  MUNICIPAL: 'MUN',
  DISTRICT: 'DIST',
};

/**
 * Access type codes used in PAD-US
 */
export const ACCESS_TYPES = {
  OPEN: 'OA', // Open Access
  RESTRICTED: 'RA', // Restricted Access
  UNKNOWN: 'UK', // Unknown
  CLOSED: 'XA', // Closed
};

/**
 * Maps PAD-US manager type codes to our park_type values
 */
const MANAGER_TYPE_MAP = {
  CNTY: 'county',
  LOC: 'municipal',
  CITY: 'city',
  REG: 'regional',
  MUN: 'municipal',
  DIST: 'regional',
};

/**
 * Maps PAD-US access codes to our access values
 */
const ACCESS_TYPE_MAP = {
  OA: 'Open',
  RA: 'Restricted',
  UK: 'Unknown',
  XA: 'Restricted',
};

/**
 * Generates a URL-friendly slug from a park name
 *
 * @param {string|null|undefined} name - Park name
 * @returns {string} URL-friendly slug
 */
export const generateSlug = (name) => {
  if (!name) {
    return '';
  }

  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Calculates the centroid of a polygon
 *
 * @param {Array} coordinates - Polygon coordinates array
 * @returns {{longitude: number, latitude: number}} Centroid coordinates
 */
const calculatePolygonCentroid = (coordinates) => {
  // Handle nested polygon arrays (first ring is exterior)
  const ring = Array.isArray(coordinates[0][0]) ? coordinates[0] : coordinates;

  let sumLng = 0;
  let sumLat = 0;
  const count = ring.length - 1; // Exclude closing point

  for (let i = 0; i < count; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }

  return {
    longitude: sumLng / count,
    latitude: sumLat / count,
  };
};

/**
 * Builds query parameters for PAD-US API request
 *
 * @param {Object} options - Query options
 * @param {string[]} [options.managerTypes] - Array of manager type codes to filter
 * @param {string} [options.accessType] - Access type code to filter
 * @param {string} [options.stateCode] - Two-letter state code to filter
 * @param {number} [options.offset=0] - Pagination offset
 * @param {number} [options.limit=1000] - Number of records to fetch
 * @param {string[]} [options.outFields] - Specific fields to return
 * @returns {string} URL-encoded query string
 */
export const buildQueryParams = ({
  managerTypes = [],
  accessType = null,
  stateCode = null,
  offset = 0,
  limit = DEFAULT_LIMIT,
  outFields = ['*'],
} = {}) => {
  const whereClauses = [];

  // Filter by manager types (county, city, local, etc.)
  if (managerTypes.length > 0) {
    const typeConditions = managerTypes.map((t) => `Mang_Type = '${t}'`).join(' OR ');
    whereClauses.push(`(${typeConditions})`);
  }

  // Filter by access type
  if (accessType) {
    whereClauses.push(`Access = '${accessType}'`);
  }

  // Filter by state
  if (stateCode) {
    whereClauses.push(`State_Nm = '${stateCode}'`);
  }

  // Default where clause if none specified
  const whereClause = whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1';

  const params = new URLSearchParams({
    where: whereClause,
    outFields: outFields.join(','),
    f: 'geojson',
    resultOffset: offset.toString(),
    resultRecordCount: Math.min(limit, MAX_RECORDS_PER_REQUEST).toString(),
    returnGeometry: 'true',
    spatialRel: 'esriSpatialRelIntersects',
    orderByFields: 'Unit_Nm ASC',
  });

  return params.toString();
};

/**
 * Parses a GeoJSON feature from PAD-US into our local_parks format
 *
 * @param {Object} feature - GeoJSON feature from PAD-US
 * @returns {Object} Parsed park data for database
 */
export const parseFeature = (feature) => {
  const props = feature.properties || {};
  const geometry = feature.geometry;

  // Extract coordinates based on geometry type
  let latitude = null;
  let longitude = null;

  if (geometry) {
    if (geometry.type === 'Point') {
      [longitude, latitude] = geometry.coordinates;
    } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const coords = geometry.type === 'MultiPolygon' ? geometry.coordinates[0] : geometry.coordinates;
      const centroid = calculatePolygonCentroid(coords);
      latitude = centroid.latitude;
      longitude = centroid.longitude;
    }
  }

  // Map manager type to our park_type
  const managerType = props.Mang_Type || '';
  const parkType = MANAGER_TYPE_MAP[managerType] || 'municipal';

  // Map access type
  const accessCode = props.Access || 'UK';
  const access = ACCESS_TYPE_MAP[accessCode] || 'Unknown';

  return {
    name: props.Unit_Nm || 'Unknown Park',
    slug: generateSlug(props.Unit_Nm),
    park_type: parkType,
    managing_agency: props.Mang_Name || null,
    state_code: props.State_Nm || null,
    latitude,
    longitude,
    access,
    padus_id: props.OBJECTID?.toString() || null,
    raw_data: props,
  };
};

/**
 * State bounding boxes for Overpass queries
 * Format: [south, west, north, east]
 */
const STATE_BBOXES = {
  AL: [30.22, -88.47, 35.01, -84.89],
  AK: [51.21, -179.15, 71.39, 179.77],
  AZ: [31.33, -114.81, 37.00, -109.04],
  AR: [33.00, -94.62, 36.50, -89.64],
  CA: [32.53, -124.48, 42.01, -114.13],
  CO: [36.99, -109.06, 41.00, -102.04],
  CT: [40.95, -73.73, 42.05, -71.79],
  DE: [38.45, -75.79, 39.84, -75.05],
  FL: [24.40, -87.63, 31.00, -80.03],
  GA: [30.36, -85.61, 35.00, -80.84],
  HI: [18.91, -160.25, 22.24, -154.81],
  ID: [41.99, -117.24, 49.00, -111.04],
  IL: [36.97, -91.51, 42.51, -87.02],
  IN: [37.77, -88.10, 41.76, -84.78],
  IA: [40.38, -96.64, 43.50, -90.14],
  KS: [36.99, -102.05, 40.00, -94.59],
  KY: [36.50, -89.57, 39.15, -81.96],
  LA: [28.93, -94.04, 33.02, -88.82],
  ME: [43.06, -71.08, 47.46, -66.95],
  MD: [37.91, -79.49, 39.72, -75.05],
  MA: [41.24, -73.50, 42.89, -69.93],
  MI: [41.70, -90.42, 48.19, -82.12],
  MN: [43.50, -97.24, 49.38, -89.49],
  MS: [30.17, -91.66, 35.00, -88.10],
  MO: [35.99, -95.77, 40.61, -89.10],
  MT: [44.36, -116.05, 49.00, -104.04],
  NE: [40.00, -104.05, 43.00, -95.31],
  NV: [35.00, -120.01, 42.00, -114.04],
  NH: [42.70, -72.56, 45.31, -70.70],
  NJ: [38.93, -75.56, 41.36, -73.89],
  NM: [31.33, -109.05, 37.00, -103.00],
  NY: [40.50, -79.76, 45.02, -71.86],
  NC: [33.84, -84.32, 36.59, -75.46],
  ND: [45.94, -104.05, 49.00, -96.55],
  OH: [38.40, -84.82, 42.33, -80.52],
  OK: [33.62, -103.00, 37.00, -94.43],
  OR: [41.99, -124.57, 46.29, -116.46],
  PA: [39.72, -80.52, 42.27, -74.69],
  RI: [41.15, -71.86, 42.02, -71.12],
  SC: [32.03, -83.35, 35.22, -78.54],
  SD: [42.48, -104.06, 45.95, -96.44],
  TN: [34.98, -90.31, 36.68, -81.65],
  TX: [25.84, -106.65, 36.50, -93.51],
  UT: [36.99, -114.05, 42.00, -109.04],
  VT: [42.73, -73.44, 45.02, -71.46],
  VA: [36.54, -83.68, 39.47, -75.24],
  WA: [45.54, -124.85, 49.00, -116.92],
  WV: [37.20, -82.64, 40.64, -77.72],
  WI: [42.49, -92.89, 47.08, -86.25],
  WY: [40.99, -111.06, 45.01, -104.05],
  DC: [38.79, -77.12, 38.99, -76.91],
  PR: [17.88, -67.95, 18.52, -65.22],
};

/**
 * Builds an Overpass QL query for parks in a state
 *
 * @param {string} stateCode - Two-letter state code
 * @param {string[]} parkTypes - Types of parks to fetch
 * @param {boolean} includeAllParks - Whether to include all parks (not just government-operated)
 * @returns {string} Overpass QL query
 */
const buildOverpassQuery = (stateCode, parkTypes = ['county', 'city', 'local'], includeAllParks = true) => {
  const bbox = STATE_BBOXES[stateCode];
  if (!bbox) {
    throw new Error(`Unknown state code: ${stateCode}`);
  }

  const [south, west, north, east] = bbox;
  
  // For large states like Alaska, we need to be more selective
  // For smaller states, we can fetch all parks
  const isLargeState = ['AK', 'TX', 'CA', 'MT', 'NM', 'AZ', 'NV', 'CO', 'OR', 'WY', 'MI', 'UT'].includes(stateCode);
  
  let query;
  
  if (includeAllParks && !isLargeState) {
    // For smaller states, fetch all parks with names
    query = `
[out:json][timeout:180];
(
  // All named parks
  way["leisure"="park"]["name"](${south},${west},${north},${east});
  relation["leisure"="park"]["name"](${south},${west},${north},${east});
  // Also include recreation grounds
  way["leisure"="recreation_ground"]["name"](${south},${west},${north},${east});
  relation["leisure"="recreation_ground"]["name"](${south},${west},${north},${east});
);
out center tags;
`;
  } else {
    // For large states, use more targeted queries
    query = `
[out:json][timeout:180];
(
  // Parks operated by county/city/local government
  way["leisure"="park"]["operator"](${south},${west},${north},${east});
  relation["leisure"="park"]["operator"](${south},${west},${north},${east});
  // Parks with ownership tags
  way["leisure"="park"]["ownership"](${south},${west},${north},${east});
  relation["leisure"="park"]["ownership"](${south},${west},${north},${east});
  // Parks with government-related names
  way["leisure"="park"]["name"~"Park|Recreation|Community|Memorial|Veterans|City|County|Municipal|Town|Public",i](${south},${west},${north},${east});
  relation["leisure"="park"]["name"~"Park|Recreation|Community|Memorial|Veterans|City|County|Municipal|Town|Public",i](${south},${west},${north},${east});
);
out center tags;
`;
  }

  return query;
};

/**
 * Parses an OSM element into our local_parks format
 *
 * @param {Object} element - OSM element from Overpass
 * @param {string} stateCode - State code
 * @returns {Object} Parsed park data for database
 */
const parseOsmElement = (element, stateCode) => {
  const tags = element.tags || {};
  
  // Get coordinates (center for ways/relations)
  let latitude = null;
  let longitude = null;
  
  if (element.type === 'node') {
    latitude = element.lat;
    longitude = element.lon;
  } else if (element.center) {
    latitude = element.center.lat;
    longitude = element.center.lon;
  }

  // Determine park type from operator/ownership/name
  const operator = (tags.operator || '').toLowerCase();
  const ownership = (tags.ownership || '').toLowerCase();
  const name = tags.name || 'Unknown Park';
  const nameLower = name.toLowerCase();
  
  let parkType = 'local'; // Default to local
  
  // Check operator first
  if (operator.includes('county') || ownership.includes('county')) {
    parkType = 'county';
  } else if (operator.includes('city') || operator.includes('municipal') ||
             ownership.includes('city') || ownership.includes('municipal')) {
    parkType = 'city';
  } else if (operator.includes('town') || operator.includes('village') ||
             operator.includes('borough') || operator.includes('township')) {
    parkType = 'city';
  } else if (operator.includes('state') || ownership.includes('state')) {
    parkType = 'regional'; // State-managed but local
  } else if (operator.includes('regional') || operator.includes('district')) {
    parkType = 'regional';
  }
  // If no operator, try to infer from name
  else if (nameLower.includes('county')) {
    parkType = 'county';
  } else if (nameLower.includes('city') || nameLower.includes('municipal') ||
             nameLower.includes('town ') || nameLower.includes('village')) {
    parkType = 'city';
  }

  return {
    name,
    slug: generateSlug(name),
    park_type: parkType,
    managing_agency: tags.operator || null,
    state_code: stateCode,
    latitude,
    longitude,
    access: tags.access === 'private' ? 'Restricted' : 'Open',
    osm_id: `${element.type}/${element.id}`,
    raw_data: tags,
  };
};

/**
 * Fetches parks from Overpass API for a state
 *
 * @param {Object} options - Fetch options
 * @param {string} options.stateCode - State code to filter
 * @param {string[]} [options.parkTypes] - Types of parks to fetch
 * @returns {Promise<Array>} Array of parsed park data
 * @throws {Error} If the API request fails
 */
export const fetchParks = async ({
  stateCode = null,
  parkTypes = ['county', 'city', 'local'],
} = {}) => {
  if (!stateCode) {
    throw new Error('State code is required for Overpass queries');
  }

  const query = buildOverpassQuery(stateCode, parkTypes);
  
  // Try multiple endpoints
  let lastError = null;
  
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Overpass API error: ${data.error}`);
      }

      // Parse elements
      const elements = data.elements || [];
      return elements
        .filter(el => el.tags?.name) // Only parks with names
        .map(el => parseOsmElement(el, stateCode));
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint ${endpoint} failed:`, error.message);
      // Try next endpoint
      continue;
    }
  }

  throw lastError || new Error('All Overpass endpoints failed');
};

/**
 * Fetches all parks for a specific state
 *
 * @param {string} stateCode - Two-letter state code
 * @param {Object} options - Additional fetch options
 * @param {string[]} [options.parkTypes] - Types of parks to fetch
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<Array>} All parks for the state
 */
export const fetchParksByState = async (
  stateCode,
  {
    parkTypes = ['county', 'city', 'local'],
    onProgress = null,
  } = {}
) => {
  const parks = await fetchParks({
    stateCode,
    parkTypes,
  });

  if (onProgress) {
    onProgress({
      state: stateCode,
      fetched: parks.length,
    });
  }

  return parks;
};

/**
 * Fetches all parks from all states
 * Warning: This can be a very large dataset
 *
 * @param {Object} options - Fetch options
 * @param {string[]} [options.parkTypes] - Types of parks to fetch
 * @param {Function} [options.onProgress] - Progress callback
 * @param {string[]} [options.states] - Specific states to fetch (defaults to all)
 * @returns {Promise<Array>} All parks matching the criteria
 */
export const fetchAllParks = async ({
  parkTypes = ['county', 'city', 'local'],
  onProgress = null,
  states = null,
} = {}) => {
  const allParks = [];
  const statesToFetch = states || US_STATE_CODES;

  for (const stateCode of statesToFetch) {
    try {
      const parks = await fetchParksByState(stateCode, { parkTypes });
      allParks.push(...parks);

      if (onProgress) {
        onProgress({
          state: stateCode,
          fetched: parks.length,
          total: allParks.length,
        });
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to fetch parks for ${stateCode}:`, error.message);
      // Continue with other states
    }
  }

  return allParks;
};

/**
 * US State codes for iteration
 */
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
];

export default {
  OVERPASS_API_URL,
  MANAGER_TYPES,
  ACCESS_TYPES,
  US_STATE_CODES,
  generateSlug,
  buildQueryParams,
  parseFeature,
  fetchParks,
  fetchParksByState,
  fetchAllParks,
};