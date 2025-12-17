import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * Get user from Authorization header
 * @param {Request} request - The request object
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserFromRequest(request) {
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.replace('Bearer ', '');
    const supabase = createServiceClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}

/**
 * GET /api/trails/[id]/media
 * Get all media for a trail
 */
export async function GET(request, { params }) {
  try {
    const { id: trailId } = await params;
    const supabase = createServiceClient();

    // Verify trail exists
    const { data: trail, error: trailError } = await supabase
      .from('trails')
      .select('id')
      .eq('id', trailId)
      .single();

    if (trailError || !trail) {
      return NextResponse.json({ error: 'Trail not found' }, { status: 404 });
    }

    // Get media for this trail
    const { data: media, error } = await supabase
      .from('trail_media')
      .select('*')
      .eq('trail_id', trailId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trail media:', error);
      return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }

    return NextResponse.json({ media: media || [] });
  } catch (error) {
    console.error('Error in GET /api/trails/[id]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/trails/[id]/media
 * Upload media for a trail
 * Note: This expects the file to already be uploaded to storage
 * and receives the URL in the request body
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trailId } = await params;
    const { url, media_type, caption } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify trail exists
    const { data: trail, error: trailError } = await supabase
      .from('trails')
      .select('id')
      .eq('id', trailId)
      .single();

    if (trailError || !trail) {
      return NextResponse.json({ error: 'Trail not found' }, { status: 404 });
    }

    // Create the media record
    const { data: media, error } = await supabase
      .from('trail_media')
      .insert({
        trail_id: trailId,
        user_id: user.id,
        url,
        media_type: media_type || 'image',
        caption: caption?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trail media:', error);
      return NextResponse.json({ error: 'Failed to create media' }, { status: 500 });
    }

    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/trails/[id]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/trails/[id]/media
 * Delete media (requires mediaId in query params)
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trailId } = await params;
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify media exists and belongs to user
    const { data: existingMedia, error: fetchError } = await supabase
      .from('trail_media')
      .select('*')
      .eq('id', mediaId)
      .eq('trail_id', trailId)
      .single();

    if (fetchError || !existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    if (existingMedia.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the media record
    const { error } = await supabase.from('trail_media').delete().eq('id', mediaId);

    if (error) {
      console.error('Error deleting trail media:', error);
      return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/trails/[id]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
