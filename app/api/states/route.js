import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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

// Static list of U.S. states as fallback
const US_STATES = [
  { code: 'AL', name: 'Alabama', slug: 'alabama' },
  { code: 'AK', name: 'Alaska', slug: 'alaska' },
  { code: 'AZ', name: 'Arizona', slug: 'arizona' },
  { code: 'AR', name: 'Arkansas', slug: 'arkansas' },
  { code: 'CA', name: 'California', slug: 'california' },
  { code: 'CO', name: 'Colorado', slug: 'colorado' },
  { code: 'CT', name: 'Connecticut', slug: 'connecticut' },
  { code: 'DE', name: 'Delaware', slug: 'delaware' },
  { code: 'FL', name: 'Florida', slug: 'florida' },
  { code: 'GA', name: 'Georgia', slug: 'georgia' },
  { code: 'HI', name: 'Hawaii', slug: 'hawaii' },
  { code: 'ID', name: 'Idaho', slug: 'idaho' },
  { code: 'IL', name: 'Illinois', slug: 'illinois' },
  { code: 'IN', name: 'Indiana', slug: 'indiana' },
  { code: 'IA', name: 'Iowa', slug: 'iowa' },
  { code: 'KS', name: 'Kansas', slug: 'kansas' },
  { code: 'KY', name: 'Kentucky', slug: 'kentucky' },
  { code: 'LA', name: 'Louisiana', slug: 'louisiana' },
  { code: 'ME', name: 'Maine', slug: 'maine' },
  { code: 'MD', name: 'Maryland', slug: 'maryland' },
  { code: 'MA', name: 'Massachusetts', slug: 'massachusetts' },
  { code: 'MI', name: 'Michigan', slug: 'michigan' },
  { code: 'MN', name: 'Minnesota', slug: 'minnesota' },
  { code: 'MS', name: 'Mississippi', slug: 'mississippi' },
  { code: 'MO', name: 'Missouri', slug: 'missouri' },
  { code: 'MT', name: 'Montana', slug: 'montana' },
  { code: 'NE', name: 'Nebraska', slug: 'nebraska' },
  { code: 'NV', name: 'Nevada', slug: 'nevada' },
  { code: 'NH', name: 'New Hampshire', slug: 'new-hampshire' },
  { code: 'NJ', name: 'New Jersey', slug: 'new-jersey' },
  { code: 'NM', name: 'New Mexico', slug: 'new-mexico' },
  { code: 'NY', name: 'New York', slug: 'new-york' },
  { code: 'NC', name: 'North Carolina', slug: 'north-carolina' },
  { code: 'ND', name: 'North Dakota', slug: 'north-dakota' },
  { code: 'OH', name: 'Ohio', slug: 'ohio' },
  { code: 'OK', name: 'Oklahoma', slug: 'oklahoma' },
  { code: 'OR', name: 'Oregon', slug: 'oregon' },
  { code: 'PA', name: 'Pennsylvania', slug: 'pennsylvania' },
  { code: 'RI', name: 'Rhode Island', slug: 'rhode-island' },
  { code: 'SC', name: 'South Carolina', slug: 'south-carolina' },
  { code: 'SD', name: 'South Dakota', slug: 'south-dakota' },
  { code: 'TN', name: 'Tennessee', slug: 'tennessee' },
  { code: 'TX', name: 'Texas', slug: 'texas' },
  { code: 'UT', name: 'Utah', slug: 'utah' },
  { code: 'VT', name: 'Vermont', slug: 'vermont' },
  { code: 'VA', name: 'Virginia', slug: 'virginia' },
  { code: 'WA', name: 'Washington', slug: 'washington' },
  { code: 'WV', name: 'West Virginia', slug: 'west-virginia' },
  { code: 'WI', name: 'Wisconsin', slug: 'wisconsin' },
  { code: 'WY', name: 'Wyoming', slug: 'wyoming' },
  { code: 'DC', name: 'District of Columbia', slug: 'district-of-columbia' },
  { code: 'PR', name: 'Puerto Rico', slug: 'puerto-rico' },
  { code: 'VI', name: 'U.S. Virgin Islands', slug: 'us-virgin-islands' },
  { code: 'GU', name: 'Guam', slug: 'guam' },
  { code: 'AS', name: 'American Samoa', slug: 'american-samoa' },
  { code: 'MP', name: 'Northern Mariana Islands', slug: 'northern-mariana-islands' },
];

/**
 * GET /api/states
 * Returns all states with park counts
 */
export async function GET(request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    // Query parameters
    const withParks = searchParams.get('withParks') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let query = supabase
      .from('states')
      .select('id, code, name, slug, latitude, longitude, park_count')
      .order('name');

    // Optionally filter to only states with parks
    if (withParks) {
      query = query.gt('park_count', 0);
    }

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    // If table doesn't exist or other error, return static fallback
    if (error) {
      console.error('Database error:', error);
      
      // Return static states as fallback (without park counts)
      const fallbackStates = US_STATES.map((state, index) => ({
        id: `fallback-${index}`,
        ...state,
        latitude: null,
        longitude: null,
        park_count: 0,
      }));

      return NextResponse.json({
        states: fallbackStates,
        total: fallbackStates.length,
        fallback: true,
      });
    }

    return NextResponse.json({
      states: data ?? [],
      total: data?.length ?? 0,
    });
  } catch (error) {
    console.error('API error:', error);
    
    // Return static states as fallback on any error
    const fallbackStates = US_STATES.map((state, index) => ({
      id: `fallback-${index}`,
      ...state,
      latitude: null,
      longitude: null,
      park_count: 0,
    }));

    return NextResponse.json({
      states: fallbackStates,
      total: fallbackStates.length,
      fallback: true,
    });
  }
}