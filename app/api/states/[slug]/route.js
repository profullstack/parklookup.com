import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Static fallback data for US states
const US_STATES = [
  { code: 'AL', name: 'Alabama', slug: 'alabama', region: 'Southeast', latitude: 32.806671, longitude: -86.79113 },
  { code: 'AK', name: 'Alaska', slug: 'alaska', region: 'West', latitude: 61.370716, longitude: -152.404419 },
  { code: 'AZ', name: 'Arizona', slug: 'arizona', region: 'Southwest', latitude: 33.729759, longitude: -111.431221 },
  { code: 'AR', name: 'Arkansas', slug: 'arkansas', region: 'Southeast', latitude: 34.969704, longitude: -92.373123 },
  { code: 'CA', name: 'California', slug: 'california', region: 'West', latitude: 36.116203, longitude: -119.681564 },
  { code: 'CO', name: 'Colorado', slug: 'colorado', region: 'West', latitude: 39.059811, longitude: -105.311104 },
  { code: 'CT', name: 'Connecticut', slug: 'connecticut', region: 'Northeast', latitude: 41.597782, longitude: -72.755371 },
  { code: 'DE', name: 'Delaware', slug: 'delaware', region: 'Northeast', latitude: 39.318523, longitude: -75.507141 },
  { code: 'FL', name: 'Florida', slug: 'florida', region: 'Southeast', latitude: 27.766279, longitude: -81.686783 },
  { code: 'GA', name: 'Georgia', slug: 'georgia', region: 'Southeast', latitude: 33.040619, longitude: -83.643074 },
  { code: 'HI', name: 'Hawaii', slug: 'hawaii', region: 'West', latitude: 21.094318, longitude: -157.498337 },
  { code: 'ID', name: 'Idaho', slug: 'idaho', region: 'West', latitude: 44.240459, longitude: -114.478828 },
  { code: 'IL', name: 'Illinois', slug: 'illinois', region: 'Midwest', latitude: 40.349457, longitude: -88.986137 },
  { code: 'IN', name: 'Indiana', slug: 'indiana', region: 'Midwest', latitude: 39.849426, longitude: -86.258278 },
  { code: 'IA', name: 'Iowa', slug: 'iowa', region: 'Midwest', latitude: 42.011539, longitude: -93.210526 },
  { code: 'KS', name: 'Kansas', slug: 'kansas', region: 'Midwest', latitude: 38.5266, longitude: -96.726486 },
  { code: 'KY', name: 'Kentucky', slug: 'kentucky', region: 'Southeast', latitude: 37.66814, longitude: -84.670067 },
  { code: 'LA', name: 'Louisiana', slug: 'louisiana', region: 'Southeast', latitude: 31.169546, longitude: -91.867805 },
  { code: 'ME', name: 'Maine', slug: 'maine', region: 'Northeast', latitude: 44.693947, longitude: -69.381927 },
  { code: 'MD', name: 'Maryland', slug: 'maryland', region: 'Northeast', latitude: 39.063946, longitude: -76.802101 },
  { code: 'MA', name: 'Massachusetts', slug: 'massachusetts', region: 'Northeast', latitude: 42.230171, longitude: -71.530106 },
  { code: 'MI', name: 'Michigan', slug: 'michigan', region: 'Midwest', latitude: 43.326618, longitude: -84.536095 },
  { code: 'MN', name: 'Minnesota', slug: 'minnesota', region: 'Midwest', latitude: 45.694454, longitude: -93.900192 },
  { code: 'MS', name: 'Mississippi', slug: 'mississippi', region: 'Southeast', latitude: 32.741646, longitude: -89.678696 },
  { code: 'MO', name: 'Missouri', slug: 'missouri', region: 'Midwest', latitude: 38.456085, longitude: -92.288368 },
  { code: 'MT', name: 'Montana', slug: 'montana', region: 'West', latitude: 46.921925, longitude: -110.454353 },
  { code: 'NE', name: 'Nebraska', slug: 'nebraska', region: 'Midwest', latitude: 41.12537, longitude: -98.268082 },
  { code: 'NV', name: 'Nevada', slug: 'nevada', region: 'West', latitude: 38.313515, longitude: -117.055374 },
  { code: 'NH', name: 'New Hampshire', slug: 'new-hampshire', region: 'Northeast', latitude: 43.452492, longitude: -71.563896 },
  { code: 'NJ', name: 'New Jersey', slug: 'new-jersey', region: 'Northeast', latitude: 40.298904, longitude: -74.521011 },
  { code: 'NM', name: 'New Mexico', slug: 'new-mexico', region: 'Southwest', latitude: 34.840515, longitude: -106.248482 },
  { code: 'NY', name: 'New York', slug: 'new-york', region: 'Northeast', latitude: 42.165726, longitude: -74.948051 },
  { code: 'NC', name: 'North Carolina', slug: 'north-carolina', region: 'Southeast', latitude: 35.630066, longitude: -79.806419 },
  { code: 'ND', name: 'North Dakota', slug: 'north-dakota', region: 'Midwest', latitude: 47.528912, longitude: -99.784012 },
  { code: 'OH', name: 'Ohio', slug: 'ohio', region: 'Midwest', latitude: 40.388783, longitude: -82.764915 },
  { code: 'OK', name: 'Oklahoma', slug: 'oklahoma', region: 'Southwest', latitude: 35.565342, longitude: -96.928917 },
  { code: 'OR', name: 'Oregon', slug: 'oregon', region: 'West', latitude: 44.572021, longitude: -122.070938 },
  { code: 'PA', name: 'Pennsylvania', slug: 'pennsylvania', region: 'Northeast', latitude: 40.590752, longitude: -77.209755 },
  { code: 'RI', name: 'Rhode Island', slug: 'rhode-island', region: 'Northeast', latitude: 41.680893, longitude: -71.51178 },
  { code: 'SC', name: 'South Carolina', slug: 'south-carolina', region: 'Southeast', latitude: 33.856892, longitude: -80.945007 },
  { code: 'SD', name: 'South Dakota', slug: 'south-dakota', region: 'Midwest', latitude: 44.299782, longitude: -99.438828 },
  { code: 'TN', name: 'Tennessee', slug: 'tennessee', region: 'Southeast', latitude: 35.747845, longitude: -86.692345 },
  { code: 'TX', name: 'Texas', slug: 'texas', region: 'Southwest', latitude: 31.054487, longitude: -97.563461 },
  { code: 'UT', name: 'Utah', slug: 'utah', region: 'West', latitude: 40.150032, longitude: -111.862434 },
  { code: 'VT', name: 'Vermont', slug: 'vermont', region: 'Northeast', latitude: 44.045876, longitude: -72.710686 },
  { code: 'VA', name: 'Virginia', slug: 'virginia', region: 'Southeast', latitude: 37.769337, longitude: -78.169968 },
  { code: 'WA', name: 'Washington', slug: 'washington', region: 'West', latitude: 47.400902, longitude: -121.490494 },
  { code: 'WV', name: 'West Virginia', slug: 'west-virginia', region: 'Southeast', latitude: 38.491226, longitude: -80.954453 },
  { code: 'WI', name: 'Wisconsin', slug: 'wisconsin', region: 'Midwest', latitude: 44.268543, longitude: -89.616508 },
  { code: 'WY', name: 'Wyoming', slug: 'wyoming', region: 'West', latitude: 42.755966, longitude: -107.30249 },
];

/**
 * GET /api/states/[slug]
 * Returns a state with its parks
 */
export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const supabase = createServiceClient();

    // First, get the state
    const { data: state, error: stateError } = await supabase
      .from('states')
      .select('*')
      .eq('slug', slug)
      .single();

    // If table doesn't exist or other error, try fallback
    if (stateError) {
      console.error('Database error fetching state:', stateError.code, stateError.message);
      // Try to find state in fallback data for any error
      const fallbackState = US_STATES.find(s => s.slug === slug);
      if (fallbackState) {
        return NextResponse.json({
          state: {
            id: `fallback-${fallbackState.code}`,
            ...fallbackState,
            park_count: 0,
          },
          parks: [],
          stateParks: [],
          totalParks: 0,
          fallback: true,
        });
      }
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
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

    // Get counties with local parks in this state
    const { data: countiesWithParks } = await supabase
      .from('local_parks')
      .select('county_id, counties!inner(id, name, slug)')
      .eq('state_id', state.id)
      .not('county_id', 'is', null);

    // Aggregate counties with park counts
    const countyMap = new Map();
    (countiesWithParks ?? []).forEach((park) => {
      const county = park.counties;
      if (county && !countyMap.has(county.id)) {
        countyMap.set(county.id, {
          id: county.id,
          name: county.name,
          slug: county.slug,
          park_count: 0,
        });
      }
      if (county) {
        countyMap.get(county.id).park_count++;
      }
    });
    const counties = Array.from(countyMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Get local parks count for this state
    const { count: localParksCount } = await supabase
      .from('local_parks')
      .select('id', { count: 'exact', head: true })
      .eq('state_id', state.id);

    return NextResponse.json({
      state,
      parks: parks ?? [],
      stateParks: stateParks ?? [],
      counties: counties ?? [],
      localParksCount: localParksCount ?? 0,
      totalParks: (parks?.length ?? 0) + (stateParks?.length ?? 0) + (localParksCount ?? 0),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}