/**
 * Track Points API Route
 * GET /api/tracks/[id]/points - Get all points for a track
 * POST /api/tracks/[id]/points - Add GPS points (batch)
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
 * Validate GPS coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if valid
 */
const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  );
};

/**
 * GET handler for getting track points
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // First check if track exists and user has access
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id, is_public, status')
      .eq('id', id)
      .neq('status', 'deleted')
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Check access
    const user = await getAuthenticatedUser(request);
    const isOwner = user?.id === track.user_id;
    const isPublic = track.is_public && track.status === 'shared';

    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10000', 10), 50000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const simplified = searchParams.get('simplified') === 'true';

    // Build query
    let query = supabase
      .from('track_points')
      .select(
        simplified
          ? 'latitude, longitude, altitude_m, speed_mps, recorded_at, sequence_num'
          : '*',
        { count: 'exact' }
      )
      .eq('track_id', id)
      .order('sequence_num', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: points, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch track points' }, { status: 500 });
    }

    // Transform points
    const transformedPoints = points.map((point) => ({
      id: point.id,
      latitude: parseFloat(point.latitude),
      longitude: parseFloat(point.longitude),
      altitudeM: point.altitude_m ? parseFloat(point.altitude_m) : null,
      accuracyM: point.accuracy_m ? parseFloat(point.accuracy_m) : null,
      altitudeAccuracyM: point.altitude_accuracy_m ? parseFloat(point.altitude_accuracy_m) : null,
      speedMps: point.speed_mps ? parseFloat(point.speed_mps) : null,
      heading: point.heading ? parseFloat(point.heading) : null,
      sequenceNum: point.sequence_num,
      recordedAt: point.recorded_at,
    }));

    return NextResponse.json({
      points: transformedPoints,
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
 * POST handler for adding GPS points (batch)
 */
export async function POST(request, { params }) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Verify track ownership and status
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to add points to this track' }, { status: 403 });
    }

    // Only allow adding points to recording or paused tracks
    if (!['recording', 'paused'].includes(track.status)) {
      return NextResponse.json(
        {
          error: 'Cannot add points to this track',
          message: `Track status is "${track.status}". Points can only be added to recording or paused tracks.`,
        },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { points } = body;

    if (!Array.isArray(points) || points.length === 0) {
      return NextResponse.json(
        { error: 'Points array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Limit batch size
    const MAX_BATCH_SIZE = 1000;
    if (points.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} points` },
        { status: 400 }
      );
    }

    // Get current max sequence number
    const { data: maxSeqResult } = await supabase
      .from('track_points')
      .select('sequence_num')
      .eq('track_id', id)
      .order('sequence_num', { ascending: false })
      .limit(1)
      .single();

    let nextSequenceNum = (maxSeqResult?.sequence_num || 0) + 1;

    // Validate and transform points
    const validPoints = [];
    const errors = [];

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      // Validate required fields
      if (!isValidCoordinate(point.latitude, point.longitude)) {
        errors.push({
          index: i,
          error: 'Invalid coordinates',
          latitude: point.latitude,
          longitude: point.longitude,
        });
        continue;
      }

      // Validate optional fields
      if (point.altitudeM !== undefined && point.altitudeM !== null) {
        if (typeof point.altitudeM !== 'number' || point.altitudeM < -500 || point.altitudeM > 10000) {
          errors.push({
            index: i,
            error: 'Invalid altitude (must be between -500 and 10000 meters)',
            altitudeM: point.altitudeM,
          });
          continue;
        }
      }

      if (point.speedMps !== undefined && point.speedMps !== null) {
        if (typeof point.speedMps !== 'number' || point.speedMps < 0 || point.speedMps > 500) {
          errors.push({
            index: i,
            error: 'Invalid speed (must be between 0 and 500 m/s)',
            speedMps: point.speedMps,
          });
          continue;
        }
      }

      // Build point record
      validPoints.push({
        track_id: id,
        latitude: point.latitude,
        longitude: point.longitude,
        altitude_m: point.altitudeM ?? null,
        accuracy_m: point.accuracyM ?? null,
        altitude_accuracy_m: point.altitudeAccuracyM ?? null,
        speed_mps: point.speedMps ?? null,
        heading: point.heading ?? null,
        sequence_num: point.sequenceNum ?? nextSequenceNum++,
        recorded_at: point.recordedAt || new Date().toISOString(),
      });
    }

    if (validPoints.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid points to insert',
          validationErrors: errors,
        },
        { status: 400 }
      );
    }

    // Insert points
    const { data: insertedPoints, error: insertError } = await supabase
      .from('track_points')
      .insert(validPoints)
      .select('id, sequence_num');

    if (insertError) {
      console.error('Database error:', insertError);
      return NextResponse.json({ error: 'Failed to insert track points' }, { status: 500 });
    }

    // Update track's updated_at timestamp
    await supabase
      .from('user_tracks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json(
      {
        inserted: insertedPoints.length,
        points: insertedPoints.map((p) => ({
          id: p.id,
          sequenceNum: p.sequence_num,
        })),
        validationErrors: errors.length > 0 ? errors : undefined,
        message: `Successfully inserted ${insertedPoints.length} points`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE handler for clearing track points (for re-recording)
 */
export async function DELETE(request, { params }) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Verify track ownership
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete points from this track' }, { status: 403 });
    }

    // Only allow deleting points from recording or paused tracks
    if (!['recording', 'paused'].includes(track.status)) {
      return NextResponse.json(
        {
          error: 'Cannot delete points from this track',
          message: `Track status is "${track.status}". Points can only be deleted from recording or paused tracks.`,
        },
        { status: 400 }
      );
    }

    // Delete all points for this track
    const { error: deleteError, count } = await supabase
      .from('track_points')
      .delete({ count: 'exact' })
      .eq('track_id', id);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete track points' }, { status: 500 });
    }

    // Reset track stats
    await supabase
      .from('user_tracks')
      .update({
        distance_meters: null,
        duration_seconds: null,
        elevation_gain_m: null,
        elevation_loss_m: null,
        avg_speed_mps: null,
        max_speed_mps: null,
        min_elevation_m: null,
        max_elevation_m: null,
        min_lat: null,
        max_lat: null,
        min_lng: null,
        max_lng: null,
        geometry: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      deleted: count,
      message: `Successfully deleted ${count} points`,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
