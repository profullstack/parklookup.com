import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Converts an activity name to a URL-friendly slug
 * @param {string} name - Activity name
 * @returns {string} URL-friendly slug
 */
function activityToSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

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

    // Decode the activity slug (e.g., "hiking" or "wildlife-watching")
    const activitySlug = decodeURIComponent(activity).toLowerCase();

    const supabase = createServerClient();

    // Fetch all parks with activities
    const { data: allParks, error } = await supabase
      .from('parks_combined')
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
        activities,
        wikidata_id,
        wikidata_image
      `
      )
      .not('activities', 'is', null)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching parks:', error);
      return NextResponse.json({ error: 'Failed to fetch parks' }, { status: 500 });
    }

    // Filter parks that have the matching activity (by converting activity names to slugs)
    const filteredParks = (allParks || []).filter(park => {
      if (!park.activities || !Array.isArray(park.activities)) {
        return false;
      }
      
      return park.activities.some(act => {
        if (!act || !act.name) return false;
        const actSlug = activityToSlug(act.name);
        return actSlug === activitySlug;
      });
    });

    // Get the display name from the first matching park's activity
    let displayName = activitySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    if (filteredParks.length > 0 && filteredParks[0].activities) {
      const matchingActivity = filteredParks[0].activities.find(act =>
        act && act.name && activityToSlug(act.name) === activitySlug
      );
      if (matchingActivity) {
        displayName = matchingActivity.name;
      }
    }

    return NextResponse.json({
      activity: displayName,
      parks: filteredParks,
      count: filteredParks.length,
    });
  } catch (error) {
    console.error('Error in activities API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}