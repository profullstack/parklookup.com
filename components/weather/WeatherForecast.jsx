'use client';

import { useState, useEffect } from 'react';

/**
 * Get weather emoji based on forecast description
 * @param {string} shortForecast - Short forecast description
 * @param {boolean} isDaytime - Whether it's daytime
 * @returns {string} Weather emoji
 */
function getWeatherEmoji(shortForecast, isDaytime) {
  const forecast = shortForecast.toLowerCase();

  if (forecast.includes('thunder') || forecast.includes('storm')) {return '⛈️';}
  if (forecast.includes('rain') && forecast.includes('snow')) {return '🌨️';}
  if (forecast.includes('rain') || forecast.includes('shower')) {return '🌧️';}
  if (forecast.includes('snow') || forecast.includes('flurr')) {return '❄️';}
  if (forecast.includes('sleet') || forecast.includes('ice')) {return '🌨️';}
  if (forecast.includes('fog') || forecast.includes('mist')) {return '🌫️';}
  if (forecast.includes('cloud') && forecast.includes('sun')) {return '⛅';}
  if (forecast.includes('partly') || forecast.includes('mostly cloudy')) {return isDaytime ? '⛅' : '☁️';}
  if (forecast.includes('cloud') || forecast.includes('overcast')) {return '☁️';}
  if (forecast.includes('wind')) {return '💨';}
  if (forecast.includes('clear') || forecast.includes('sunny')) {return isDaytime ? '☀️' : '🌙';}

  return isDaytime ? '🌤️' : '🌙';
}

/**
 * Format temperature with color coding
 * @param {number} temp - Temperature value
 * @param {string} unit - Temperature unit (F or C)
 * @returns {string} CSS class for temperature color
 */
function getTempColorClass(temp) {
  if (temp >= 90) {return 'text-red-600';}
  if (temp >= 80) {return 'text-orange-500';}
  if (temp >= 70) {return 'text-yellow-600';}
  if (temp >= 60) {return 'text-green-600';}
  if (temp >= 50) {return 'text-teal-600';}
  if (temp >= 40) {return 'text-blue-500';}
  if (temp >= 32) {return 'text-blue-600';}
  return 'text-blue-800';
}

/**
 * WeatherForecast component - displays 7-day forecast from NWS API
 * @param {Object} props
 * @param {number} props.latitude - Park latitude
 * @param {number} props.longitude - Park longitude
 * @param {string} props.parkName - Park name for display
 */
export default function WeatherForecast({ latitude, longitude, parkName }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!latitude || !longitude) {
        setError('No coordinates available');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/weather/${latitude}/${longitude}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch weather');
        }

        const data = await response.json();
        setForecast(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [latitude, longitude]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
          Weather forecast unavailable: {error}
        </p>
        <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
          Weather data is only available for locations within the United States.
        </p>
      </div>
    );
  }

  if (!forecast || !forecast.forecast?.length) {
    return null;
  }

  // Group forecast periods by day (combine day/night)
  const dailyForecasts = [];
  for (let i = 0; i < forecast.forecast.length; i += 2) {
    const dayPeriod = forecast.forecast[i];
    const nightPeriod = forecast.forecast[i + 1];
    dailyForecasts.push({
      day: dayPeriod,
      night: nightPeriod,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
          7-Day Forecast
        </h3>
        {forecast.location?.city && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {forecast.location.city}, {forecast.location.state}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {dailyForecasts.slice(0, 7).map((daily, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            {/* Day name */}
            <p className="text-sm font-medium text-gray-900 dark:text-white text-center mb-2">
              {daily.day?.name?.split(' ')[0] || `Day ${index + 1}`}
            </p>

            {/* Weather emoji */}
            <div className="text-3xl text-center mb-2">
              {getWeatherEmoji(daily.day?.shortForecast || '', true)}
            </div>

            {/* High/Low temps */}
            <div className="flex justify-center gap-2 text-sm mb-2">
              {daily.day && (
                <span className={`font-semibold ${getTempColorClass(daily.day.temperature)}`}>
                  {daily.day.temperature}°
                </span>
              )}
              {daily.night && (
                <span className="text-gray-400 dark:text-gray-500">
                  {daily.night.temperature}°
                </span>
              )}
            </div>

            {/* Short forecast */}
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center line-clamp-2">
              {daily.day?.shortForecast || 'N/A'}
            </p>

            {/* Wind */}
            {daily.day?.windSpeed && (
              <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-1">
                💨 {daily.day.windSpeed}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Last updated */}
      {forecast.updated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
          Updated: {new Date(forecast.updated).toLocaleString()}
        </p>
      )}

      {/* Attribution */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
        Data from{' '}
        <a
          href="https://www.weather.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-600 hover:underline"
        >
          National Weather Service
        </a>
      </p>
    </div>
  );
}