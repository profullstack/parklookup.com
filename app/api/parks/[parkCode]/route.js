/**
 * Single Park API Route
 * GET /api/parks/[parkCode] - Get a single park by park code
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for fetching a single park
 */
export async function GET(request, { params }) {
  try {
    const { parkCode } = params;

    if (!parkCode) {
      return NextResponse.json({ error: 'Park code is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch park with linked Wikidata data
    const { data: park, error } = await supabase
      .from('parks_combined')
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
        link_confidence
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

    return NextResponse.json({ park });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}