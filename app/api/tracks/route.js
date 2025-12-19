/**
 * Tracks API Route
 * GET /api/tracks - List all tracks for authenticated user
 * POST /api/tracks - Create a new track (pro users only)
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
  const supabase = createServerClient({ useServiceRole: true });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.error('Auth error:', error?.message);
    return null;
  }

  return user;
};

/**
 * Check if user has pro subscription
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user is pro
 */
const isUserPro = async (supabase, userId) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error checking pro status:', error);
    return false;
  }

  return profile?.is_pro === true;
};

/**
 * GET handler for listing user tracks
 */
export async function GET(request) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status'); // 'recording', 'completed', 'shared', etc.
    const activityType = searchParams.get('activityType'); // 'walking', 'hiking', 'biking', 'driving'
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Validate sort parameters
    const validSortFields = ['created_at', 'started_at', 'distance_meters', 'duration_seconds'];
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

    // Build query
    let query = supabase
      .from('user_tracks')
      .select(
        `
        id,
        title,
        description,
        activity_type,
        distance_meters,
        duration_seconds,
        elevation_gain_m,
        elevation_loss_m,
        avg_speed_mps,
        max_speed_mps,
        min_elevation_m,
        max_elevation_m,
        min_lat,
        max_lat,
        min_lng,
        max_lng,
        geometry,
        status,
        is_public,
        started_at,
        ended_at,
        shared_at,
        created_at,
        updated_at,
        park_id,
        park_code,
        trail_id,
        local_park_id,
        nps_parks (
          id,
          full_name,
          park_code
        ),
        trails (
          id,
          name,
          slug
        ),
        local_parks (
          id,
          name
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .neq('status', 'deleted');

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    // Apply sorting and pagination
    query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(offset, offset + limit - 1);

    const { data: tracks, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
    }

    // Get likes and comments counts
    const trackIds = tracks.map((t) => t.id);

    // Initialize counts
    const likesCounts = {};
    const commentsCounts = {};

    // Only query if there are tracks
    if (trackIds.length > 0) {
      const [likesResult, commentsResult] = await Promise.all([
        supabase.from('track_likes').select('track_id').in('track_id', trackIds),
        supabase.from('track_comments').select('track_id').in('track_id', trackIds),
      ]);

      // Count likes per track
      likesResult.data?.forEach((like) => {
        likesCounts[like.track_id] = (likesCounts[like.track_id] || 0) + 1;
      });

      // Count comments per track
      commentsResult.data?.forEach((comment) => {
        commentsCounts[comment.track_id] = (commentsCounts[comment.track_id] || 0) + 1;
      });
    }

    // Transform tracks
    const transformedTracks = tracks.map((track) => ({
      id: track.id,
      title: track.title,
      description: track.description,
      activityType: track.activity_type,
      distanceMeters: track.distance_meters,
      durationSeconds: track.duration_seconds,
      elevationGainM: track.elevation_gain_m,
      elevationLossM: track.elevation_loss_m,
      avgSpeedMps: track.avg_speed_mps,
      maxSpeedMps: track.max_speed_mps,
      minElevationM: track.min_elevation_m,
      maxElevationM: track.max_elevation_m,
      bounds: {
        minLat: track.min_lat,
        maxLat: track.max_lat,
        minLng: track.min_lng,
        maxLng: track.max_lng,
      },
      geometry: track.geometry,
      status: track.status,
      isPublic: track.is_public,
      startedAt: track.started_at,
      endedAt: track.ended_at,
      sharedAt: track.shared_at,
      createdAt: track.created_at,
      updatedAt: track.updated_at,
      park: track.nps_parks
        ? {
            id: track.nps_parks.id,
            name: track.nps_parks.full_name,
            parkCode: track.nps_parks.park_code,
          }
        : track.local_parks
          ? {
              id: track.local_parks.id,
              name: track.local_parks.name,
              type: 'local',
            }
          : null,
      trail: track.trails
        ? {
            id: track.trails.id,
            name: track.trails.name,
            slug: track.trails.slug,
          }
        : null,
      likesCount: likesCounts[track.id] || 0,
      commentsCount: commentsCounts[track.id] || 0,
    }));

    return NextResponse.json({
      tracks: transformedTracks,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST handler for creating a new track
 * Only available to pro users
 */
export async function POST(request) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Check if user is pro
    const isPro = await isUserPro(supabase, user.id);
    if (!isPro) {
      return NextResponse.json(
        {
          error: 'Pro subscription required',
          code: 'PRO_REQUIRED',
          message: 'Track recording is only available for Pro users. Upgrade to unlock this feature.',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      title,
      description,
      activityType = 'walking',
      parkId,
      parkCode,
      trailId,
      localParkId,
    } = body;

    // Validate activity type
    const validActivityTypes = ['walking', 'hiking', 'biking', 'driving'];
    if (!validActivityTypes.includes(activityType)) {
      return NextResponse.json(
        { error: `Invalid activityType. Must be one of: ${validActivityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate that at least one park/trail association is provided
    if (!parkId && !parkCode && !trailId && !localParkId) {
      return NextResponse.json(
        {
          error: 'Track must be associated with a park or trail',
          message: 'Please provide parkId, parkCode, trailId, or localParkId',
        },
        { status: 400 }
      );
    }

    // Validate parkId exists in nps_parks table if provided
    let validatedParkId = null;
    if (parkId) {
      const { data: npsPark, error: npsError } = await supabase
        .from('nps_parks')
        .select('id')
        .eq('id', parkId)
        .single();

      if (npsError || !npsPark) {
        console.warn(`Invalid parkId ${parkId} - not found in nps_parks table. Using parkCode instead.`);
        // Don't use the invalid parkId, fall back to parkCode only
      } else {
        validatedParkId = parkId;
      }
    }

    // Create the track
    const { data: track, error } = await supabase
      .from('user_tracks')
      .insert({
        user_id: user.id,
        title: title || null,
        description: description || null,
        activity_type: activityType,
        park_id: validatedParkId,
        park_code: parkCode || null,
        trail_id: trailId || null,
        local_park_id: localParkId || null,
        status: 'recording',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create track' }, { status: 500 });
    }

    return NextResponse.json(
      {
        track: {
          id: track.id,
          title: track.title,
          description: track.description,
          activityType: track.activity_type,
          status: track.status,
          startedAt: track.started_at,
          createdAt: track.created_at,
        },
        message: 'Track created successfully. Start recording GPS points.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
