/**
 * Track Statistics Utilities
 *
 * Calculate distance, elevation, speed, and other statistics from track points.
 * All calculations are done client-side for real-time updates during tracking.
 *
 * @module lib/tracking/track-stats
 */

/**
 * Earth's radius in meters (WGS84 mean radius)
 */
const EARTH_RADIUS_M = 6371000;

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
};

/**
 * Calculate total distance from an array of points
 * @param {Array<Object>} points - Array of points with latitude and longitude
 * @returns {number} Total distance in meters
 */
export const calculateTotalDistance = (points) => {
  if (!points || points.length < 2) {
    return 0;
  }

  let totalDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const lat1 = prev.latitude ?? prev.lat;
    const lng1 = prev.longitude ?? prev.lng;
    const lat2 = curr.latitude ?? curr.lat;
    const lng2 = curr.longitude ?? curr.lng;

    if (lat1 != null && lng1 != null && lat2 != null && lng2 != null) {
      totalDistance += calculateDistance(lat1, lng1, lat2, lng2);
    }
  }

  return totalDistance;
};

/**
 * Calculate elevation statistics from points
 * @param {Array<Object>} points - Array of points with altitude
 * @returns {Object} Elevation statistics
 */
export const calculateElevationStats = (points) => {
  if (!points || points.length === 0) {
    return {
      gain: 0,
      loss: 0,
      min: null,
      max: null,
      start: null,
      end: null,
    };
  }

  let gain = 0;
  let loss = 0;
  let min = Infinity;
  let max = -Infinity;
  let start = null;
  let end = null;
  let prevAltitude = null;

  for (const point of points) {
    const altitude = point.altitudeM ?? point.altitude_m ?? point.altitude;

    if (altitude != null && !Number.isNaN(altitude)) {
      // Track min/max
      if (altitude < min) min = altitude;
      if (altitude > max) max = altitude;

      // Track start/end
      if (start === null) start = altitude;
      end = altitude;

      // Calculate gain/loss
      if (prevAltitude !== null) {
        const diff = altitude - prevAltitude;
        if (diff > 0) {
          gain += diff;
        } else {
          loss += Math.abs(diff);
        }
      }

      prevAltitude = altitude;
    }
  }

  return {
    gain: Math.round(gain * 100) / 100,
    loss: Math.round(loss * 100) / 100,
    min: min === Infinity ? null : Math.round(min * 100) / 100,
    max: max === -Infinity ? null : Math.round(max * 100) / 100,
    start,
    end,
  };
};

/**
 * Calculate speed statistics from points
 * @param {Array<Object>} points - Array of points with speed
 * @returns {Object} Speed statistics
 */
export const calculateSpeedStats = (points) => {
  if (!points || points.length === 0) {
    return {
      avg: 0,
      max: 0,
      min: 0,
    };
  }

  const speeds = points
    .map((p) => p.speedMps ?? p.speed_mps ?? p.speed)
    .filter((s) => s != null && !Number.isNaN(s) && s > 0);

  if (speeds.length === 0) {
    return {
      avg: 0,
      max: 0,
      min: 0,
    };
  }

  const sum = speeds.reduce((acc, s) => acc + s, 0);
  const avg = sum / speeds.length;
  const max = Math.max(...speeds);
  const min = Math.min(...speeds);

  return {
    avg: Math.round(avg * 1000) / 1000,
    max: Math.round(max * 1000) / 1000,
    min: Math.round(min * 1000) / 1000,
  };
};

/**
 * Calculate duration from points
 * @param {Array<Object>} points - Array of points with timestamps
 * @returns {number} Duration in seconds
 */
export const calculateDuration = (points) => {
  if (!points || points.length < 2) {
    return 0;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  const startTime = new Date(firstPoint.recordedAt ?? firstPoint.recorded_at ?? firstPoint.timestamp);
  const endTime = new Date(lastPoint.recordedAt ?? lastPoint.recorded_at ?? lastPoint.timestamp);

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return 0;
  }

  return Math.round((endTime - startTime) / 1000);
};

/**
 * Calculate bounding box from points
 * @param {Array<Object>} points - Array of points with coordinates
 * @returns {Object} Bounding box
 */
export const calculateBounds = (points) => {
  if (!points || points.length === 0) {
    return {
      minLat: null,
      maxLat: null,
      minLng: null,
      maxLng: null,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const point of points) {
    const lat = point.latitude ?? point.lat;
    const lng = point.longitude ?? point.lng;

    if (lat != null && lng != null) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  return {
    minLat: minLat === Infinity ? null : minLat,
    maxLat: maxLat === -Infinity ? null : maxLat,
    minLng: minLng === Infinity ? null : minLng,
    maxLng: maxLng === -Infinity ? null : maxLng,
  };
};

/**
 * Calculate all track statistics
 * @param {Array<Object>} points - Array of track points
 * @returns {Object} Complete track statistics
 */
export const calculateTrackStats = (points) => {
  const distance = calculateTotalDistance(points);
  const elevation = calculateElevationStats(points);
  const speed = calculateSpeedStats(points);
  const duration = calculateDuration(points);
  const bounds = calculateBounds(points);

  return {
    distanceMeters: Math.round(distance * 100) / 100,
    durationSeconds: duration,
    elevationGainM: elevation.gain,
    elevationLossM: elevation.loss,
    minElevationM: elevation.min,
    maxElevationM: elevation.max,
    avgSpeedMps: speed.avg,
    maxSpeedMps: speed.max,
    ...bounds,
    pointCount: points?.length || 0,
  };
};

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @param {string} [unit='auto'] - Unit preference ('metric', 'imperial', 'auto')
 * @returns {string} Formatted distance string
 */
export const formatDistance = (meters, unit = 'auto') => {
  if (meters == null || Number.isNaN(meters)) {
    return '0 m';
  }

  const useImperial = unit === 'imperial';

  if (useImperial) {
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      const feet = meters * 3.28084;
      return `${Math.round(feet)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  }

  // Metric
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
};

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (seconds) => {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format speed for display
 * @param {number} mps - Speed in meters per second
 * @param {string} [unit='auto'] - Unit preference ('metric', 'imperial', 'auto')
 * @returns {string} Formatted speed string
 */
export const formatSpeed = (mps, unit = 'auto') => {
  if (mps == null || Number.isNaN(mps)) {
    return '0';
  }

  const useImperial = unit === 'imperial';

  if (useImperial) {
    const mph = mps * 2.237;
    return `${mph.toFixed(1)} mph`;
  }

  const kph = mps * 3.6;
  return `${kph.toFixed(1)} km/h`;
};

/**
 * Format elevation for display
 * @param {number} meters - Elevation in meters
 * @param {string} [unit='auto'] - Unit preference ('metric', 'imperial', 'auto')
 * @returns {string} Formatted elevation string
 */
export const formatElevation = (meters, unit = 'auto') => {
  if (meters == null || Number.isNaN(meters)) {
    return '0';
  }

  const useImperial = unit === 'imperial';

  if (useImperial) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }

  return `${Math.round(meters)} m`;
};

/**
 * Format pace (time per distance unit)
 * @param {number} mps - Speed in meters per second
 * @param {string} [unit='auto'] - Unit preference ('metric', 'imperial', 'auto')
 * @returns {string} Formatted pace string
 */
export const formatPace = (mps, unit = 'auto') => {
  if (mps == null || Number.isNaN(mps) || mps <= 0) {
    return '--:--';
  }

  const useImperial = unit === 'imperial';

  // Calculate seconds per unit distance
  let secondsPerUnit;
  let unitLabel;

  if (useImperial) {
    // Seconds per mile
    secondsPerUnit = 1609.344 / mps;
    unitLabel = '/mi';
  } else {
    // Seconds per kilometer
    secondsPerUnit = 1000 / mps;
    unitLabel = '/km';
  }

  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.floor(secondsPerUnit % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}${unitLabel}`;
};

/**
 * Build GeoJSON LineString from points
 * @param {Array<Object>} points - Array of track points
 * @returns {Object} GeoJSON LineString
 */
export const buildGeoJSON = (points) => {
  if (!points || points.length < 2) {
    return null;
  }

  const coordinates = points
    .map((point) => {
      const lat = point.latitude ?? point.lat;
      const lng = point.longitude ?? point.lng;
      const alt = point.altitudeM ?? point.altitude_m ?? point.altitude;

      if (lat == null || lng == null) {
        return null;
      }

      return alt != null ? [lng, lat, alt] : [lng, lat];
    })
    .filter((coord) => coord !== null);

  if (coordinates.length < 2) {
    return null;
  }

  return {
    type: 'LineString',
    coordinates,
  };
};

/**
 * Simplify track points using Douglas-Peucker algorithm
 * Reduces number of points while preserving shape
 * @param {Array<Object>} points - Array of track points
 * @param {number} [tolerance=0.00001] - Simplification tolerance (in degrees)
 * @returns {Array<Object>} Simplified points
 */
export const simplifyTrack = (points, tolerance = 0.00001) => {
  if (!points || points.length <= 2) {
    return points;
  }

  const getDistance = (point, lineStart, lineEnd) => {
    const lat = point.latitude ?? point.lat;
    const lng = point.longitude ?? point.lng;
    const lat1 = lineStart.latitude ?? lineStart.lat;
    const lng1 = lineStart.longitude ?? lineStart.lng;
    const lat2 = lineEnd.latitude ?? lineEnd.lat;
    const lng2 = lineEnd.longitude ?? lineEnd.lng;

    const A = lat - lat1;
    const B = lng - lng1;
    const C = lat2 - lat1;
    const D = lng2 - lng1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lat1;
      yy = lng1;
    } else if (param > 1) {
      xx = lat2;
      yy = lng2;
    } else {
      xx = lat1 + param * C;
      yy = lng1 + param * D;
    }

    const dx = lat - xx;
    const dy = lng - yy;

    return Math.sqrt(dx * dx + dy * dy);
  };

  const douglasPeucker = (pts, start, end, tol) => {
    let maxDist = 0;
    let maxIndex = 0;

    for (let i = start + 1; i < end; i++) {
      const dist = getDistance(pts[i], pts[start], pts[end]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > tol) {
      const left = douglasPeucker(pts, start, maxIndex, tol);
      const right = douglasPeucker(pts, maxIndex, end, tol);
      return [...left.slice(0, -1), ...right];
    }

    return [pts[start], pts[end]];
  };

  return douglasPeucker(points, 0, points.length - 1, tolerance);
};

export default {
  calculateDistance,
  calculateTotalDistance,
  calculateElevationStats,
  calculateSpeedStats,
  calculateDuration,
  calculateBounds,
  calculateTrackStats,
  formatDistance,
  formatDuration,
  formatSpeed,
  formatElevation,
  formatPace,
  buildGeoJSON,
  simplifyTrack,
};
