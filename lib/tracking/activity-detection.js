/**
 * Activity Detection Utilities
 *
 * Automatically detects activity type based on speed data.
 * Uses rolling averages to smooth out GPS noise and provide stable detection.
 *
 * @module lib/tracking/activity-detection
 */

/**
 * Speed thresholds in meters per second
 * Based on typical speeds for each activity type
 */
export const SPEED_THRESHOLDS = {
  // Stationary: < 0.5 m/s (< 1.1 mph)
  STATIONARY_MAX: 0.5,
  // Walking: 0.5 - 2.7 m/s (1.1 - 6 mph)
  WALKING_MAX: 2.7,
  // Hiking: Similar to walking but may include elevation changes
  HIKING_MAX: 2.7,
  // Biking: 2.7 - 8.9 m/s (6 - 20 mph)
  BIKING_MAX: 8.9,
  // Driving: > 8.9 m/s (> 20 mph)
};

/**
 * Activity types
 */
export const ACTIVITY_TYPES = {
  STATIONARY: 'stationary',
  WALKING: 'walking',
  HIKING: 'hiking',
  BIKING: 'biking',
  DRIVING: 'driving',
};

/**
 * Convert meters per second to miles per hour
 * @param {number} mps - Speed in meters per second
 * @returns {number} Speed in miles per hour
 */
export const mpsToMph = (mps) => mps * 2.237;

/**
 * Convert miles per hour to meters per second
 * @param {number} mph - Speed in miles per hour
 * @returns {number} Speed in meters per second
 */
export const mphToMps = (mph) => mph / 2.237;

/**
 * Convert meters per second to kilometers per hour
 * @param {number} mps - Speed in meters per second
 * @returns {number} Speed in kilometers per hour
 */
export const mpsToKph = (mps) => mps * 3.6;

/**
 * Detect activity type from a single speed reading
 * @param {number} speedMps - Speed in meters per second
 * @returns {string} Activity type
 */
export const detectActivityFromSpeed = (speedMps) => {
  if (speedMps == null || Number.isNaN(speedMps)) {
    return ACTIVITY_TYPES.STATIONARY;
  }

  if (speedMps < SPEED_THRESHOLDS.STATIONARY_MAX) {
    return ACTIVITY_TYPES.STATIONARY;
  }

  if (speedMps < SPEED_THRESHOLDS.WALKING_MAX) {
    return ACTIVITY_TYPES.WALKING;
  }

  if (speedMps < SPEED_THRESHOLDS.BIKING_MAX) {
    return ACTIVITY_TYPES.BIKING;
  }

  return ACTIVITY_TYPES.DRIVING;
};

/**
 * Calculate rolling average of speeds
 * @param {Array<number>} speeds - Array of speed values
 * @param {number} [windowSize=10] - Number of values to average
 * @returns {number} Rolling average speed
 */
export const calculateRollingAverage = (speeds, windowSize = 10) => {
  if (!speeds || speeds.length === 0) {
    return 0;
  }

  // Filter out null/undefined/NaN values
  const validSpeeds = speeds.filter((s) => s != null && !Number.isNaN(s));

  if (validSpeeds.length === 0) {
    return 0;
  }

  // Take the last N values
  const recentSpeeds = validSpeeds.slice(-windowSize);

  // Calculate average
  const sum = recentSpeeds.reduce((acc, speed) => acc + speed, 0);
  return sum / recentSpeeds.length;
};

/**
 * Detect activity type from an array of recent speeds
 * Uses rolling average for stability
 * @param {Array<number>} speeds - Array of recent speed values (m/s)
 * @param {number} [windowSize=10] - Number of values to average
 * @returns {string} Activity type
 */
export const detectActivityFromSpeeds = (speeds, windowSize = 10) => {
  const avgSpeed = calculateRollingAverage(speeds, windowSize);
  return detectActivityFromSpeed(avgSpeed);
};

/**
 * Activity detector class for continuous tracking
 * Maintains state and provides stable activity detection
 */
export class ActivityDetector {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 10;
    this.stabilityThreshold = options.stabilityThreshold || 3;
    this.speeds = [];
    this.currentActivity = ACTIVITY_TYPES.STATIONARY;
    this.activityCounts = {};
    this.consecutiveCount = 0;
  }

  /**
   * Add a new speed reading and get the detected activity
   * @param {number} speedMps - Speed in meters per second
   * @returns {Object} Detection result
   */
  addSpeed(speedMps) {
    // Add to speeds array
    this.speeds.push(speedMps);

    // Keep only recent speeds
    if (this.speeds.length > this.windowSize * 2) {
      this.speeds = this.speeds.slice(-this.windowSize);
    }

    // Detect activity from rolling average
    const detectedActivity = detectActivityFromSpeeds(this.speeds, this.windowSize);

    // Track consecutive detections for stability
    if (detectedActivity === this.currentActivity) {
      this.consecutiveCount++;
    } else {
      // Only change activity if we've seen the new activity consistently
      this.activityCounts[detectedActivity] = (this.activityCounts[detectedActivity] || 0) + 1;

      if (this.activityCounts[detectedActivity] >= this.stabilityThreshold) {
        this.currentActivity = detectedActivity;
        this.consecutiveCount = this.activityCounts[detectedActivity];
        this.activityCounts = {};
      }
    }

    const avgSpeed = calculateRollingAverage(this.speeds, this.windowSize);

    return {
      activity: this.currentActivity,
      rawActivity: detectedActivity,
      avgSpeedMps: avgSpeed,
      avgSpeedMph: mpsToMph(avgSpeed),
      avgSpeedKph: mpsToKph(avgSpeed),
      isStable: this.consecutiveCount >= this.stabilityThreshold,
      confidence: Math.min(this.consecutiveCount / this.stabilityThreshold, 1),
    };
  }

  /**
   * Reset the detector state
   */
  reset() {
    this.speeds = [];
    this.currentActivity = ACTIVITY_TYPES.STATIONARY;
    this.activityCounts = {};
    this.consecutiveCount = 0;
  }

  /**
   * Get current activity without adding new data
   * @returns {string} Current activity type
   */
  getCurrentActivity() {
    return this.currentActivity;
  }

  /**
   * Get current average speed
   * @returns {number} Average speed in m/s
   */
  getAverageSpeed() {
    return calculateRollingAverage(this.speeds, this.windowSize);
  }
}

/**
 * Get activity icon emoji
 * @param {string} activity - Activity type
 * @returns {string} Emoji icon
 */
export const getActivityIcon = (activity) => {
  switch (activity) {
    case ACTIVITY_TYPES.WALKING:
      return '🚶';
    case ACTIVITY_TYPES.HIKING:
      return '🥾';
    case ACTIVITY_TYPES.BIKING:
      return '🚴';
    case ACTIVITY_TYPES.DRIVING:
      return '🚗';
    case ACTIVITY_TYPES.STATIONARY:
    default:
      return '📍';
  }
};

/**
 * Get activity display name
 * @param {string} activity - Activity type
 * @returns {string} Display name
 */
export const getActivityDisplayName = (activity) => {
  switch (activity) {
    case ACTIVITY_TYPES.WALKING:
      return 'Walking';
    case ACTIVITY_TYPES.HIKING:
      return 'Hiking';
    case ACTIVITY_TYPES.BIKING:
      return 'Biking';
    case ACTIVITY_TYPES.DRIVING:
      return 'Driving';
    case ACTIVITY_TYPES.STATIONARY:
      return 'Stationary';
    default:
      return 'Unknown';
  }
};

/**
 * Get activity color for UI
 * @param {string} activity - Activity type
 * @returns {string} Tailwind color class
 */
export const getActivityColor = (activity) => {
  switch (activity) {
    case ACTIVITY_TYPES.WALKING:
      return 'text-green-600';
    case ACTIVITY_TYPES.HIKING:
      return 'text-emerald-600';
    case ACTIVITY_TYPES.BIKING:
      return 'text-blue-600';
    case ACTIVITY_TYPES.DRIVING:
      return 'text-amber-600';
    case ACTIVITY_TYPES.STATIONARY:
    default:
      return 'text-gray-500';
  }
};

/**
 * Get activity background color for UI
 * @param {string} activity - Activity type
 * @returns {string} Tailwind background color class
 */
export const getActivityBgColor = (activity) => {
  switch (activity) {
    case ACTIVITY_TYPES.WALKING:
      return 'bg-green-100';
    case ACTIVITY_TYPES.HIKING:
      return 'bg-emerald-100';
    case ACTIVITY_TYPES.BIKING:
      return 'bg-blue-100';
    case ACTIVITY_TYPES.DRIVING:
      return 'bg-amber-100';
    case ACTIVITY_TYPES.STATIONARY:
    default:
      return 'bg-gray-100';
  }
};

/**
 * Determine the dominant activity from a track's points
 * @param {Array<Object>} points - Track points with speed_mps
 * @returns {string} Dominant activity type
 */
export const getDominantActivity = (points) => {
  if (!points || points.length === 0) {
    return ACTIVITY_TYPES.WALKING;
  }

  const activityCounts = {};

  points.forEach((point) => {
    if (point.speedMps != null || point.speed_mps != null) {
      const speed = point.speedMps ?? point.speed_mps;
      const activity = detectActivityFromSpeed(speed);
      // Don't count stationary as it's usually just pauses
      if (activity !== ACTIVITY_TYPES.STATIONARY) {
        activityCounts[activity] = (activityCounts[activity] || 0) + 1;
      }
    }
  });

  // Find the activity with the most counts
  let dominantActivity = ACTIVITY_TYPES.WALKING;
  let maxCount = 0;

  Object.entries(activityCounts).forEach(([activity, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantActivity = activity;
    }
  });

  return dominantActivity;
};

export default {
  SPEED_THRESHOLDS,
  ACTIVITY_TYPES,
  mpsToMph,
  mphToMps,
  mpsToKph,
  detectActivityFromSpeed,
  detectActivityFromSpeeds,
  calculateRollingAverage,
  ActivityDetector,
  getActivityIcon,
  getActivityDisplayName,
  getActivityColor,
  getActivityBgColor,
  getDominantActivity,
};
