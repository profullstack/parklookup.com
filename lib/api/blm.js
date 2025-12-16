/**
 * BLM Land Data Normalization and Transformation Utilities
 *
 * Transforms GeoJSON BLM land data from USGS National Map SMA dataset
 * into a normalized format for the database.
 *
 * @module lib/api/blm
 */

/**
 * US State abbreviations for validation
 */
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

/**
 * Calculate the area of a polygon in acres using the Shoelace formula
 * This is an approximation that works well for small to medium polygons
 *
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {number} Area in acres (approximate)
 */
export const calculateAreaAcres = (geometry) => {
  if (!geometry || !geometry.coordinates) {
    return 0;
  }

  // Earth's radius in meters
  const R = 6371000;
  
  // Convert square meters to acres
  const SQ_METERS_TO_ACRES = 0.000247105;

  /**
   * Calculate area of a single ring using spherical excess formula
   */
  const calculateRingArea = (ring) => {
    if (!ring || ring.length < 4) return 0;

    let area = 0;
    const n = ring.length;

    for (let i = 0; i < n - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];

      // Convert to radians
      const phi1 = (lat1 * Math.PI) / 180;
      const phi2 = (lat2 * Math.PI) / 180;
      const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

      // Spherical excess formula (simplified)
      area += deltaLambda * (2 + Math.sin(phi1) + Math.sin(phi2));
    }

    area = (area * R * R) / 2;
    return Math.abs(area);
  };

  /**
   * Calculate area of a polygon (exterior ring minus interior rings)
   */
  const calculatePolygonArea = (coords) => {
    if (!coords || coords.length === 0) return 0;

    // Exterior ring
    let area = calculateRingArea(coords[0]);

    // Subtract interior rings (holes)
    for (let i = 1; i < coords.length; i++) {
      area -= calculateRingArea(coords[i]);
    }

    return Math.abs(area);
  };

  let totalArea = 0;

  if (geometry.type === 'Polygon') {
    totalArea = calculatePolygonArea(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      totalArea += calculatePolygonArea(polygon);
    }
  }

  return Math.round(totalArea * SQ_METERS_TO_ACRES);
};

/**
 * Calculate the centroid of a geometry
 *
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {{ lat: number, lng: number } | null} Centroid coordinates
 */
export const calculateCentroid = (geometry) => {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  /**
   * Get all coordinates from a geometry
   */
  const getAllCoordinates = (geom) => {
    const coords = [];

    if (geom.type === 'Polygon') {
      // Use only exterior ring for centroid
      if (geom.coordinates[0]) {
        coords.push(...geom.coordinates[0]);
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        if (polygon[0]) {
          coords.push(...polygon[0]);
        }
      }
    }

    return coords;
  };

  const coords = getAllCoordinates(geometry);

  if (coords.length === 0) {
    return null;
  }

  // Simple centroid calculation (average of all points)
  let sumLng = 0;
  let sumLat = 0;

  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }

  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length,
  };
};

/**
 * Convert a GeoJSON geometry to WKT format for PostGIS
 *
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {string | null} WKT string with SRID
 */
export const geometryToWKT = (geometry) => {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  /**
   * Convert a ring (array of coordinates) to WKT format
   */
  const ringToWKT = (ring) => {
    if (!ring || ring.length === 0) return '';
    return ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  };

  /**
   * Convert a polygon to WKT format
   */
  const polygonToWKT = (coords) => {
    if (!coords || coords.length === 0) return '';
    const rings = coords.map((ring) => `(${ringToWKT(ring)})`);
    return `(${rings.join(', ')})`;
  };

  let wkt;

  if (geometry.type === 'Polygon') {
    wkt = `POLYGON${polygonToWKT(geometry.coordinates)}`;
  } else if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates.map((poly) => polygonToWKT(poly));
    wkt = `MULTIPOLYGON(${polygons.join(', ')})`;
  } else {
    return null;
  }

  return `SRID=4326;${wkt}`;
};

/**
 * Convert a Polygon to MultiPolygon if needed
 * Ensures consistent geometry type for database storage
 *
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {Object} MultiPolygon geometry
 */
export const ensureMultiPolygon = (geometry) => {
  if (!geometry) {
    return null;
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry;
  }

  if (geometry.type === 'Polygon') {
    return {
      type: 'MultiPolygon',
      coordinates: [geometry.coordinates],
    };
  }

  // Unsupported geometry type
  return null;
};

/**
 * Extract state abbreviation from SMA properties
 *
 * @param {Object} properties - GeoJSON feature properties
 * @returns {string | null} Two-letter state abbreviation
 */
export const extractState = (properties) => {
  if (!properties) {
    return null;
  }

  // Try common property names for state
  const stateValue =
    properties.STATE_ABBR ||
    properties.ADMIN_ST ||
    properties.STATE ||
    properties.STATEABBR ||
    properties.ST ||
    properties.state ||
    null;

  if (!stateValue) {
    return null;
  }

  // Normalize to uppercase
  const normalized = String(stateValue).toUpperCase().trim();

  // Validate it's a known state
  if (US_STATES.has(normalized)) {
    return normalized;
  }

  // Try to extract from longer strings (e.g., "California" -> "CA")
  // This is a simplified mapping for common cases
  const stateNameMap = {
    CALIFORNIA: 'CA',
    NEVADA: 'NV',
    UTAH: 'UT',
    ARIZONA: 'AZ',
    COLORADO: 'CO',
    WYOMING: 'WY',
    MONTANA: 'MT',
    IDAHO: 'ID',
    OREGON: 'OR',
    WASHINGTON: 'WA',
    'NEW MEXICO': 'NM',
    ALASKA: 'AK',
  };

  return stateNameMap[normalized] || null;
};

/**
 * Extract unit name from SMA properties
 *
 * @param {Object} properties - GeoJSON feature properties
 * @returns {string | null} Unit name
 */
export const extractUnitName = (properties) => {
  if (!properties) {
    return null;
  }

  // Try common property names for unit name (ADMIN_UNIT_NAME first for sample data)
  const name =
    properties.ADMIN_UNIT_NAME ||
    properties.UNIT_NM ||
    properties.UNIT_NAME ||
    properties.NAME ||
    properties.name ||
    properties.LABEL ||
    null;

  if (!name) {
    return null;
  }

  // Clean up the name
  return String(name).trim() || null;
};

/**
 * Extract source ID from SMA properties
 *
 * @param {Object} properties - GeoJSON feature properties
 * @returns {string | null} Source ID
 */
export const extractSourceId = (properties) => {
  if (!properties) {
    return null;
  }

  // Try common property names for ID
  const id =
    properties.OBJECTID ||
    properties.FID ||
    properties.ID ||
    properties.id ||
    properties.GLOBALID ||
    properties.GlobalID ||
    null;

  if (id === null || id === undefined) {
    return null;
  }

  return String(id);
};

/**
 * Extract area in acres from SMA properties
 *
 * @param {Object} properties - GeoJSON feature properties
 * @returns {number | null} Area in acres
 */
export const extractAcres = (properties) => {
  if (!properties) {
    return null;
  }

  // Try common property names for acres (in order of preference)
  if (properties.ACRES !== undefined && properties.ACRES !== null) {
    return Number(properties.ACRES);
  }
  
  if (properties.GIS_ACRES !== undefined && properties.GIS_ACRES !== null) {
    return Number(properties.GIS_ACRES);
  }
  
  // Convert Shape__Area from square meters to acres
  if (properties.Shape__Area !== undefined && properties.Shape__Area !== null) {
    return Number(properties.Shape__Area) / 4046.86;
  }

  return null;
};

/**
 * Check if a feature is BLM-managed land
 *
 * @param {Object} properties - GeoJSON feature properties
 * @returns {boolean} True if BLM-managed
 */
export const isBLMManaged = (properties) => {
  if (!properties) {
    return false;
  }

  // Check for ADMIN_AGENCY_CODE (used by Arizona and other state BLM services)
  if (properties.ADMIN_AGENCY_CODE === 'BLM') {
    return true;
  }

  // Check for MGMT_AGNCY (used by Idaho)
  if (properties.MGMT_AGNCY === 'BLM') {
    return true;
  }

  // Check for AGNCY_NAME (used by Idaho)
  if (properties.AGNCY_NAME === 'BLM') {
    return true;
  }

  // Check for CATEGORY (used by some services)
  if (properties.CATEGORY === 'BLM') {
    return true;
  }

  // Check common property names for managing agency
  const agency =
    properties.ADMIN_AGENCY ||
    properties.AGENCY ||
    properties.MANAGING_AGENCY ||
    properties.OWNER ||
    '';

  const normalizedAgency = String(agency).toLowerCase();

  return (
    normalizedAgency.includes('bureau of land management') ||
    normalizedAgency.includes('blm') ||
    normalizedAgency === 'bureau of land management'
  );
};

/**
 * Transform a GeoJSON feature into a normalized BLM land object
 *
 * @param {Object} feature - GeoJSON feature
 * @returns {Object | null} Normalized BLM land object ready for database
 */
export const transformFeature = (feature) => {
  if (!feature || !feature.geometry) {
    return null;
  }

  const { properties, geometry } = feature;

  // Ensure we have a MultiPolygon
  const multiPolygon = ensureMultiPolygon(geometry);
  if (!multiPolygon) {
    return null;
  }

  // Calculate derived values
  const centroid = calculateCentroid(multiPolygon);
  
  // Try to get acres from properties first, then calculate from geometry
  const propsAcres = extractAcres(properties);
  const areaAcres = propsAcres ?? calculateAreaAcres(multiPolygon);
  
  // Get source ID and state
  const sourceId = extractSourceId(properties);
  const state = extractState(properties);
  
  // Get unit name, or generate one if not available
  let unitName = extractUnitName(properties);
  if (!unitName && sourceId && state) {
    // Generate a name like "BLM AZ Parcel 495449"
    unitName = `BLM ${state} Parcel ${sourceId}`;
  } else if (!unitName && sourceId) {
    unitName = `BLM Parcel ${sourceId}`;
  }

  return {
    source: 'blm',
    sourceId,
    unitName,
    managingAgency: 'Bureau of Land Management',
    state,
    geometry: multiPolygon,
    wkt: geometryToWKT(multiPolygon),
    areaAcres,
    centroidLat: centroid?.lat ?? null,
    centroidLng: centroid?.lng ?? null,
    rawData: properties,
  };
};

/**
 * Prepare BLM land data for Supabase insertion
 *
 * @param {Object} blmLand - Normalized BLM land object
 * @returns {Object} Object ready for Supabase insert
 */
export const prepareForDatabase = (blmLand) => ({
  source: blmLand.source,
  source_id: blmLand.sourceId,
  unit_name: blmLand.unitName,
  managing_agency: blmLand.managingAgency,
  state: blmLand.state,
  geometry: blmLand.wkt,
  area_acres: blmLand.areaAcres,
  centroid_lat: blmLand.centroidLat,
  centroid_lng: blmLand.centroidLng,
  raw_data: blmLand.rawData,
});

/**
 * Transform multiple GeoJSON features into normalized BLM land objects
 *
 * @param {Array<Object>} features - Array of GeoJSON features
 * @param {Object} options - Transform options
 * @param {boolean} options.filterBLMOnly - Only include BLM-managed lands
 * @param {string} options.stateFilter - Filter by state abbreviation
 * @returns {Array<Object>} Array of normalized BLM land objects
 */
export const transformFeatures = (features, options = {}) => {
  const { filterBLMOnly = true, stateFilter = null } = options;

  const results = [];

  for (const feature of features) {
    // Skip non-BLM lands if filtering
    if (filterBLMOnly && !isBLMManaged(feature.properties)) {
      continue;
    }

    const transformed = transformFeature(feature);

    if (!transformed) {
      continue;
    }

    // Apply state filter if specified
    if (stateFilter && transformed.state !== stateFilter.toUpperCase()) {
      continue;
    }

    results.push(transformed);
  }

  return results;
};

/**
 * Deduplicate BLM lands by sourceId (OBJECTID) or unit_name + state
 *
 * @param {Array<Object>} blmLands - Array of BLM land objects
 * @returns {Array<Object>} Deduplicated array
 */
export const deduplicateBLMLands = (blmLands) => {
  const seen = new Map();

  for (const land of blmLands) {
    // Primary key: sourceId (OBJECTID) - each parcel has a unique ID
    const sourceId = land.sourceId || land.source_id;
    const state = land.state;
    
    if (sourceId && state) {
      // Use sourceId + state as the key (handles multi-state datasets)
      const key = `${state}_${sourceId}`;
      if (!seen.has(key)) {
        seen.set(key, land);
      }
    } else if (sourceId) {
      // If no state, just use sourceId
      if (!seen.has(sourceId)) {
        seen.set(sourceId, land);
      }
    } else {
      // Fallback: use unit_name + state
      const unitName = land.unitName || land.unit_name;
      if (unitName && state) {
        const key = `name_${unitName}_${state}`;
        if (!seen.has(key)) {
          seen.set(key, land);
        }
      } else {
        // Last resort: use centroid
        const centroidLat = land.centroidLat ?? land.centroid_lat;
        const centroidLng = land.centroidLng ?? land.centroid_lng;
        const centroidKey = `centroid_${centroidLat?.toFixed(6)}_${centroidLng?.toFixed(6)}`;
        if (!seen.has(centroidKey)) {
          seen.set(centroidKey, land);
        }
      }
    }
  }

  return Array.from(seen.values());
};

/**
 * Format area in acres for display
 *
 * @param {number} acres - Area in acres
 * @returns {string} Formatted area string
 */
export const formatArea = (acres) => {
  if (!acres || acres <= 0) {
    return 'Unknown';
  }

  if (acres >= 1000000) {
    return `${(acres / 1000000).toFixed(2)}M acres`;
  }

  if (acres >= 1000) {
    return `${(acres / 1000).toFixed(1)}K acres`;
  }

  return `${Math.round(acres).toLocaleString()} acres`;
};

/**
 * Format distance in meters for display
 *
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
export const formatDistance = (meters) => {
  if (!meters || meters <= 0) {
    return 'Unknown';
  }

  // Convert to miles for US users
  const miles = meters / 1609.344;

  if (miles < 0.1) {
    return `${Math.round(meters)} m`;
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
};

export default {
  calculateAreaAcres,
  calculateCentroid,
  geometryToWKT,
  ensureMultiPolygon,
  extractState,
  extractUnitName,
  extractSourceId,
  extractAcres,
  isBLMManaged,
  transformFeature,
  prepareForDatabase,
  transformFeatures,
  deduplicateBLMLands,
  formatArea,
  formatDistance,
};