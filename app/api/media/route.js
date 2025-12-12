import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';
import {
  validateMedia,
  processMedia,
  getMediaType,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
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
 * GET /api/media
 * Get user's media or media for a specific park
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parkCode = searchParams.get('parkCode');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = createServiceClient();

    // Build query - fetch media without relationship joins
    let query = supabase
      .from('user_media')
      .select('*')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (parkCode) {
      query = query.eq('park_code', parkCode);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: media, error } = await query;

    if (error) {
      console.error('Error fetching media:', error);
      return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }

    if (!media || media.length === 0) {
      return NextResponse.json({ media: [] });
    }

    // Get unique user IDs and park codes
    const userIds = [...new Set(media.map((m) => m.user_id))];
    const parkCodes = [...new Set(media.map((m) => m.park_code).filter(Boolean))];
    const mediaIds = media.map((m) => m.id);

    // Fetch profiles separately
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    // Fetch parks separately (from all_parks view to support all park types)
    const { data: parks } = await supabase
      .from('all_parks')
      .select('id, park_code, full_name')
      .in('park_code', parkCodes);

    // Fetch likes and comments counts
    const { data: likeCounts } = await supabase
      .from('media_likes')
      .select('media_id')
      .in('media_id', mediaIds);

    const { data: commentCounts } = await supabase
      .from('media_comments')
      .select('media_id')
      .in('media_id', mediaIds);

    // Create lookup maps
    const profileMap = {};
    profiles?.forEach((p) => {
      profileMap[p.id] = p;
    });

    const parkMap = {};
    parks?.forEach((p) => {
      parkMap[p.park_code] = p;
    });

    const likeCountMap = {};
    likeCounts?.forEach((like) => {
      likeCountMap[like.media_id] = (likeCountMap[like.media_id] || 0) + 1;
    });

    const commentCountMap = {};
    commentCounts?.forEach((comment) => {
      commentCountMap[comment.media_id] = (commentCountMap[comment.media_id] || 0) + 1;
    });

    // Get public URLs for media
    const mediaWithDetails = media.map((m) => {
      const { data: mediaUrl } = supabase.storage.from('user-media').getPublicUrl(m.storage_path);

      const { data: thumbnailUrl } = m.thumbnail_path
        ? supabase.storage.from('media-thumbnails').getPublicUrl(m.thumbnail_path)
        : { data: null };

      return {
        ...m,
        profiles: profileMap[m.user_id] || null,
        park: parkMap[m.park_code] || null,
        likes_count: likeCountMap[m.id] || 0,
        comments_count: commentCountMap[m.id] || 0,
        url: mediaUrl?.publicUrl,
        thumbnail_url: thumbnailUrl?.publicUrl,
      };
    });

    return NextResponse.json({ media: mediaWithDetails });
  } catch (error) {
    console.error('Error in GET /api/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/media
 * Upload new media (photo or video)
 */
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const parkCode = formData.get('parkCode');
    const title = formData.get('title') || '';
    const description = formData.get('description') || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!parkCode) {
      return NextResponse.json({ error: 'Park code is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify park exists in all_parks view (supports NPS, state parks, etc.)
    const { data: park, error: parkError } = await supabase
      .from('all_parks')
      .select('id, park_code, full_name')
      .eq('park_code', parkCode)
      .single();

    if (parkError || !park) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
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
    // Using park_code instead of park_id for flexibility across park types
    const mediaId = randomUUID();
    const { error: insertError } = await supabase.from('user_media').insert({
      id: mediaId,
      user_id: user.id,
      park_code: parkCode,
      media_type: mediaType,
      storage_path: '', // Will be updated after upload
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

    // Process media in background (for now, we'll do it synchronously)
    // In production, this should be moved to a background job
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

      // Upload thumbnail
      const { error: thumbUploadError } = await supabase.storage
        .from('media-thumbnails')
        .upload(thumbnailPath, processed.thumbnailBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (thumbUploadError) {
        console.error('Failed to upload thumbnail:', thumbUploadError);
        // Continue without thumbnail
      }

      // Update media record with processed info
      const { data: updatedMedia, error: updateError } = await supabase
        .from('user_media')
        .update({
          storage_path: storagePath,
          thumbnail_path: thumbUploadError ? null : thumbnailPath,
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

      // Get public URLs
      const { data: mediaUrl } = supabase.storage.from('user-media').getPublicUrl(storagePath);

      const { data: thumbnailUrl } = supabase.storage
        .from('media-thumbnails')
        .getPublicUrl(thumbnailPath);

      return NextResponse.json(
        {
          media: {
            ...updatedMedia,
            url: mediaUrl.publicUrl,
            thumbnail_url: thumbnailUrl?.publicUrl,
            park: park,
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
  } catch (error) {
    console.error('Error in POST /api/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/media
 * Delete media by ID (passed as query param)
 */
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('id');

    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get media record to verify ownership and get storage paths
    const { data: media, error: fetchError } = await supabase
      .from('user_media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (fetchError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    if (media.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from storage
    if (media.storage_path) {
      await supabase.storage.from('user-media').remove([media.storage_path]);
    }

    if (media.thumbnail_path) {
      await supabase.storage.from('media-thumbnails').remove([media.thumbnail_path]);
    }

    // Delete media record (cascades to comments and likes)
    const { error: deleteError } = await supabase.from('user_media').delete().eq('id', mediaId);

    if (deleteError) {
      console.error('Error deleting media:', deleteError);
      return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}