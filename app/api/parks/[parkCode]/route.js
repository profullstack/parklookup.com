/**
 * Single Park API Route
 * GET /api/parks/[parkCode] - Get a single park by park code
 * Supports both NPS parks (e.g., "yose") and state parks (e.g., "Q4647844")
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Converts Wikimedia Commons URLs to use HTTPS and proper format
 * Wikimedia URLs come in as http://commons.wikimedia.org/wiki/Special:FilePath/...
 * They need to be converted to https:// for Next.js Image component
 *
 * @param {string} url - Image URL
 * @returns {string} Normalized URL with HTTPS
 */
const normalizeImageUrl = (url) => {
  if (!url) return url;

  // Convert http:// to https://
  let normalizedUrl = url.replace(/^http:\/\//i, 'https://');

  return normalizedUrl;
};

/**
 * Normalizes image data to ensure consistent structure across NPS and Wikidata parks
 * NPS parks have: [{url, altText}]
 * Wikidata parks have: [{url, title}] or just wikidata_image URL
 *
 * @param {Object} park - Park data from database
 * @returns {Array} Normalized images array with {url, altText} objects
 */
const normalizeImages = (park) => {
  const images = [];

  // Process existing images array
  if (park.images && Array.isArray(park.images)) {
    for (const img of park.images) {
      if (img && img.url) {
        images.push({
          url: normalizeImageUrl(img.url),
          // Use altText if available (NPS), otherwise use title (Wikidata), fallback to park name
          altText: img.altText || img.title || park.full_name,
        });
      }
    }
  }

  // If no images from array but wikidata_image exists, use it
  if (images.length === 0 && park.wikidata_image) {
    images.push({
      url: normalizeImageUrl(park.wikidata_image),
      altText: park.full_name,
    });
  }

  return images;
};

/**
 * GET handler for fetching a single park
 */
export async function GET(request, { params }) {
  try {
    const { parkCode } = await params;

    if (!parkCode) {
      return NextResponse.json({ error: 'Park code is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch park from all_parks view (includes both NPS and state parks)
    const { data: park, error } = await supabase
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
        weather_info,
        images,
        activities,
        operating_hours,
        entrance_fees,
        wikidata_id,
        wikidata_image,
        area,
        area_unit,
        elevation,
        elevation_unit,
        inception,
        managing_org,
        commons_category,
        link_confidence,
        source
      `
      )
      .eq('park_code', parkCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Park not found' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch park' }, { status: 500 });
    }

    // Normalize images to ensure consistent structure
    const normalizedPark = {
      ...park,
      images: normalizeImages(park),
    };

    return NextResponse.json({ park: normalizedPark });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}