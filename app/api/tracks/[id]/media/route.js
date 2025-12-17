import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';
import {
  validateMedia,
  processMedia,
  getMediaType,
} from '@/lib/media/media-processor';

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
 * GET /api/tracks/[id]/media
 * Get all media attached to a track
 */
export async function GET(request, { params }) {
  try {
    const { id: trackId } = await params;

    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get track to verify access
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id, is_public, status')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Check access - either owner or public track
    const user = await getUserFromRequest(request);
    const isOwner = user?.id === track.user_id;
    const isPublic = track.is_public && track.status === 'shared';

    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get track media with details
    const { data: trackMedia, error: mediaError } = await supabase
      .from('track_media')
      .select(`
        id,
        track_id,
        media_id,
        latitude,
        longitude,
        altitude_m,
        captured_at,
        display_order,
        created_at,
        user_media (
          id,
          media_type,
          storage_path,
          thumbnail_path,
          title,
          description,
          width,
          height,
          duration,
          status
        )
      `)
      .eq('track_id', trackId)
      .order('captured_at', { ascending: true, nullsFirst: false })
      .order('display_order', { ascending: true });

    if (mediaError) {
      console.error('Error fetching track media:', mediaError);
      return NextResponse.json({ error: 'Failed to fetch track media' }, { status: 500 });
    }

    // Filter out media that isn't ready and add URLs
    const mediaWithUrls = (trackMedia || [])
      .filter((tm) => tm.user_media?.status === 'ready')
      .map((tm) => {
        const { data: mediaUrl } = supabase.storage
          .from('user-media')
          .getPublicUrl(tm.user_media.storage_path);

        const { data: thumbnailUrl } = tm.user_media.thumbnail_path
          ? supabase.storage.from('media-thumbnails').getPublicUrl(tm.user_media.thumbnail_path)
          : { data: null };

        return {
          id: tm.id,
          track_id: tm.track_id,
          media_id: tm.media_id,
          latitude: tm.latitude,
          longitude: tm.longitude,
          altitude_m: tm.altitude_m,
          captured_at: tm.captured_at,
          display_order: tm.display_order,
          created_at: tm.created_at,
          media_type: tm.user_media.media_type,
          title: tm.user_media.title,
          description: tm.user_media.description,
          width: tm.user_media.width,
          height: tm.user_media.height,
          duration: tm.user_media.duration,
          url: mediaUrl?.publicUrl,
          thumbnail_url: thumbnailUrl?.publicUrl,
        };
      });

    return NextResponse.json({ media: mediaWithUrls });
  } catch (error) {
    console.error('Error in GET /api/tracks/[id]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tracks/[id]/media
 * Upload new media to a track or link existing media
 * 
 * For new uploads: send FormData with 'file' field
 * For linking existing: send JSON with 'mediaId' field
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trackId } = await params;

    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify track ownership
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id, status')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check content type to determine if it's a file upload or link request
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      return await handleFileUpload(request, supabase, user, trackId);
    } else {
      // Handle linking existing media
      return await handleLinkMedia(request, supabase, user, trackId);
    }
  } catch (error) {
    console.error('Error in POST /api/tracks/[id]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle file upload to track
 */
async function handleFileUpload(request, supabase, user, trackId) {
  const formData = await request.formData();
  const file = formData.get('file');
  const title = formData.get('title') || '';
  const description = formData.get('description') || '';
  const latitude = formData.get('latitude');
  const longitude = formData.get('longitude');
  const altitude = formData.get('altitude');
  const capturedAt = formData.get('capturedAt');

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Get file buffer and validate
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type;
  const originalFilename = file.name;

  // Validate media
  const validation = validateMedia(buffer, mimeType);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const mediaType = getMediaType(mimeType);

  // Create initial media record with processing status
  const mediaId = randomUUID();
  const { error: insertError } = await supabase.from('user_media').insert({
    id: mediaId,
    user_id: user.id,
    park_code: null,
    local_park_id: null,
    media_type: mediaType,
    storage_path: '',
    original_filename: originalFilename,
    file_size: buffer.length,
    mime_type: mimeType,
    title: title.trim() || null,
    description: description.trim() || null,
    status: 'processing',
  });

  if (insertError) {
    console.error('Error creating media record:', insertError);
    return NextResponse.json({ error: 'Failed to create media record' }, { status: 500 });
  }

  try {
    const processed = await processMedia(buffer, mimeType, originalFilename);

    // Generate storage paths
    const timestamp = Date.now();
    const extension = processed.mimeType === 'video/mp4' ? 'mp4' : 'jpg';
    const storagePath = `${user.id}/${mediaId}/${timestamp}.${extension}`;
    const thumbnailPath = `${user.id}/${mediaId}/${timestamp}-thumb.jpg`;

    // Upload processed media to storage
    const { error: uploadError } = await supabase.storage
      .from('user-media')
      .upload(storagePath, processed.processedBuffer, {
        contentType: processed.mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload media: ${uploadError.message}`);
    }

    // Upload thumbnail (if available)
    let thumbUploadError = null;
    if (processed.thumbnailBuffer) {
      const { error } = await supabase.storage
        .from('media-thumbnails')
        .upload(thumbnailPath, processed.thumbnailBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      thumbUploadError = error;

      if (thumbUploadError) {
        console.error('Failed to upload thumbnail:', thumbUploadError);
      }
    }

    // Update media record with processed info
    const hasThumbnail = processed.thumbnailBuffer && !thumbUploadError;
    const { data: updatedMedia, error: updateError } = await supabase
      .from('user_media')
      .update({
        storage_path: storagePath,
        thumbnail_path: hasThumbnail ? thumbnailPath : null,
        mime_type: processed.mimeType,
        width: processed.width,
        height: processed.height,
        duration: processed.duration || null,
        status: 'ready',
      })
      .eq('id', mediaId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update media record: ${updateError.message}`);
    }

    // Link media to track
    const { data: trackMedia, error: linkError } = await supabase
      .from('track_media')
      .insert({
        track_id: trackId,
        media_id: mediaId,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        altitude_m: altitude ? parseFloat(altitude) : null,
        captured_at: capturedAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (linkError) {
      console.error('Error linking media to track:', linkError);
      return NextResponse.json({ error: 'Failed to link media to track' }, { status: 500 });
    }

    // Get public URLs
    const { data: mediaUrl } = supabase.storage.from('user-media').getPublicUrl(storagePath);
    const { data: thumbnailUrl } = supabase.storage.from('media-thumbnails').getPublicUrl(thumbnailPath);

    return NextResponse.json(
      {
        trackMedia: {
          ...trackMedia,
          media_type: mediaType,
          title: updatedMedia.title,
          description: updatedMedia.description,
          width: updatedMedia.width,
          height: updatedMedia.height,
          duration: updatedMedia.duration,
          url: mediaUrl.publicUrl,
          thumbnail_url: thumbnailUrl?.publicUrl,
        },
      },
      { status: 201 }
    );
  } catch (processingError) {
    console.error('Error processing media:', processingError);

    // Update media record with error status
    await supabase
      .from('user_media')
      .update({
        status: 'failed',
        processing_error: processingError.message,
      })
      .eq('id', mediaId);

    return NextResponse.json({ error: `Failed to process media: ${processingError.message}` }, { status: 500 });
  }
}

/**
 * Handle linking existing media to track
 */
async function handleLinkMedia(request, supabase, user, trackId) {
  const body = await request.json();
  const { mediaId, latitude, longitude, altitude, capturedAt } = body;

  if (!mediaId) {
    return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
  }

  // Verify media ownership
  const { data: media, error: mediaError } = await supabase
    .from('user_media')
    .select('*')
    .eq('id', mediaId)
    .eq('user_id', user.id)
    .eq('status', 'ready')
    .single();

  if (mediaError || !media) {
    return NextResponse.json({ error: 'Media not found or not ready' }, { status: 404 });
  }

  // Check if already linked
  const { data: existing } = await supabase
    .from('track_media')
    .select('id')
    .eq('track_id', trackId)
    .eq('media_id', mediaId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Media already linked to this track' }, { status: 409 });
  }

  // Get next display order
  const { data: maxOrder } = await supabase
    .from('track_media')
    .select('display_order')
    .eq('track_id', trackId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const displayOrder = (maxOrder?.display_order ?? -1) + 1;

  // Link media to track
  const { data: trackMedia, error: linkError } = await supabase
    .from('track_media')
    .insert({
      track_id: trackId,
      media_id: mediaId,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      altitude_m: altitude ?? null,
      captured_at: capturedAt || new Date().toISOString(),
      display_order: displayOrder,
    })
    .select()
    .single();

  if (linkError) {
    console.error('Error linking media to track:', linkError);
    return NextResponse.json({ error: 'Failed to link media to track' }, { status: 500 });
  }

  // Get public URLs
  const { data: mediaUrl } = supabase.storage.from('user-media').getPublicUrl(media.storage_path);
  const { data: thumbnailUrl } = media.thumbnail_path
    ? supabase.storage.from('media-thumbnails').getPublicUrl(media.thumbnail_path)
    : { data: null };

  return NextResponse.json(
    {
      trackMedia: {
        ...trackMedia,
        media_type: media.media_type,
        title: media.title,
        description: media.description,
        width: media.width,
        height: media.height,
        duration: media.duration,
        url: mediaUrl.publicUrl,
        thumbnail_url: thumbnailUrl?.publicUrl,
      },
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/tracks/[id]/media
 * Remove media from a track (does not delete the media itself)
 * Query param: mediaId - the track_media link ID or media_id
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trackId } = await params;
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');
    const linkId = searchParams.get('linkId');

    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    if (!mediaId && !linkId) {
      return NextResponse.json({ error: 'Media ID or Link ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify track ownership
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete the link
    let query = supabase.from('track_media').delete().eq('track_id', trackId);

    if (linkId) {
      query = query.eq('id', linkId);
    } else {
      query = query.eq('media_id', mediaId);
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      console.error('Error removing media from track:', deleteError);
      return NextResponse.json({ error: 'Failed to remove media from track' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/tracks/[id]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/tracks/[id]/media
 * Update media link (e.g., reorder, update geolocation)
 */
export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: trackId } = await params;

    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { linkId, mediaId, displayOrder, latitude, longitude, altitude, capturedAt } = body;

    if (!linkId && !mediaId) {
      return NextResponse.json({ error: 'Link ID or Media ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify track ownership
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('id, user_id')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build update object
    const updates = {};
    if (displayOrder !== undefined) updates.display_order = displayOrder;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (altitude !== undefined) updates.altitude_m = altitude;
    if (capturedAt !== undefined) updates.captured_at = capturedAt;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Update the link
    let query = supabase.from('track_media').update(updates).eq('track_id', trackId);

    if (linkId) {
      query = query.eq('id', linkId);
    } else {
      query = query.eq('media_id', mediaId);
    }

    const { data: updated, error: updateError } = await query.select().single();

    if (updateError) {
      console.error('Error updating track media:', updateError);
      return NextResponse.json({ error: 'Failed to update track media' }, { status: 500 });
    }

    return NextResponse.json({ trackMedia: updated });
  } catch (error) {
    console.error('Error in PATCH /api/tracks/[id]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
