import { NextResponse } from 'next/server';

/**
 * GET /api/weather/[lat]/[lon]
 * Fetches weather forecast from the National Weather Service API
 *
 * The NWS API requires two calls:
 * 1. Get the grid point from coordinates: https://api.weather.gov/points/{lat},{lon}
 * 2. Fetch the forecast from the returned forecast URL
 *
 * @param {Request} request - The incoming request
 * @param {Object} context - Route context containing params
 * @returns {NextResponse} JSON response with forecast data
 */
export async function GET(request, { params }) {
  try {
    const { lat, lon } = await params;

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }

    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    // NWS API requires User-Agent header
    const headers = {
      'User-Agent': '(ParkLookup.com, contact@parklookup.com)',
      Accept: 'application/geo+json',
    };

    // Step 1: Get the grid point from coordinates
    const pointsUrl = `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsResponse = await fetch(pointsUrl, { headers });

    if (!pointsResponse.ok) {
      // NWS API may not have data for all locations (e.g., outside US)
      if (pointsResponse.status === 404) {
        return NextResponse.json(
          { error: 'Weather data not available for this location' },
          { status: 404 }
        );
      }
      throw new Error(`NWS Points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();
    const forecastUrl = pointsData.properties?.forecast;

    if (!forecastUrl) {
      return NextResponse.json({ error: 'Forecast URL not found' }, { status: 500 });
    }

    // Step 2: Fetch the forecast
    const forecastResponse = await fetch(forecastUrl, { headers });

    if (!forecastResponse.ok) {
      throw new Error(`NWS Forecast API error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties?.periods || [];

    // Return simplified forecast data
    return NextResponse.json({
      location: {
        city: pointsData.properties?.relativeLocation?.properties?.city,
        state: pointsData.properties?.relativeLocation?.properties?.state,
        gridId: pointsData.properties?.gridId,
      },
      forecast: periods.slice(0, 14).map((period) => ({
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
        isDaytime: period.isDaytime,
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        windSpeed: period.windSpeed,
        windDirection: period.windDirection,
        shortForecast: period.shortForecast,
        detailedForecast: period.detailedForecast,
        icon: period.icon,
      })),
      updated: forecastData.properties?.updateTime,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 });
  }
}