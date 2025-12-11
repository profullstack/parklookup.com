/**
 * Trips API Route
 * GET /api/trips - List all trips for authenticated user
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Get authenticated user from request
 * @param {Request} request - Incoming request
 * @returns {Promise<Object|null>} User object or null
 */
const getAuthenticatedUser = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  // Use service role to validate the token - this bypasses RLS for auth operations
  const supabase = createServerClient({ useServiceRole: true });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.error('Auth error:', error?.message);
    return null;
  }

  return user;
};

/**
 * GET handler for listing user trips
 */
export async function GET(request) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Validate sort parameters
    const validSortFields = ['created_at', 'start_date', 'title'];
    const validSortOrders = ['asc', 'desc'];

    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: `Invalid sortBy. Must be one of: ${validSortFields.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validSortOrders.includes(sortOrder)) {
      return NextResponse.json(
        { error: 'Invalid sortOrder. Must be "asc" or "desc"' },
        { status: 400 }
      );
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Fetch trips with stop count
    const { data: trips, error, count } = await supabase
      .from('trips')
      .select(`
        id,
        title,
        origin,
        start_date,
        end_date,
        interests,
        difficulty,
        radius_miles,
        ai_summary,
        created_at,
        updated_at,
        trip_stops (
          id,
          park_code,
          day_number
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trips' },
        { status: 500 }
      );
    }

    // Transform trips to include park count and summary info
    const transformedTrips = trips.map(trip => ({
      id: trip.id,
      title: trip.title,
      origin: trip.origin,
      startDate: trip.start_date,
      endDate: trip.end_date,
      interests: trip.interests,
      difficulty: trip.difficulty,
      radiusMiles: trip.radius_miles,
      summary: trip.ai_summary?.overall_summary || null,
      parkCount: trip.trip_stops?.length || 0,
      dayCount: trip.trip_stops 
        ? new Set(trip.trip_stops.map(s => s.day_number)).size 
        : 0,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
    }));

    return NextResponse.json({
      trips: transformedTrips,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}