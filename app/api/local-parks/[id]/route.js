/**
 * Local Park Detail API Route
 *
 * GET /api/local-parks/[id] - Get a single local park by ID or slug
 *
 * Path Parameters:
 *   - id: Park UUID or slug (with state code prefix, e.g., "ca-central-park")
 *
 * Query Parameters:
 *   - state: Required when using slug (state code, e.g., CA)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Validates if a string is a valid UUID
 */
const isUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * GET /api/local-parks/[id]
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const stateCode = searchParams.get('state')?.toUpperCase();

    if (!id) {
      return NextResponse.json({ error: 'Park ID or slug is required' }, { status: 400 });
    }

    // Create Supabase client
    const supabase = await createClient();

    let query = supabase
      .from('local_parks')
      .select(
        `
        id,
        name,
        slug,
        park_type,
        managing_agency,
        description,
        latitude,
        longitude,
        access,
        website,
        phone,
        address,
        amenities,
        activities,
        wikidata_id,
        padus_id,
        raw_data,
        created_at,
        updated_at,
        states!inner(id, code, name, slug),
        counties(id, name, slug),
        cities(id, name, slug)
      `
      )
      .single();

    // Query by UUID or slug
    if (isUUID(id)) {
      query = query.eq('id', id);
    } else {
      // Query by slug - requires state code
      if (!stateCode) {
        return NextResponse.json(
          { error: 'State code is required when querying by slug' },
          { status: 400 }
        );
      }
      query = query.eq('slug', id).eq('states.code', stateCode);
    }

    const { data: park, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Park not found' }, { status: 404 });
      }
      console.error('Error fetching local park:', error);
      return NextResponse.json({ error: 'Failed to fetch park' }, { status: 500 });
    }

    if (!park) {
      return NextResponse.json({ error: 'Park not found' }, { status: 404 });
    }

    // Fetch photos for this park
    const { data: photos } = await supabase
      .from('park_photos')
      .select('id, source, image_url, thumb_url, title, license, attribution, width, height, is_primary')
      .eq('park_id', park.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    // Transform response
    const transformedPark = {
      id: park.id,
      name: park.name,
      slug: park.slug,
      park_type: park.park_type,
      managing_agency: park.managing_agency,
      description: park.description,
      latitude: park.latitude,
      longitude: park.longitude,
      access: park.access,
      website: park.website,
      phone: park.phone,
      address: park.address,
      amenities: park.amenities || [],
      activities: park.activities || [],
      wikidata_id: park.wikidata_id,
      state: park.states
        ? {
            code: park.states.code,
            name: park.states.name,
            slug: park.states.slug,
          }
        : null,
      county: park.counties
        ? {
            name: park.counties.name,
            slug: park.counties.slug,
          }
        : null,
      city: park.cities
        ? {
            name: park.cities.name,
            slug: park.cities.slug,
          }
        : null,
      photos: photos || [],
      primary_photo: photos?.find((p) => p.is_primary) || photos?.[0] || null,
      created_at: park.created_at,
      updated_at: park.updated_at,
    };

    return NextResponse.json({ park: transformedPark });
  } catch (error) {
    console.error('Error in local park detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}