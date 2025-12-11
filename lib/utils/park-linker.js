/**
 * Park Linking Algorithm
 * Links NPS parks to Wikidata parks using name and location similarity
 */

/**
 * Normalize a string for comparison
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
export const normalizeString = (str) => {
  if (!str) {return '';}
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
export const calculateLevenshteinDistance = (str1, str2) => {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) {dp[i][0] = i;}
  for (let j = 0; j <= n; j++) {dp[0][j] = j;}

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
};

/**
 * Calculate name similarity between two strings
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {number} Similarity score between 0 and 1
 */
export const calculateNameSimilarity = (name1, name2) => {
  if (!name1 || !name2) {return 0;}

  const normalized1 = normalizeString(name1);
  const normalized2 = normalizeString(name2);

  if (!normalized1 || !normalized2) {return 0;}
  if (normalized1 === normalized2) {return 1.0;}

  const distance = calculateLevenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - distance / maxLength;
};

/**
 * Calculate Haversine distance between two coordinates in kilometers
 * @param {Object} coord1 - First coordinate {latitude, longitude}
 * @param {Object} coord2 - Second coordinate {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
export const haversineDistance = (coord1, coord2) => {
  const R = 6371; // Earth's radius in km

  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculate location similarity based on distance
 * @param {Object} coord1 - First coordinate {latitude, longitude}
 * @param {Object} coord2 - Second coordinate {latitude, longitude}
 * @param {number} maxDistance - Maximum distance for scoring (default 100km)
 * @returns {number} Similarity score between 0 and 1
 */
export const calculateLocationSimilarity = (coord1, coord2, maxDistance = 100) => {
  if (!coord1 || !coord2) {return 0;}
  if (
    coord1.latitude == null ||
    coord1.longitude == null ||
    coord2.latitude == null ||
    coord2.longitude == null
  ) {
    return 0;
  }

  const distance = haversineDistance(coord1, coord2);

  if (distance === 0) {return 1.0;}
  if (distance >= maxDistance) {return 0;}

  return 1 - distance / maxDistance;
};

/**
 * Calculate overall match score combining name and location
 * @param {Object} scores - Object containing nameSimilarity and locationSimilarity
 * @param {Object} weights - Weights for each factor (default: name=0.7, location=0.3)
 * @returns {number} Combined score between 0 and 1
 */
export const calculateOverallScore = (
  { nameSimilarity, locationSimilarity },
  weights = { name: 0.7, location: 0.3 }
) => nameSimilarity * weights.name + locationSimilarity * weights.location;

/**
 * Find the best matching Wikidata park for an NPS park
 * @param {Object} npsPark - NPS park object
 * @param {Array} wikidataParks - Array of Wikidata park objects
 * @param {Object} options - Options including threshold
 * @returns {Object|null} Best match with score, or null if no match above threshold
 */
export const findBestMatch = (npsPark, wikidataParks, options = {}) => {
  const { threshold = 0.6 } = options;

  let bestMatch = null;
  let bestScore = 0;

  for (const wikidataPark of wikidataParks) {
    const nameSimilarity = calculateNameSimilarity(npsPark.full_name, wikidataPark.label);

    const npsCoord =
      npsPark.latitude && npsPark.longitude
        ? { latitude: npsPark.latitude, longitude: npsPark.longitude }
        : null;

    const wikiCoord =
      wikidataPark.latitude && wikidataPark.longitude
        ? { latitude: wikidataPark.latitude, longitude: wikidataPark.longitude }
        : null;

    const locationSimilarity = calculateLocationSimilarity(npsCoord, wikiCoord);

    const score = calculateOverallScore({ nameSimilarity, locationSimilarity });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        wikidataPark,
        score,
        nameSimilarity,
        locationSimilarity,
      };
    }
  }

  if (bestScore < threshold) {
    return null;
  }

  return bestMatch;
};

/**
 * Link all NPS parks to their Wikidata counterparts
 * @param {Array} npsParks - Array of NPS park objects
 * @param {Array} wikidataParks - Array of Wikidata park objects
 * @param {Object} options - Options including threshold and onProgress callback
 * @returns {Array} Array of link objects
 */
export const linkParks = (npsParks, wikidataParks, options = {}) => {
  const { threshold = 0.6, onProgress } = options;

  if (!npsParks?.length || !wikidataParks?.length) {
    return [];
  }

  const links = [];
  const usedWikidataIds = new Set();

  for (let i = 0; i < npsParks.length; i++) {
    const npsPark = npsParks[i];

    // Filter out already matched Wikidata parks
    const availableWikidataParks = wikidataParks.filter(
      (wp) => !usedWikidataIds.has(wp.wikidata_id)
    );

    const match = findBestMatch(npsPark, availableWikidataParks, { threshold });

    if (match) {
      usedWikidataIds.add(match.wikidataPark.wikidata_id);

      links.push({
        nps_park_id: npsPark.id,
        wikidata_park_id: match.wikidataPark.id,
        nps_park_code: npsPark.park_code,
        wikidata_id: match.wikidataPark.wikidata_id,
        confidence_score: match.score,
        name_similarity: match.nameSimilarity,
        location_similarity: match.locationSimilarity,
        match_method: 'name_location_similarity',
      });
    }

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: npsParks.length,
        matched: links.length,
        currentPark: npsPark.full_name,
      });
    }
  }

  return links;
};

/**
 * Create park links in the database
 * @param {Object} supabase - Supabase client
 * @param {Array} links - Array of link objects
 * @returns {Promise<Object>} Result with inserted count
 */
export const saveParkLinks = async (supabase, links) => {
  if (!links?.length) {
    return { inserted: 0 };
  }

  const { data, error } = await supabase
    .from('park_links')
    .upsert(
      links.map((link) => ({
        nps_park_id: link.nps_park_id,
        wikidata_park_id: link.wikidata_park_id,
        confidence_score: link.confidence_score,
        match_method: link.match_method,
      })),
      { onConflict: 'nps_park_id,wikidata_park_id' }
    )
    .select();

  if (error) {
    throw new Error(`Failed to save park links: ${error.message}`);
  }

  return { inserted: data?.length ?? 0 };
};

export default {
  normalizeString,
  calculateLevenshteinDistance,
  calculateNameSimilarity,
  haversineDistance,
  calculateLocationSimilarity,
  calculateOverallScore,
  findBestMatch,
  linkParks,
  saveParkLinks,
};