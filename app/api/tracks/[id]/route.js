/**
 * Individual Track API Route
 * GET /api/tracks/[id] - Get track details
 * PATCH /api/tracks/[id] - Update track (title, description, status)
 * DELETE /api/tracks/[id] - Delete a track
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
 * GET handler for getting track details
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServerClient({ useServiceRole: true });

    // Get track with related data
    const { data: track, error } = await supabase
      .from('user_tracks')
      .select(
        `
        id,
        user_id,
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
          park_code,
          images
        ),
        trails (
          id,
          name,
          slug,
          difficulty
        ),
        local_parks (
          id,
          name
        ),
        profiles!user_tracks_user_id_fkey (
          id,
          display_name,
          avatar_url,
          username
        )
      `
      )
      .eq('id', id)
      .neq('status', 'deleted')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Track not found' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch track' }, { status: 500 });
    }

    // Check access - track must be public or owned by user
    const user = await getAuthenticatedUser(request);
    const isOwner = user?.id === track.user_id;
    const isPublic = track.is_public && track.status === 'shared';

    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Get likes and comments counts
    const [likesResult, commentsResult] = await Promise.all([
      supabase.from('track_likes').select('id', { count: 'exact' }).eq('track_id', id),
      supabase.from('track_comments').select('id', { count: 'exact' }).eq('track_id', id),
    ]);

    // Check if current user has liked
    let userHasLiked = false;
    if (user) {
      const { data: userLike } = await supabase
        .from('track_likes')
        .select('id')
        .eq('track_id', id)
        .eq('user_id', user.id)
        .single();
      userHasLiked = !!userLike;
    }

    // Transform response
    const response = {
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
      isOwner,
      user: track.profiles
        ? {
            id: track.profiles.id,
            displayName: track.profiles.display_name,
            avatarUrl: track.profiles.avatar_url,
            username: track.profiles.username,
          }
        : null,
      park: track.nps_parks
        ? {
            id: track.nps_parks.id,
            name: track.nps_parks.full_name,
            parkCode: track.nps_parks.park_code,
            images: track.nps_parks.images,
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
            difficulty: track.trails.difficulty,
          }
        : null,
      likesCount: likesResult.count || 0,
      commentsCount: commentsResult.count || 0,
      userHasLiked,
    };

    return NextResponse.json({ track: response });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH handler for updating a track
 */
export async function PATCH(request, { params }) {
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

    // Verify ownership
    const { data: existingTrack, error: fetchError } = await supabase
      .from('user_tracks')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingTrack) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (existingTrack.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this track' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { title, description, activityType, status } = body;

    // Build update object
    const updates = {};

    if (title !== undefined) {
      updates.title = title;
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (activityType !== undefined) {
      const validActivityTypes = ['walking', 'hiking', 'biking', 'driving'];
      if (!validActivityTypes.includes(activityType)) {
        return NextResponse.json(
          { error: `Invalid activityType. Must be one of: ${validActivityTypes.join(', ')}` },
          { status: 400 }
        );
      }
      updates.activity_type = activityType;
    }

    if (status !== undefined) {
      const validStatuses = ['recording', 'paused', 'completed', 'shared', 'deleted'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }

      // Handle status transitions
      const canFinalize = ['recording', 'paused'].includes(existingTrack.status);
      if (status === 'completed' && canFinalize) {
        // Finalize the track - calculate stats
        const { data: finalizedTrack, error: finalizeError } = await supabase.rpc('finalize_track', {
          p_track_id: id,
        });

        if (finalizeError) {
          console.error('Error finalizing track:', finalizeError);
          // Continue with manual update if RPC fails
          updates.status = status;
          updates.ended_at = new Date().toISOString();
        } else {
          // Track was finalized via RPC, return it
          return NextResponse.json({
            track: {
              id: finalizedTrack.id,
              title: finalizedTrack.title,
              status: finalizedTrack.status,
              distanceMeters: finalizedTrack.distance_meters,
              durationSeconds: finalizedTrack.duration_seconds,
              elevationGainM: finalizedTrack.elevation_gain_m,
              updatedAt: finalizedTrack.updated_at,
            },
            message: 'Track finalized successfully',
          });
        }
      } else {
        updates.status = status;

        // Set ended_at when completing
        if (status === 'completed' && !existingTrack.ended_at) {
          updates.ended_at = new Date().toISOString();
        }

        // Set shared_at when sharing
        if (status === 'shared') {
          updates.is_public = true;
          updates.shared_at = new Date().toISOString();
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    // Update the track
    const { data: track, error: updateError } = await supabase
      .from('user_tracks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
    }

    return NextResponse.json({
      track: {
        id: track.id,
        title: track.title,
        description: track.description,
        activityType: track.activity_type,
        status: track.status,
        isPublic: track.is_public,
        updatedAt: track.updated_at,
      },
      message: 'Track updated successfully',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE handler for deleting a track
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

    // Verify ownership
    const { data: existingTrack, error: fetchError } = await supabase
      .from('user_tracks')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingTrack) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (existingTrack.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this track' }, { status: 403 });
    }

    // Soft delete - set status to 'deleted'
    const { error: deleteError } = await supabase
      .from('user_tracks')
      .update({
        status: 'deleted',
        is_public: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete track' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Track deleted successfully',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
