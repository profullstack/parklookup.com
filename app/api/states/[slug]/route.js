import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Creates a Supabase client for server-side operations
 */
const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * GET /api/states/[slug]
 * Returns a state with its parks
 */
export async function GET(request, { params }) {
  try {
    const supabase = createServerClient();
    const { slug } = params;

    // First, get the state
    const { data: state, error: stateError } = await supabase
      .from('states')
      .select('*')
      .eq('slug', slug)
      .single();

    if (stateError) {
      if (stateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'State not found' }, { status: 404 });
      }
      console.error('Database error:', stateError);
      return NextResponse.json({ error: 'Failed to fetch state' }, { status: 500 });
    }

    // Get parks for this state
    const { data: parkLocations, error: parksError } = await supabase
      .from('nps_park_locations')
      .select(
        `
        nps_park_id,
        is_primary,
        nps_parks (
          id,
          park_code,
          full_name,
          description,
          states,
          latitude,
          longitude,
          designation,
          url,
          images
        )
      `
      )
      .eq('state_id', state.id);

    if (parksError) {
      console.error('Database error:', parksError);
      return NextResponse.json({ error: 'Failed to fetch parks' }, { status: 500 });
    }

    // Extract parks from the join
    const parks = (parkLocations ?? [])
      .map((loc) => ({
        ...loc.nps_parks,
        is_primary_state: loc.is_primary,
      }))
      .filter((p) => p.id);

    // Get state parks if they exist
    const { data: stateParks } = await supabase
      .from('state_parks')
      .select('*')
      .eq('state_id', state.id)
      .order('name');

    return NextResponse.json({
      state,
      parks: parks ?? [],
      stateParks: stateParks ?? [],
      totalParks: (parks?.length ?? 0) + (stateParks?.length ?? 0),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}