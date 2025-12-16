/**
 * Trail Data Normalization and Transformation Utilities
 *
 * Transforms OSM trail data into a normalized format for the database.
 * Includes difficulty heuristics, slug generation, and length calculation.
 *
 * @module lib/api/trails
 */

/**
 * SAC hiking scale difficulty mapping
 * @see https://wiki.openstreetmap.org/wiki/Key:sac_scale
 */
const SAC_SCALE_DIFFICULTY = {
  hiking: 'easy',
  mountain_hiking: 'moderate',
  demanding_mountain_hiking: 'moderate',
  alpine_hiking: 'hard',
  demanding_alpine_hiking: 'hard',
  difficult_alpine_hiking: 'hard',
};

/**
 * Surface type normalization
 */
const SURFACE_MAPPING = {
  asphalt: 'paved',
  concrete: 'paved',
  paved: 'paved',
  paving_stones: 'paved',
  gravel: 'gravel',
  fine_gravel: 'gravel',
  compacted: 'gravel',
  dirt: 'dirt',
  earth: 'dirt',
  ground: 'dirt',
  grass: 'dirt',
  mud: 'dirt',
  sand: 'dirt',
  rock: 'rock',
  stone: 'rock',
  pebblestone: 'rock',
  wood: 'mixed',
  woodchips: 'mixed',
};

/**
 * Calculate the length of a LineString in meters using the Haversine formula
 *
 * @param {Array<Array<number>>} coordinates - Array of [lng, lat] coordinates
 * @returns {number} Length in meters
 */
export const calculateLength = (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    return 0;
  }

  let totalLength = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[i + 1];

    // Haversine formula
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalLength += R * c;
  }

  return Math.round(totalLength);
};

/**
 * Determine trail difficulty based on various factors
 *
 * Priority:
 * 1. SAC scale (if present)
 * 2. Length and elevation gain heuristics
 * 3. Default to 'easy'
 *
 * @param {Object} trail - Trail data with tags and computed values
 * @returns {string} Difficulty level: 'easy', 'moderate', or 'hard'
 */
export const calculateDifficulty = (trail) => {
  const { sacScale, lengthMeters, elevationGainM } = trail;

  // Priority 1: SAC scale
  if (sacScale && SAC_SCALE_DIFFICULTY[sacScale]) {
    return SAC_SCALE_DIFFICULTY[sacScale];
  }

  // Priority 2: Length and elevation heuristics
  const lengthKm = (lengthMeters || 0) / 1000;
  const gain = elevationGainM || 0;

  // Hard: > 15km or > 600m elevation gain
  if (lengthKm > 15 || gain > 600) {
    return 'hard';
  }

  // Moderate: > 8km or > 300m elevation gain
  if (lengthKm > 8 || gain > 300) {
    return 'moderate';
  }

  // Default: easy
  return 'easy';
};

/**
 * Generate a URL-friendly slug from trail name or source ID
 *
 * @param {string} name - Trail name
 * @param {string} sourceId - Source ID (fallback)
 * @returns {string} URL-friendly slug
 */
export const generateSlug = (name, sourceId) => {
  if (name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  return `trail-${sourceId}`;
};

/**
 * Normalize surface type from OSM tags
 *
 * @param {string} surface - OSM surface tag value
 * @returns {string|null} Normalized surface type or null
 */
export const normalizeSurface = (surface) => {
  if (!surface) {
    return null;
  }

  const normalized = surface.toLowerCase().trim();
  return SURFACE_MAPPING[normalized] || 'mixed';
};

/**
 * Determine trail type (loop, out-and-back, point-to-point)
 *
 * @param {Array<Array<number>>} coordinates - Trail coordinates
 * @returns {string} Trail type
 */
export const determineTrailType = (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    return 'point-to-point';
  }

  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  // Calculate distance between start and end points
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;

  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // If start and end are within 100 meters, it's a loop
  if (distance < 100) {
    return 'loop';
  }

  return 'point-to-point';
};

/**
 * Extract trail name from OSM tags
 *
 * @param {Object} tags - OSM tags
 * @returns {string|null} Trail name or null
 */
export const extractName = (tags) => {
  if (!tags) {
    return null;
  }

  // Priority order for name extraction
  return tags.name || tags['name:en'] || tags.ref || tags.description || null;
};

/**
 * Convert coordinates array to WKT LineString format
 *
 * @param {Array<Array<number>>} coordinates - Array of [lng, lat] coordinates
 * @returns {string} WKT LineString
 */
export const coordinatesToWKT = (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const points = coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `LINESTRING(${points})`;
};

/**
 * Transform an OSM element into a normalized trail object
 *
 * @param {Object} element - OSM element (way or relation)
 * @param {Array<Array<number>>} coordinates - Trail coordinates [lng, lat]
 * @returns {Object} Normalized trail object ready for database insertion
 */
export const transformOsmToTrail = (element, coordinates) => {
  const tags = element.tags || {};
  const name = extractName(tags);
  const lengthMeters = calculateLength(coordinates);
  const sacScale = tags.sac_scale || null;

  const trail = {
    source: 'osm',
    sourceId: `${element.type}/${element.id}`,
    slug: generateSlug(name, element.id),
    name,
    description: tags.description || null,
    sacScale,
    lengthMeters,
    elevationGainM: null, // Would require elevation data
    surface: normalizeSurface(tags.surface),
    trailType: determineTrailType(coordinates),
    trailVisibility: tags.trail_visibility || null,
    osmTags: tags,
    coordinates,
    wkt: coordinatesToWKT(coordinates),
  };

  // Calculate difficulty after we have all the data
  trail.difficulty = calculateDifficulty(trail);

  return trail;
};

/**
 * Transform multiple OSM elements into normalized trail objects
 *
 * @param {Array<Object>} elements - Array of OSM elements
 * @param {Function} extractCoordinates - Function to extract coordinates from element
 * @returns {Array<Object>} Array of normalized trail objects
 */
export const transformOsmElements = (elements, extractCoordinates) => {
  const trails = [];

  for (const element of elements) {
    // Skip elements without geometry
    if (!element.geometry && element.type !== 'relation') {
      continue;
    }

    const coordinates = extractCoordinates(element);

    // Skip if not enough coordinates for a line
    if (coordinates.length < 2) {
      continue;
    }

    try {
      const trail = transformOsmToTrail(element, coordinates);
      trails.push(trail);
    } catch (error) {
      console.warn(`Failed to transform OSM element ${element.id}: ${error.message}`);
    }
  }

  return trails;
};

/**
 * Prepare trail data for Supabase insertion
 *
 * @param {Object} trail - Normalized trail object
 * @param {Object} parkAssociation - Optional park association {parkId, parkSource}
 * @returns {Object} Object ready for Supabase insert
 */
export const prepareForDatabase = (trail, parkAssociation = null) => ({
    source: trail.source,
    source_id: trail.sourceId,
    slug: trail.slug,
    name: trail.name,
    description: trail.description,
    difficulty: trail.difficulty,
    length_meters: trail.lengthMeters,
    elevation_gain_m: trail.elevationGainM,
    surface: trail.surface,
    trail_type: trail.trailType,
    sac_scale: trail.sacScale,
    trail_visibility: trail.trailVisibility,
    osm_tags: trail.osmTags,
    geometry: trail.wkt,
    park_id: parkAssociation?.parkId || null,
    park_source: parkAssociation?.parkSource || null,
    last_seen_at: new Date().toISOString(),
  });

/**
 * Deduplicate trails by source_id
 *
 * @param {Array<Object>} trails - Array of trail objects
 * @returns {Array<Object>} Deduplicated array
 */
export const deduplicateTrails = (trails) => {
  const seen = new Map();

  for (const trail of trails) {
    const key = trail.sourceId || trail.source_id;
    if (!seen.has(key)) {
      seen.set(key, trail);
    }
  }

  return Array.from(seen.values());
};

export default {
  calculateLength,
  calculateDifficulty,
  generateSlug,
  normalizeSurface,
  determineTrailType,
  extractName,
  coordinatesToWKT,
  transformOsmToTrail,
  transformOsmElements,
  prepareForDatabase,
  deduplicateTrails,
};