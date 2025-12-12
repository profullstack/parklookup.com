/**
 * Wikidata Local Parks Matching Service
 *
 * This module provides functions to match local parks with Wikidata entities
 * and fetch photos from Wikimedia Commons.
 *
 * Wikidata Query Service: https://query.wikidata.org/
 * Wikimedia Commons API: https://commons.wikimedia.org/w/api.php
 */

/** Wikidata SPARQL endpoint */
export const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

/** Wikimedia Commons API endpoint */
export const COMMONS_API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

/** Default search radius in kilometers */
const DEFAULT_RADIUS_KM = 5;

/** Maximum distance for a valid match in kilometers */
const MAX_MATCH_DISTANCE_KM = 10;

/**
 * Calculates the Haversine distance between two points in kilometers
 *
 * @param {number|null} lat1 - Latitude of first point
 * @param {number|null} lon1 - Longitude of first point
 * @param {number|null} lat2 - Latitude of second point
 * @param {number|null} lon2 - Longitude of second point
 * @returns {number|null} Distance in kilometers or null if coordinates are invalid
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Escapes special characters in a string for SPARQL queries
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeSparql = (str) => {
  if (!str) return '';
  return str
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[&]/g, 'and') // Replace ampersand
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove other special chars
    .trim();
};

/**
 * Normalizes a park name for comparison
 *
 * @param {string} name - Park name
 * @returns {string} Normalized name
 */
const normalizeName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\bpark\b/gi, '')
    .replace(/\bcounty\b/gi, '')
    .replace(/\bregional\b/gi, '')
    .replace(/\bstate\b/gi, '')
    .trim();
};

/**
 * Calculates name similarity score (0-1)
 *
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {number} Similarity score between 0 and 1
 */
const calculateNameSimilarity = (name1, name2) => {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return 1;
  if (!n1 || !n2) return 0;

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) {
    return 0.8;
  }

  // Simple word overlap
  const words1 = new Set(n1.split(' '));
  const words2 = new Set(n2.split(' '));
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);

  return intersection.length / union.size;
};

/**
 * Builds a SPARQL query to find parks near a location
 *
 * @param {Object} options - Query options
 * @param {string} options.name - Park name to search for
 * @param {number} options.latitude - Latitude
 * @param {number} options.longitude - Longitude
 * @param {number} [options.radiusKm=5] - Search radius in kilometers
 * @returns {string} SPARQL query string
 */
export const buildParkMatchQuery = ({ name, latitude, longitude, radiusKm = DEFAULT_RADIUS_KM }) => {
  const escapedName = escapeSparql(name);

  return `
SELECT ?park ?parkLabel ?coord ?image ?commonsCat
WHERE {
  # Find parks (Q22698) and subclasses within radius
  SERVICE wikibase:around {
    ?park wdt:P625 ?coord.
    bd:serviceParam wikibase:center "Point(${longitude} ${latitude})"^^geo:wktLiteral.
    bd:serviceParam wikibase:radius "${radiusKm}".
  }
  
  # Must be a park or subclass
  ?park wdt:P31/wdt:P279* wd:Q22698.
  
  # Optional: image
  OPTIONAL { ?park wdt:P18 ?image. }
  
  # Optional: Commons category
  OPTIONAL { ?park wdt:P373 ?commonsCat. }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 20
`;
};

/**
 * Builds a SPARQL query to fetch photo info for a Wikidata entity
 *
 * @param {string} wikidataId - Wikidata entity ID (e.g., "Q160409")
 * @returns {string} SPARQL query string
 */
export const buildPhotoQuery = (wikidataId) => `
SELECT ?image ?commonsCat
WHERE {
  BIND(wd:${wikidataId} AS ?park)
  
  OPTIONAL { ?park wdt:P18 ?image. }
  OPTIONAL { ?park wdt:P373 ?commonsCat. }
}
LIMIT 1
`;

/**
 * Parses coordinates from Wikidata Point format
 *
 * @param {string|null} coordString - Coordinate string in format "Point(lng lat)"
 * @returns {{latitude: number, longitude: number}|null} Parsed coordinates
 */
const parseCoordinates = (coordString) => {
  if (!coordString) return null;

  const match = coordString.match(/Point\(([^ ]+) ([^)]+)\)/);
  if (!match) return null;

  return {
    longitude: parseFloat(match[1]),
    latitude: parseFloat(match[2]),
  };
};

/**
 * Extracts Wikidata ID from entity URI
 *
 * @param {string|null} uri - Wikidata entity URI
 * @returns {string} Wikidata ID or empty string
 */
const extractWikidataId = (uri) => {
  if (!uri) return '';
  return uri.split('/').pop() || '';
};

/**
 * Parses a Wikidata SPARQL result into a structured object
 *
 * @param {Object} result - Single result from SPARQL query
 * @returns {Object} Parsed result
 */
export const parseWikidataResult = (result) => {
  const coords = parseCoordinates(result.coord?.value);

  return {
    wikidata_id: extractWikidataId(result.park?.value),
    label: result.parkLabel?.value ?? null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    image_url: result.image?.value ?? null,
    commons_category: result.commonsCat?.value ?? null,
  };
};

/**
 * Parses Commons image info into a structured object
 *
 * @param {Object} imageInfo - Image info from Commons API
 * @returns {Object|null} Parsed image data or null
 */
export const parseCommonsImage = (imageInfo) => {
  if (!imageInfo?.imageinfo?.[0]) {
    return null;
  }

  const info = imageInfo.imageinfo[0];
  const metadata = info.extmetadata || {};

  // Extract title without "File:" prefix
  const title = imageInfo.title?.replace(/^File:/, '') ?? null;

  // Extract attribution from HTML
  let attribution = metadata.Artist?.value ?? null;
  if (attribution) {
    // Strip HTML tags for plain text attribution
    attribution = attribution.replace(/<[^>]*>/g, '').trim();
  }

  return {
    source: 'wikimedia',
    title,
    image_url: info.url ?? null,
    thumb_url: info.thumburl ?? null,
    width: info.width ?? null,
    height: info.height ?? null,
    license: metadata.LicenseShortName?.value ?? null,
    attribution,
  };
};

/**
 * Finds the best matching Wikidata entity for a park
 *
 * @param {Object} parkData - Park data to match
 * @param {string} parkData.name - Park name
 * @param {number} parkData.latitude - Latitude
 * @param {number} parkData.longitude - Longitude
 * @param {Array} candidates - Array of Wikidata candidates
 * @param {Object} [options] - Match options
 * @param {number} [options.maxDistanceKm=10] - Maximum distance for valid match
 * @returns {Object|null} Best matching candidate or null
 */
export const findBestMatch = (parkData, candidates, { maxDistanceKm = MAX_MATCH_DISTANCE_KM } = {}) => {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    // Calculate distance
    const distance = calculateDistance(
      parkData.latitude,
      parkData.longitude,
      candidate.latitude,
      candidate.longitude
    );

    // Skip if too far
    if (distance === null || distance > maxDistanceKm) {
      continue;
    }

    // Calculate name similarity
    const nameSimilarity = calculateNameSimilarity(parkData.name, candidate.label);

    // Combined score: weight name similarity more than distance
    // Distance score: 1 at 0km, 0 at maxDistanceKm
    const distanceScore = 1 - distance / maxDistanceKm;
    const score = nameSimilarity * 0.7 + distanceScore * 0.3;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...candidate, matchScore: score, distance };
    }
  }

  // Require minimum score threshold
  if (bestScore < 0.3) {
    return null;
  }

  return bestMatch;
};

/**
 * Fetches matching Wikidata entity for a park
 *
 * @param {Object} parkData - Park data to match
 * @param {string} parkData.name - Park name
 * @param {number} parkData.latitude - Latitude
 * @param {number} parkData.longitude - Longitude
 * @param {Object} [options] - Fetch options
 * @param {number} [options.radiusKm=5] - Search radius
 * @returns {Promise<Object|null>} Matching Wikidata entity or null
 */
export const fetchParkMatch = async (parkData, { radiusKm = DEFAULT_RADIUS_KM } = {}) => {
  if (!parkData.latitude || !parkData.longitude) {
    return null;
  }

  const query = buildParkMatchQuery({
    name: parkData.name,
    latitude: parkData.latitude,
    longitude: parkData.longitude,
    radiusKm,
  });

  const url = `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
      },
    });

    if (!response.ok) {
      console.error(`Wikidata SPARQL error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const candidates = (data.results?.bindings || []).map(parseWikidataResult);

    return findBestMatch(parkData, candidates);
  } catch (error) {
    console.error('Error fetching Wikidata match:', error.message);
    return null;
  }
};

/**
 * Fetches images from a Wikimedia Commons category
 *
 * @param {string} category - Commons category name
 * @param {Object} [options] - Fetch options
 * @param {number} [options.limit=10] - Maximum images to fetch
 * @param {number} [options.thumbWidth=400] - Thumbnail width
 * @returns {Promise<Array>} Array of image data
 */
export const fetchCommonsImages = async (category, { limit = 10, thumbWidth = 400 } = {}) => {
  if (!category) {
    return [];
  }

  // First, get list of files in category
  const listParams = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmtype: 'file',
    cmlimit: limit.toString(),
    format: 'json',
    origin: '*',
  });

  try {
    const listResponse = await fetch(`${COMMONS_API_ENDPOINT}?${listParams}`, {
      headers: {
        'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
      },
    });

    if (!listResponse.ok) {
      return [];
    }

    const listData = await listResponse.json();
    const files = listData.query?.categorymembers || [];

    if (files.length === 0) {
      return [];
    }

    // Get image info for all files
    const titles = files.map((f) => f.title).join('|');
    const infoParams = new URLSearchParams({
      action: 'query',
      titles,
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: thumbWidth.toString(),
      format: 'json',
      origin: '*',
    });

    const infoResponse = await fetch(`${COMMONS_API_ENDPOINT}?${infoParams}`, {
      headers: {
        'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
      },
    });

    if (!infoResponse.ok) {
      return [];
    }

    const infoData = await infoResponse.json();
    const pages = Object.values(infoData.query?.pages || {});

    return pages.map(parseCommonsImage).filter(Boolean);
  } catch (error) {
    console.error('Error fetching Commons images:', error.message);
    return [];
  }
};

/**
 * Fetches photo for a park from Wikidata P18 property
 *
 * @param {string} wikidataId - Wikidata entity ID
 * @param {Object} [options] - Fetch options
 * @param {number} [options.thumbWidth=400] - Thumbnail width
 * @returns {Promise<Object|null>} Image data or null
 */
export const fetchWikidataImage = async (wikidataId, { thumbWidth = 400 } = {}) => {
  const query = buildPhotoQuery(wikidataId);
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const result = data.results?.bindings?.[0];

    if (!result?.image?.value) {
      return null;
    }

    // Extract filename from Commons URL
    const imageUrl = result.image.value;
    const filename = decodeURIComponent(imageUrl.split('/').pop());

    // Get image info from Commons
    const infoParams = new URLSearchParams({
      action: 'query',
      titles: `File:${filename}`,
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: thumbWidth.toString(),
      format: 'json',
      origin: '*',
    });

    const infoResponse = await fetch(`${COMMONS_API_ENDPOINT}?${infoParams}`, {
      headers: {
        'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
      },
    });

    if (!infoResponse.ok) {
      return null;
    }

    const infoData = await infoResponse.json();
    const pages = Object.values(infoData.query?.pages || {});

    if (pages.length === 0) {
      return null;
    }

    return parseCommonsImage(pages[0]);
  } catch (error) {
    console.error('Error fetching Wikidata image:', error.message);
    return null;
  }
};

export default {
  WIKIDATA_SPARQL_ENDPOINT,
  COMMONS_API_ENDPOINT,
  calculateDistance,
  buildParkMatchQuery,
  buildPhotoQuery,
  parseWikidataResult,
  parseCommonsImage,
  findBestMatch,
  fetchParkMatch,
  fetchCommonsImages,
  fetchWikidataImage,
};