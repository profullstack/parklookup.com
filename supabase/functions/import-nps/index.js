/**
 * Supabase Edge Function: Import NPS Parks
 * Fetches park data from the NPS API and stores it in the database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const NPS_API_BASE = 'https://developer.nps.gov/api/v1';
const BATCH_SIZE = 50;

/**
 * Fetch parks from NPS API with pagination
 */
async function fetchNpsParks(apiKey, { limit = 50, start = 0 } = {}) {
  const url = new URL(`${NPS_API_BASE}/parks`);
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('start', start.toString());
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`NPS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Transform NPS park data for database storage
 */
function transformParkData(park) {
  return {
    park_code: park.parkCode,
    full_name: park.fullName,
    description: park.description,
    states: park.states,
    latitude: park.latitude ? parseFloat(park.latitude) : null,
    longitude: park.longitude ? parseFloat(park.longitude) : null,
    designation: park.designation,
    url: park.url,
    weather_info: park.weatherInfo,
    directions_info: park.directionsInfo,
    directions_url: park.directionsUrl,
    operating_hours: park.operatingHours,
    entrance_fees: park.entranceFees,
    entrance_passes: park.entrancePasses,
    activities: park.activities,
    topics: park.topics,
    contacts: park.contacts,
    images: park.images,
    addresses: park.addresses,
    raw_data: park,
  };
}

/**
 * Main handler for the Edge Function
 */
Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const npsApiKey = Deno.env.get('NPS_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!npsApiKey) {
      throw new Error('Missing NPS_API_KEY');
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create import log entry
    const { data: importLog, error: logError } = await supabase
      .from('import_logs')
      .insert({
        source: 'nps',
        status: 'started',
        metadata: { batch_size: BATCH_SIZE },
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create import log:', logError);
    }

    const importLogId = importLog?.id;

    let allParks = [];
    let start = 0;
    let totalCount = 0;

    // Fetch all parks with pagination
    console.log('Starting NPS data import...');

    do {
      const response = await fetchNpsParks(npsApiKey, { limit: BATCH_SIZE, start });
      const { data: parks, total } = response;

      totalCount = parseInt(total, 10);
      allParks = allParks.concat(parks);
      start += BATCH_SIZE;

      console.log(`Fetched ${allParks.length} of ${totalCount} parks`);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (start < totalCount);

    console.log(`Total parks fetched: ${allParks.length}`);

    // Transform and upsert parks
    const transformedParks = allParks.map(transformParkData);

    const { data: upsertedData, error: upsertError } = await supabase
      .from('nps_parks')
      .upsert(transformedParks, {
        onConflict: 'park_code',
        ignoreDuplicates: false,
      })
      .select('id');

    if (upsertError) {
      throw new Error(`Failed to upsert parks: ${upsertError.message}`);
    }

    const recordsInserted = upsertedData?.length ?? 0;

    // Update import log
    if (importLogId) {
      await supabase
        .from('import_logs')
        .update({
          status: 'completed',
          records_fetched: allParks.length,
          records_inserted: recordsInserted,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importLogId);
    }

    console.log(`Import completed: ${recordsInserted} parks upserted`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'NPS parks import completed',
        stats: {
          fetched: allParks.length,
          inserted: recordsInserted,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Import error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});