import { NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase/server';

/**
 * GET /api/activities/[activity]
 * Fetches all parks that have a specific activity
 *
 * @param {Request} request - The incoming request
 * @param {Object} context - Route context containing params
 * @returns {NextResponse} JSON response with parks data
 */
export async function GET(request, { params }) {
  try {
    const { activity } = await params;

    if (!activity) {
      return NextResponse.json({ error: 'Activity parameter is required' }, { status: 400 });
    }

    // Decode the activity slug (e.g., "hiking" or "rock-climbing")
    const decodedActivity = decodeURIComponent(activity).replace(/-/g, ' ');
    
    // Capitalize each word for proper matching (e.g., "craft demonstrations" -> "Craft Demonstrations")
    const capitalizedActivity = decodedActivity
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const supabase = createAnonClient();

    // Query parks where the activities JSONB array contains an object with matching name
    // The activities field is a JSONB array like: [{"id": "...", "name": "Hiking"}, ...]
    const { data: parks, error } = await supabase
      .from('nps_parks')
      .select(
        `
        id,
        park_code,
        full_name,
        description,
        states,
        latitude,
        longitude,
        designation,
        url,
        images,
        activities
      `
      )
      .filter('activities', 'cs', JSON.stringify([{ name: capitalizedActivity }]))
      .order('full_name', { ascending: true });

    if (error) {
      // If the containment search fails, try a text-based search as fallback
      console.warn('Containment search failed, trying text search:', error.message);

      const { data: fallbackParks, error: fallbackError } = await supabase
        .from('nps_parks')
        .select(
          `
          id,
          park_code,
          full_name,
          description,
          states,
          latitude,
          longitude,
          designation,
          url,
          images,
          activities
        `
        )
        .textSearch('activities', capitalizedActivity)
        .order('full_name', { ascending: true });

      if (fallbackError) {
        console.error('Error fetching parks by activity:', fallbackError);
        return NextResponse.json({ error: 'Failed to fetch parks' }, { status: 500 });
      }

      return NextResponse.json({
        activity: capitalizedActivity,
        parks: fallbackParks || [],
        count: fallbackParks?.length || 0,
      });
    }

    return NextResponse.json({
      activity: capitalizedActivity,
      parks: parks || [],
      count: parks?.length || 0,
    });
  } catch (error) {
    console.error('Error in activities API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}