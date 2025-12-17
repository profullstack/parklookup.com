/**
 * Track Share API Route
 * POST /api/tracks/[id]/share - Share track to feed
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
 * POST handler for sharing a track to the feed
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
      .select('id, user_id, status, is_public, title, distance_meters')
      .eq('id', id)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to share this track' }, { status: 403 });
    }

    // Only allow sharing completed tracks
    if (track.status !== 'completed') {
      return NextResponse.json(
        {
          error: 'Cannot share this track',
          message: `Track must be completed before sharing. Current status: "${track.status}"`,
        },
        { status: 400 }
      );
    }

    // Check if track has any points
    const { count: pointsCount } = await supabase
      .from('track_points')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', id);

    if (!pointsCount || pointsCount === 0) {
      return NextResponse.json(
        {
          error: 'Cannot share empty track',
          message: 'Track must have recorded GPS points before sharing.',
        },
        { status: 400 }
      );
    }

    // Check if already shared
    if (track.is_public && track.status === 'shared') {
      return NextResponse.json(
        {
          error: 'Track already shared',
          message: 'This track has already been shared to the feed.',
        },
        { status: 400 }
      );
    }

    // Parse optional body for title/description updates
    let updates = {
      status: 'shared',
      is_public: true,
      shared_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const body = await request.json();
      if (body.title) {
        updates.title = body.title;
      }
      if (body.description !== undefined) {
        updates.description = body.description;
      }
    } catch {
      // No body provided, that's fine
    }

    // Update track to shared status
    const { data: updatedTrack, error: updateError } = await supabase
      .from('user_tracks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json({ error: 'Failed to share track' }, { status: 500 });
    }

    return NextResponse.json({
      track: {
        id: updatedTrack.id,
        title: updatedTrack.title,
        status: updatedTrack.status,
        isPublic: updatedTrack.is_public,
        sharedAt: updatedTrack.shared_at,
      },
      message: 'Track shared successfully! It will now appear in the feed.',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE handler for unsharing a track (making it private again)
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
      .select('id, user_id, status, is_public')
      .eq('id', id)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to unshare this track' }, { status: 403 });
    }

    if (!track.is_public) {
      return NextResponse.json(
        {
          error: 'Track is not shared',
          message: 'This track is already private.',
        },
        { status: 400 }
      );
    }

    // Update track to private
    const { data: updatedTrack, error: updateError } = await supabase
      .from('user_tracks')
      .update({
        status: 'completed',
        is_public: false,
        shared_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json({ error: 'Failed to unshare track' }, { status: 500 });
    }

    return NextResponse.json({
      track: {
        id: updatedTrack.id,
        status: updatedTrack.status,
        isPublic: updatedTrack.is_public,
      },
      message: 'Track is now private and has been removed from the feed.',
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
