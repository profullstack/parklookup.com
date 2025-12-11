/**
 * WeatherAlerts Component
 * Fetches and displays weather alerts from weather.gov API
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Severity color mapping for weather alerts
 */
const severityColors = {
  Extreme: 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Severe:
    'bg-orange-100 border-orange-500 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Moderate:
    'bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Minor: 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Unknown: 'bg-gray-100 border-gray-500 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Severity badge colors
 */
const severityBadgeColors = {
  Extreme: 'bg-red-600 text-white',
  Severe: 'bg-orange-600 text-white',
  Moderate: 'bg-yellow-500 text-black',
  Minor: 'bg-blue-500 text-white',
  Unknown: 'bg-gray-500 text-white',
};

/**
 * Format date for display
 */
const formatDate = (dateString) => {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

/**
 * WeatherAlerts component - displays weather alerts for a location
 * @param {Object} props
 * @param {number} props.latitude - Location latitude
 * @param {number} props.longitude - Location longitude
 * @param {string} [props.parkName] - Name of the park for display
 */
export default function WeatherAlerts({ latitude, longitude, parkName }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAlerts, setExpandedAlerts] = useState(new Set());

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!latitude || !longitude) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`,
          {
            headers: {
              'User-Agent': 'ParkLookup (parklookup.com)',
              Accept: 'application/geo+json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();
        setAlerts(data.features || []);
      } catch (err) {
        console.error('Failed to fetch weather alerts:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [latitude, longitude]);

  const toggleAlert = (alertId) => {
    setExpandedAlerts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Failed to load weather alerts: {error}</span>
        </div>
      </div>
    );
  }

  if (!latitude || !longitude) {
    return (
      <div className="text-center py-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="text-gray-600 dark:text-gray-400">
          Location coordinates not available for weather alerts
        </p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <svg
          className="w-12 h-12 mx-auto text-green-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-green-800 dark:text-green-300 mb-1">
          No Active Weather Alerts
        </h3>
        <p className="text-green-600 dark:text-green-400 text-sm">
          {parkName ? `${parkName} currently has` : 'This location currently has'} no active weather
          alerts or warnings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {alerts.length} active alert{alerts.length !== 1 ? 's' : ''} for this area
        </p>
        <a
          href="https://www.weather.gov/alerts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View all alerts on weather.gov →
        </a>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const props = alert.properties;
          const severity = props.severity || 'Unknown';
          const isExpanded = expandedAlerts.has(alert.id);

          return (
            <div
              key={alert.id}
              className={`border-l-4 rounded-lg overflow-hidden ${severityColors[severity] || severityColors.Unknown}`}
            >
              <button
                onClick={() => toggleAlert(alert.id)}
                className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${severityBadgeColors[severity] || severityBadgeColors.Unknown}`}
                      >
                        {severity}
                      </span>
                      {props.certainty && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {props.certainty} certainty
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-base">{props.event || 'Weather Alert'}</h3>
                    <p className="text-sm opacity-80 mt-1">{props.headline}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs opacity-70">
                  {props.effective && (
                    <span>
                      <strong>Effective:</strong> {formatDate(props.effective)}
                    </span>
                  )}
                  {props.expires && (
                    <span>
                      <strong>Expires:</strong> {formatDate(props.expires)}
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-current/10">
                  {props.description && (
                    <div className="mt-3">
                      <h4 className="font-medium text-sm mb-1">Description</h4>
                      <p className="text-sm whitespace-pre-wrap opacity-90">{props.description}</p>
                    </div>
                  )}

                  {props.instruction && (
                    <div className="mt-3">
                      <h4 className="font-medium text-sm mb-1">Instructions</h4>
                      <p className="text-sm whitespace-pre-wrap opacity-90">{props.instruction}</p>
                    </div>
                  )}

                  {props.senderName && (
                    <div className="mt-3 text-xs opacity-70">
                      <strong>Source:</strong> {props.senderName}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
