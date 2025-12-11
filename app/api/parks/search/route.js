/**
 * Parks Search API Route
 * GET /api/parks/search - Full-text search for parks
 */

import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for searching parks
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q');
    const state = searchParams.get('state');
    const hasImages = searchParams.get('hasImages') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offsetParam = searchParams.get('offset');
    const offset = offsetParam ? parseInt(offsetParam, 10) : (page - 1) * limit;

    const supabase = createServerClient();

    // Build query based on parameters
    // Use all_parks view to include both NPS and state parks
    let query = supabase
      .from('all_parks')
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
        wikidata_id,
        wikidata_image,
        link_confidence,
        source
      `,
        { count: 'exact' }
      );

    // Apply search filter if query provided
    if (q && q.trim().length > 0) {
      query = query.or(`full_name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Apply state filter if provided
    if (state && state.trim().length > 0) {
      query = query.ilike('states', `%${state}%`);
    }

    // If filtering for images, we need to fetch more and filter server-side
    // because JSONB array emptiness can't be easily checked in PostgREST
    const fetchLimit = hasImages ? Math.max(limit * 3, 100) : limit;

    const { data: parks, error, count } = await query
      .order('full_name')
      .range(offset, offset + fetchLimit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to search parks' }, { status: 500 });
    }

    // Helper function to normalize Wikimedia URLs
    // Converts http:// to https:// and Special:FilePath URLs to direct image URLs
    const normalizeWikimediaUrl = (url) => {
      if (!url || typeof url !== 'string') return null;
      
      let normalized = url.trim();
      
      // Convert http to https
      if (normalized.startsWith('http://')) {
        normalized = normalized.replace('http://', 'https://');
      }
      
      // Convert Special:FilePath URLs to direct upload URLs
      // http://commons.wikimedia.org/wiki/Special:FilePath/Image.jpg
      // -> https://upload.wikimedia.org/wikipedia/commons/thumb/X/XX/Image.jpg/800px-Image.jpg
      // For simplicity, we'll use the direct commons URL format
      if (normalized.includes('commons.wikimedia.org/wiki/Special:FilePath/')) {
        const filename = normalized.split('Special:FilePath/')[1];
        if (filename) {
          // Use the Wikimedia Commons API to get a direct URL
          // Format: https://commons.wikimedia.org/wiki/Special:FilePath/FILENAME?width=800
          normalized = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(filename))}?width=800`;
        }
      }
      
      return normalized;
    };

    // Helper function to check if a park has a valid image
    const hasValidImage = (park) => {
      // Check NPS images array - must have at least one image with a valid URL
      if (Array.isArray(park.images) && park.images.length > 0) {
        const firstImage = park.images[0];
        if (firstImage?.url && typeof firstImage.url === 'string' && firstImage.url.trim().length > 0) {
          return true;
        }
      }
      // Check wikidata_image - must be a non-empty string
      if (park.wikidata_image && typeof park.wikidata_image === 'string' && park.wikidata_image.trim().length > 0) {
        return true;
      }
      return false;
    };

    // Helper function to normalize park image URLs
    const normalizeParkImages = (park) => {
      const normalized = { ...park };
      
      // Normalize wikidata_image URL
      if (normalized.wikidata_image) {
        normalized.wikidata_image = normalizeWikimediaUrl(normalized.wikidata_image);
      }
      
      // Normalize images array URLs (for wikidata parks that have images constructed from wikidata_image)
      if (Array.isArray(normalized.images) && normalized.images.length > 0) {
        normalized.images = normalized.images.map(img => {
          if (img?.url && img.url.includes('wikimedia.org')) {
            return { ...img, url: normalizeWikimediaUrl(img.url) };
          }
          return img;
        });
      }
      
      return normalized;
    };

    // Normalize image URLs and filter parks if hasImages is requested
    let filteredParks = (parks || []).map(normalizeParkImages);
    if (hasImages) {
      filteredParks = filteredParks.filter(hasValidImage).slice(0, limit);
    }

    // Adjust count for filtered results
    const adjustedCount = hasImages ? filteredParks.length : (count || 0);

    return NextResponse.json({
      parks: filteredParks,
      total: adjustedCount,
      query: q,
      state,
      hasImages,
      pagination: {
        page,
        limit,
        total: adjustedCount,
        totalPages: Math.ceil(adjustedCount / limit),
        hasMore: hasImages ? false : offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}