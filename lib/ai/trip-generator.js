/**
 * AI Trip Generator
 * Generates multi-day park itineraries.
 *
 * c0mpute (peer inference via @profullstack/ai-providers) is tried first.
 * The original OpenAI GPT-4o streaming call is kept as the paid fallback.
 * c0mpute does not stream in ai-providers 0.1.x, so on c0mpute the whole
 * itinerary arrives at once and is passed to onChunk in one piece.
 */

import 'server-only';
import OpenAI from 'openai';
import { getAi, generateObjectOn } from '@profullstack/ai-providers';

/**
 * c0mpute runs at a few tokens a second, so a multi-day itinerary can take
 * many minutes. Override with TRIP_AI_TIMEOUT_MS.
 */
const C0MPUTE_TRIP_TIMEOUT_MS = Number(process.env.TRIP_AI_TIMEOUT_MS) || 900_000;

// Lazy-initialized OpenAI client (to avoid build-time errors)
let openai = null;

/**
 * Get or create the OpenAI client
 * Lazily initialized to avoid build-time errors when OPENAI_API_KEY is not set
 * @returns {OpenAI} OpenAI client instance
 */
const getOpenAIClient = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

/**
 * Available interests for trip planning
 */
export const TRIP_INTERESTS = [
  'camping',
  'hiking',
  'photography',
  'scenic_drives',
  'wildlife',
  'stargazing',
  'rock_climbing',
  'fishing',
  'kayaking',
  'bird_watching',
  'dispersed_camping',
  'off_grid',
  'boondocking',
];

/**
 * Difficulty levels
 */
export const DIFFICULTY_LEVELS = ['easy', 'moderate', 'hard'];

/**
 * System prompt for the AI trip planner
 */
const SYSTEM_PROMPT = `You are an expert national park trip planner for ParkLookup.com. Your role is to create detailed, practical multi-day itineraries based on user preferences and available parks.

RULES:
1. Only recommend parks from the provided park list - never invent parks
2. Consider driving distances between parks for realistic daily schedules
3. Match activities to user's stated interests and difficulty level
4. Provide specific, actionable recommendations (not generic advice)
5. Include practical packing items based on activities and season
6. Add safety notes relevant to the specific parks and activities
7. Each day should focus on ONE park to allow adequate exploration time
8. If BLM (Bureau of Land Management) lands are provided and user is interested in dispersed camping, off-grid, or boondocking, suggest nearby BLM areas for free camping options
9. When suggesting BLM land camping, always include important disclaimers about no facilities, fire restrictions, and checking local regulations

OUTPUT FORMAT:
You must respond with valid JSON matching this exact schema:
{
  "title": "string - Creative trip name (max 60 chars)",
  "overall_summary": "string - 2-3 sentence trip overview",
  "daily_schedule": [
    {
      "day": number,
      "park_code": "string - Must match a park_code from input",
      "park_name": "string",
      "activities": ["string array of specific activities"],
      "morning": "string - Morning plan with specific locations",
      "afternoon": "string - Afternoon plan with specific activities",
      "evening": "string - Evening plan or travel notes",
      "driving_notes": "string - Distance/time from previous location",
      "highlights": "string - Key attraction for this day",
      "nearby_blm_camping": "string (optional) - If BLM land is nearby and user wants dispersed camping, suggest it here with the BLM area name"
    }
  ],
  "packing_list": {
    "essentials": ["string array - must-have items"],
    "clothing": ["string array - weather-appropriate clothing"],
    "gear": ["string array - activity-specific gear"],
    "optional": ["string array - nice-to-have items"]
  },
  "safety_notes": ["string array of specific safety considerations"],
  "best_photo_spots": ["string array - if photography is an interest"],
  "blm_camping_tips": ["string array (optional) - tips for dispersed camping on BLM land if suggested"],
  "estimated_budget": {
    "entrance_fees": "string - total entrance fee estimate",
    "fuel_estimate": "string - estimated fuel cost",
    "blm_camping_savings": "string (optional) - estimated savings from free BLM camping vs paid campgrounds",
    "total_range": "string - total trip cost range excluding lodging"
  }
}`;

/**
 * Build the user prompt with trip preferences and available parks
 * @param {Object} options - Trip options
 * @param {string} options.origin - Starting location
 * @param {Date} options.startDate - Trip start date
 * @param {Date} options.endDate - Trip end date
 * @param {string[]} options.interests - User interests
 * @param {string} options.difficulty - Difficulty level
 * @param {number} options.radiusMiles - Search radius in miles
 * @param {Object[]} options.parks - Available parks within radius
 * @param {Object[]} options.blmLands - Available BLM lands within radius (optional)
 * @returns {string} Formatted user prompt
 */
const buildUserPrompt = ({ origin, startDate, endDate, interests, difficulty, radiusMiles, parks, blmLands = [] }) => {
  const tripDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
  
  // Get season from start date
  const month = new Date(startDate).getMonth();
  const season = month >= 2 && month <= 4 ? 'spring'
    : month >= 5 && month <= 7 ? 'summer'
    : month >= 8 && month <= 10 ? 'fall'
    : 'winter';

  // Check if user is interested in dispersed/free camping
  const wantsDispersedCamping = interests.some(i =>
    ['dispersed_camping', 'off_grid', 'boondocking', 'camping'].includes(i)
  );

  // Format parks for prompt (limit to top 15 by distance)
  const parksJson = parks
    .slice(0, 15)
    .map(park => ({
      park_code: park.park_code,
      full_name: park.full_name,
      description: park.description?.substring(0, 200) || '',
      activities: park.activities?.slice(0, 10) || [],
      designation: park.designation,
      distance_km: park.distance_km || park.distance,
      entrance_fees: park.entrance_fees?.slice(0, 2) || [],
    }));

  // Format BLM lands for prompt (limit to top 10)
  const blmJson = blmLands.slice(0, 10).map(blm => ({
    unit_name: blm.unit_name || blm.unitName,
    state: blm.state,
    area_acres: blm.area_acres || blm.areaAcres,
    distance_km: blm.distance_km || blm.distance,
  }));

  let prompt = `Create a ${tripDays}-day national park trip itinerary.

USER PREFERENCES:
- Starting Location: ${origin}
- Trip Dates: ${startDate} to ${endDate} (${season} season)
- Interests: ${interests.join(', ')}
- Difficulty Level: ${difficulty}
- Maximum Driving Radius: ${radiusMiles} miles

AVAILABLE PARKS (within radius, sorted by distance):
${JSON.stringify(parksJson, null, 2)}`;

  // Add BLM lands if user wants dispersed camping and BLM data is available
  if (wantsDispersedCamping && blmJson.length > 0) {
    prompt += `

NEARBY BLM LANDS (for free dispersed camping):
${JSON.stringify(blmJson, null, 2)}

BLM CAMPING NOTES:
- BLM land allows free dispersed camping (typically 14-day limit)
- No facilities: bring water, waste bags, and all supplies
- Check fire restrictions before camping
- Camp on previously disturbed areas only
- Leave No Trace principles apply`;
  }

  prompt += `

REQUIREMENTS:
1. Select ${Math.min(tripDays, parks.length)} parks that best match the user's interests: ${interests.join(', ')}
2. Order parks to minimize backtracking and total driving time
3. Allocate one full day per park for adequate exploration
4. Consider the ${difficulty} difficulty level when suggesting activities
5. Account for ${season} weather conditions in your recommendations
6. Include specific trail names, viewpoints, and attractions when possible`;

  if (wantsDispersedCamping && blmJson.length > 0) {
    prompt += `
7. Suggest nearby BLM land for free camping options when available
8. Include BLM camping tips and safety notes in your response`;
  }

  return prompt;
};

/**
 * Reduce a geocoded origin to city and state so a street address typed by the
 * user never reaches a peer inference node. Exported for the API route.
 * @param {Object} geo - Result of geocodeOrigin
 * @returns {string} e.g. "Denver, CO"
 */
export const coarseOrigin = (geo = {}) => {
  const region = geo.stateCode || geo.state;
  const parts = [geo.city || geo.county, region].filter(Boolean);
  return parts.length ? parts.join(', ') : region || 'the United States';
};

/**
 * Validate the generated trip data
 * @param {Object} tripData - Generated trip data
 * @param {Object[]} parks - Available parks
 * @returns {Object} Validation result with isValid and errors
 */
export const validateTripData = (tripData, parks) => {
  const errors = [];
  const validParkCodes = new Set(parks.map(p => p.park_code));

  // Check required fields
  if (!tripData.title) {errors.push('Missing title');}
  if (!tripData.overall_summary) {errors.push('Missing overall_summary');}
  if (!tripData.daily_schedule || !Array.isArray(tripData.daily_schedule)) {
    errors.push('Missing or invalid daily_schedule');
  }
  if (!tripData.packing_list) {errors.push('Missing packing_list');}
  if (!tripData.safety_notes) {errors.push('Missing safety_notes');}

  // Validate each day's park_code
  if (tripData.daily_schedule) {
    tripData.daily_schedule.forEach((day, index) => {
      if (!day.park_code) {
        errors.push(`Day ${index + 1}: Missing park_code`);
      } else if (!validParkCodes.has(day.park_code)) {
        errors.push(`Day ${index + 1}: Invalid park_code "${day.park_code}"`);
      }
      if (!day.park_name) {errors.push(`Day ${index + 1}: Missing park_name`);}
      if (!day.activities || !Array.isArray(day.activities)) {
        errors.push(`Day ${index + 1}: Missing or invalid activities`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validator in the shape ai-providers wants: throws on bad data so the
 * provider gets one repair attempt before the next provider is tried.
 * @param {Object[]} parks
 */
const tripSchema = (parks) => (value) => {
  const validation = validateTripData(value ?? {}, parks);
  if (!validation.isValid) {
    throw new Error(`Invalid trip data: ${validation.errors.join(', ')}`);
  }
  return value;
};

/**
 * The original OpenAI GPT-4o call, kept as the paid fallback.
 */
const generateTripOpenAI = async (userPrompt, parks, onChunk, onDayComplete) => {
  const stream = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    stream: true,
  });

  let fullContent = '';
  let lastDayCount = 0;

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    fullContent += content;

    // Call chunk callback
    if (onChunk && content) {
      onChunk(content);
    }

    // Detect day completion by counting "day": patterns
    const dayMatches = fullContent.match(/"day":\s*\d+/g);
    const currentDayCount = dayMatches ? dayMatches.length : 0;

    if (currentDayCount > lastDayCount && onDayComplete) {
      // Try to extract the latest day info
      try {
        const dayMatch = fullContent.match(/"day":\s*(\d+)[^}]*"park_name":\s*"([^"]+)"/g);
        if (dayMatch && dayMatch.length > lastDayCount) {
          const latestDay = dayMatch[dayMatch.length - 1];
          const dayNum = latestDay.match(/"day":\s*(\d+)/)?.[1];
          const parkName = latestDay.match(/"park_name":\s*"([^"]+)"/)?.[1];
          onDayComplete({
            day: parseInt(dayNum, 10),
            park_name: parkName,
          });
        }
      } catch {
        // Ignore parsing errors during streaming
      }
      lastDayCount = currentDayCount;
    }
  }

  if (!fullContent) {
    throw new Error('No response from AI model');
  }

  // Parse the complete response
  return tripSchema(parks)(JSON.parse(fullContent));
};

/**
 * Run the trip prompt on c0mpute first, then the paid fallback.
 * @returns {Promise<Object>} Validated trip data
 */
const runTrip = async (options, onChunk, onDayComplete) => {
  const { parks, ...tripOptions } = options;

  if (!parks || parks.length === 0) {
    throw new Error('No parks available within the specified radius');
  }

  const userPrompt = buildUserPrompt({ ...tripOptions, parks });

  try {
    const { provider, value } = await getAi().run(
      async (p) => {
        if (p.name === 'openai') {
          if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
          }
          return generateTripOpenAI(userPrompt, parks, onChunk, onDayComplete);
        }
        const { object, text } = await generateObjectOn(p, {
          name: 'Trip',
          system: SYSTEM_PROMPT,
          user: userPrompt,
          schema: tripSchema(parks),
          temperature: 0.7,
          maxTokens: 4000,
          timeoutMs: C0MPUTE_TRIP_TIMEOUT_MS,
          feature: 'trip',
        });
        if (onChunk && text) {
          onChunk(text);
        }
        if (onDayComplete) {
          for (const day of object.daily_schedule ?? []) {
            onDayComplete({ day: day.day, park_name: day.park_name });
          }
        }
        return object;
      },
      { feature: 'trip' }
    );
    console.info(`[trip-generator] itinerary from ${provider}`);
    return value;
  } catch (error) {
    // Keep the single-provider error text the UI showed before.
    const last = error?.attempts?.at(-1)?.error;
    throw new Error(last?.message || error.message || 'AI generation failed');
  }
};

/**
 * Generate a trip itinerary (non-streaming)
 * @param {Object} options - Trip generation options
 * @returns {Promise<Object>} Generated trip data
 */
export const generateTrip = async (options) => runTrip(options);

/**
 * Generate a trip itinerary, streaming when the provider can.
 * OpenAI streams chunk by chunk; c0mpute delivers the whole itinerary at once.
 * @param {Object} options - Trip generation options
 * @param {Function} onChunk - Callback for each chunk of data
 * @param {Function} onDayComplete - Callback when a day is fully generated
 * @returns {Promise<Object>} Generated trip data
 */
export const generateTripStream = async (options, onChunk, onDayComplete) =>
  runTrip(options, onChunk, onDayComplete);

/**
 * Prepare parks data for the AI prompt
 * Filters and formats park data to reduce token usage
 * @param {Object[]} parks - Raw parks from database
 * @returns {Object[]} Formatted parks for prompt
 */
export const prepareParksForPrompt = (parks) => parks.map(park => ({
    park_code: park.park_code,
    full_name: park.full_name,
    description: park.description?.substring(0, 200) || '',
    activities: Array.isArray(park.activities)
      ? park.activities.slice(0, 10).map(a => a.name || a)
      : [],
    designation: park.designation,
    distance_km: park.distance_km || park.distance,
    entrance_fees: park.entrance_fees?.slice(0, 2) || [],
    states: park.states,
  }));

/**
 * Prepare BLM lands data for the AI prompt
 * Filters and formats BLM land data to reduce token usage
 * @param {Object[]} blmLands - Raw BLM lands from database
 * @returns {Object[]} Formatted BLM lands for prompt
 */
export const prepareBLMLandsForPrompt = (blmLands) => blmLands.map(blm => ({
    unit_name: blm.unit_name || blm.unitName,
    state: blm.state,
    area_acres: blm.area_acres || blm.areaAcres,
    distance_km: blm.distance_km || blm.distance,
    centroid_lat: blm.centroid_lat || blm.centroidLat,
    centroid_lng: blm.centroid_lng || blm.centroidLng,
  }));

export default {
  coarseOrigin,
  generateTrip,
  generateTripStream,
  validateTripData,
  prepareParksForPrompt,
  prepareBLMLandsForPrompt,
  TRIP_INTERESTS,
  DIFFICULTY_LEVELS,
};