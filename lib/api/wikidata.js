/**
 * Wikidata SPARQL Data Fetcher
 *
 * This module provides functions to fetch park data from Wikidata using SPARQL queries
 * and transform it for storage in the database.
 *
 * Wikidata Query Service: https://query.wikidata.org/
 */

/** Wikidata SPARQL endpoint */
export const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

/** Default batch size for pagination */
const DEFAULT_LIMIT = 50;

/**
 * Builds a SPARQL query to fetch U.S. National Parks from Wikidata
 *
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Number of results per page
 * @param {number} [options.offset=0] - Pagination offset
 * @returns {string} SPARQL query string
 */
export const buildSparqlQuery = ({ limit = DEFAULT_LIMIT, offset = 0 } = {}) => `
SELECT ?park ?parkLabel ?image ?stateLabel ?coord ?website 
       ?area ?areaUnitLabel ?elev ?elevUnitLabel ?inception 
       ?managingOrgLabel ?commonsCat 
WHERE {
  ?park wdt:P31 wd:Q46169.
  ?park wdt:P17 wd:Q30.
  
  OPTIONAL { ?park wdt:P18 ?image. }
  OPTIONAL { ?park wdt:P131 ?state. }
  OPTIONAL { ?park wdt:P625 ?coord. }
  OPTIONAL { ?park wdt:P856 ?website. }
  OPTIONAL { 
    ?park wdt:P2046 ?areaNode.
    ?areaNode wikibase:quantityAmount ?area;
              wikibase:quantityUnit ?areaUnit.
  }
  OPTIONAL { 
    ?park wdt:P2044 ?elevNode.
    ?elevNode wikibase:quantityAmount ?elev;
              wikibase:quantityUnit ?elevUnit.
  }
  OPTIONAL { ?park wdt:P571 ?inception. }
  OPTIONAL { ?park wdt:P137 ?managingOrg. }
  OPTIONAL { ?park wdt:P373 ?commonsCat. }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${limit} OFFSET ${offset}
`;

/**
 * Parses Point coordinates from Wikidata format
 *
 * @param {string|null} coordString - Coordinate string in format "Point(lng lat)"
 * @returns {{latitude: number, longitude: number}|null} Parsed coordinates or null
 */
export const parseCoordinates = (coordString) => {
  if (!coordString) {
    return null;
  }

  const match = coordString.match(/Point\(([^ ]+) ([^)]+)\)/);
  if (!match) {
    return null;
  }

  return {
    latitude: parseFloat(match[2]),
    longitude: parseFloat(match[1]),
  };
};

/**
 * Extracts Wikidata ID from entity URI
 *
 * @param {string|null} uri - Wikidata entity URI
 * @returns {string} Wikidata ID (e.g., "Q180402") or empty string
 */
export const extractWikidataId = (uri) => {
  if (!uri) {
    return '';
  }
  return uri.split('/').pop() || '';
};

/**
 * Transforms a Wikidata SPARQL result to database format
 *
 * @param {Object} result - Single result from SPARQL query
 * @returns {Object} Transformed data for database
 */
export const transformWikidataResult = (result) => {
  const coords = parseCoordinates(result.coord?.value);
  const inception = result.inception?.value?.split('T')[0] ?? null;

  return {
    wikidata_id: extractWikidataId(result.park?.value),
    label: result.parkLabel?.value ?? null,
    image_url: result.image?.value ?? null,
    state: result.stateLabel?.value ?? null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    website: result.website?.value ?? null,
    area: result.area?.value ? parseFloat(result.area.value) : null,
    area_unit: result.areaUnitLabel?.value ?? null,
    elevation: result.elev?.value ? parseFloat(result.elev.value) : null,
    elevation_unit: result.elevUnitLabel?.value ?? null,
    inception,
    managing_org: result.managingOrgLabel?.value ?? null,
    commons_category: result.commonsCat?.value ?? null,
  };
};

/**
 * Fetches parks from Wikidata SPARQL endpoint
 *
 * @param {Object} options - Fetch options
 * @param {number} [options.limit=50] - Number of results per page
 * @param {number} [options.offset=0] - Pagination offset
 * @returns {Promise<Array>} Array of transformed park data
 * @throws {Error} If the SPARQL query fails
 */
export const fetchWikidataParks = async ({ limit = DEFAULT_LIMIT, offset = 0 } = {}) => {
  const query = buildSparqlQuery({ limit, offset });
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results.bindings.map(transformWikidataResult);
};

/**
 * Fetches all parks from Wikidata with automatic pagination
 *
 * @param {Object} options - Fetch options
 * @param {Function} [options.onProgress] - Callback for progress updates
 * @returns {Promise<Array>} All parks from Wikidata
 */
export const fetchAllWikidataParks = async ({ onProgress } = {}) => {
  const allParks = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const results = await fetchWikidataParks({
      limit: DEFAULT_LIMIT,
      offset,
    });

    if (results.length === 0) {
      hasMore = false;
    } else {
      allParks.push(...results);
      offset += DEFAULT_LIMIT;

      if (onProgress) {
        onProgress({
          fetched: allParks.length,
          offset,
        });
      }
    }
  }

  return allParks;
};

/**
 * Fetches a single park from Wikidata by its ID
 *
 * @param {string} wikidataId - Wikidata ID (e.g., "Q180402")
 * @returns {Promise<Object|null>} Park data or null if not found
 */
export const fetchWikidataParkById = async (wikidataId) => {
  const query = `
    SELECT ?park ?parkLabel ?image ?stateLabel ?coord ?website 
           ?area ?areaUnitLabel ?elev ?elevUnitLabel ?inception 
           ?managingOrgLabel ?commonsCat 
    WHERE {
      BIND(wd:${wikidataId} AS ?park)
      ?park wdt:P31 wd:Q46169.
      
      OPTIONAL { ?park wdt:P18 ?image. }
      OPTIONAL { ?park wdt:P131 ?state. }
      OPTIONAL { ?park wdt:P625 ?coord. }
      OPTIONAL { ?park wdt:P856 ?website. }
      OPTIONAL { 
        ?park wdt:P2046 ?areaNode.
        ?areaNode wikibase:quantityAmount ?area;
                  wikibase:quantityUnit ?areaUnit.
      }
      OPTIONAL { 
        ?park wdt:P2044 ?elevNode.
        ?elevNode wikibase:quantityAmount ?elev;
                  wikibase:quantityUnit ?elevUnit.
      }
      OPTIONAL { ?park wdt:P571 ?inception. }
      OPTIONAL { ?park wdt:P137 ?managingOrg. }
      OPTIONAL { ?park wdt:P373 ?commonsCat. }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1
  `;

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
    if (data.results.bindings.length === 0) {
      return null;
    }

    return transformWikidataResult(data.results.bindings[0]);
  } catch (error) {
    console.error(`Error fetching Wikidata park ${wikidataId}:`, error);
    return null;
  }
};

export default {
  WIKIDATA_SPARQL_ENDPOINT,
  buildSparqlQuery,
  parseCoordinates,
  extractWikidataId,
  transformWikidataResult,
  fetchWikidataParks,
  fetchAllWikidataParks,
  fetchWikidataParkById,
};