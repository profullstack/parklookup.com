/**
 * AI Trip Generator
 * Generates multi-day park itineraries using OpenAI GPT-4o with streaming
 */

import 'server-only';
import OpenAI from 'openai';

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
      "highlights": "string - Key attraction for this day"
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
  "estimated_budget": {
    "entrance_fees": "string - total entrance fee estimate",
    "fuel_estimate": "string - estimated fuel cost",
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
 * @returns {string} Formatted user prompt
 */
const buildUserPrompt = ({ origin, startDate, endDate, interests, difficulty, radiusMiles, parks }) => {
  const tripDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
  
  // Get season from start date
  const month = new Date(startDate).getMonth();
  const season = month >= 2 && month <= 4 ? 'spring' 
    : month >= 5 && month <= 7 ? 'summer'
    : month >= 8 && month <= 10 ? 'fall'
    : 'winter';

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

  return `Create a ${tripDays}-day national park trip itinerary.

USER PREFERENCES:
- Starting Location: ${origin}
- Trip Dates: ${startDate} to ${endDate} (${season} season)
- Interests: ${interests.join(', ')}
- Difficulty Level: ${difficulty}
- Maximum Driving Radius: ${radiusMiles} miles

AVAILABLE PARKS (within radius, sorted by distance):
${JSON.stringify(parksJson, null, 2)}

REQUIREMENTS:
1. Select ${Math.min(tripDays, parks.length)} parks that best match the user's interests: ${interests.join(', ')}
2. Order parks to minimize backtracking and total driving time
3. Allocate one full day per park for adequate exploration
4. Consider the ${difficulty} difficulty level when suggesting activities
5. Account for ${season} weather conditions in your recommendations
6. Include specific trail names, viewpoints, and attractions when possible`;
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
 * Generate a trip itinerary using OpenAI GPT-4o (non-streaming)
 * @param {Object} options - Trip generation options
 * @returns {Promise<Object>} Generated trip data
 */
export const generateTrip = async (options) => {
  const { parks, ...tripOptions } = options;

  if (!parks || parks.length === 0) {
    throw new Error('No parks available within the specified radius');
  }

  const userPrompt = buildUserPrompt({ ...tripOptions, parks });

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  const tripData = JSON.parse(content);
  const validation = validateTripData(tripData, parks);

  if (!validation.isValid) {
    throw new Error(`Invalid trip data: ${validation.errors.join(', ')}`);
  }

  return tripData;
};

/**
 * Generate a trip itinerary using OpenAI GPT-4o with streaming
 * @param {Object} options - Trip generation options
 * @param {Function} onChunk - Callback for each chunk of data
 * @param {Function} onDayComplete - Callback when a day is fully generated
 * @returns {Promise<Object>} Generated trip data
 */
export const generateTripStream = async (options, onChunk, onDayComplete) => {
  const { parks, ...tripOptions } = options;

  if (!parks || parks.length === 0) {
    throw new Error('No parks available within the specified radius');
  }

  const userPrompt = buildUserPrompt({ ...tripOptions, parks });

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

  // Parse the complete response
  const tripData = JSON.parse(fullContent);
  const validation = validateTripData(tripData, parks);

  if (!validation.isValid) {
    throw new Error(`Invalid trip data: ${validation.errors.join(', ')}`);
  }

  return tripData;
};

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

export default {
  generateTrip,
  generateTripStream,
  validateTripData,
  prepareParksForPrompt,
  TRIP_INTERESTS,
  DIFFICULTY_LEVELS,
};