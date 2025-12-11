/**
 * Supabase Edge Function: Import Wikidata Parks
 * Fetches park data from Wikidata SPARQL and stores it in the database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const BATCH_SIZE = 50;

/**
 * Build SPARQL query for US National Parks
 */
function buildSparqlQuery({ limit = 50, offset = 0 }) {
  return `
    SELECT ?park ?parkLabel ?image ?stateLabel ?coord ?website ?area ?areaUnitLabel ?elev ?elevUnitLabel ?inception ?managingOrgLabel ?commonsCat
    WHERE {
      ?park wdt:P31 wd:Q46169.
      ?park wdt:P17 wd:Q30.
      OPTIONAL { ?park wdt:P18 ?image. }
      OPTIONAL { ?park wdt:P131 ?state. }
      OPTIONAL { ?park wdt:P625 ?coord. }
      OPTIONAL { ?park wdt:P856 ?website. }
      OPTIONAL {
        ?park wdt:P2046 ?areaNode.
        ?areaNode wikibase:quantityAmount ?area;
                  wikibase:quantityUnit ?areaUnit.
      }
      OPTIONAL {
        ?park wdt:P2044 ?elevNode.
        ?elevNode wikibase:quantityAmount ?elev;
                  wikibase:quantityUnit ?elevUnit.
      }
      OPTIONAL { ?park wdt:P571 ?inception. }
      OPTIONAL { ?park wdt:P137 ?managingOrg. }
      OPTIONAL { ?park wdt:P373 ?commonsCat. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

/**
 * Parse coordinates from Wikidata Point format
 */
function parseCoordinates(coordString) {
  if (!coordString) {return null;}

  const match = coordString.match(/Point\(([^ ]+) ([^)]+)\)/);
  if (!match) {return null;}

  return {
    longitude: parseFloat(match[1]),
    latitude: parseFloat(match[2]),
  };
}

/**
 * Extract Wikidata ID from URI
 */
function extractWikidataId(uri) {
  if (!uri) {return null;}
  const match = uri.match(/Q\d+$/);
  return match ? match[0] : null;
}

/**
 * Transform Wikidata result for database storage
 */
function transformWikidataResult(result) {
  const coords = parseCoordinates(result.coord?.value);

  return {
    wikidata_id: extractWikidataId(result.park?.value),
    label: result.parkLabel?.value || null,
    state: result.stateLabel?.value || null,
    latitude: coords?.latitude || null,
    longitude: coords?.longitude || null,
    image_url: result.image?.value || null,
    website: result.website?.value || null,
    area: result.area?.value ? parseFloat(result.area.value) : null,
    area_unit: result.areaUnitLabel?.value || null,
    elevation: result.elev?.value ? parseFloat(result.elev.value) : null,
    elevation_unit: result.elevUnitLabel?.value || null,
    inception: result.inception?.value ? result.inception.value.split('T')[0] : null,
    managing_org: result.managingOrgLabel?.value || null,
    commons_category: result.commonsCat?.value || null,
    raw_data: result,
  };
}

/**
 * Fetch parks from Wikidata SPARQL endpoint
 */
async function fetchWikidataParks({ limit = 50, offset = 0 }) {
  const query = buildSparqlQuery({ limit, offset });
  const url = new URL(WIKIDATA_SPARQL_ENDPOINT);
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', query);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results?.bindings || [];
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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create import log entry
    const { data: importLog, error: logError } = await supabase
      .from('import_logs')
      .insert({
        source: 'wikidata',
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
    let offset = 0;
    let hasMore = true;

    // Fetch all parks with pagination
    console.log('Starting Wikidata data import...');

    while (hasMore) {
      const results = await fetchWikidataParks({ limit: BATCH_SIZE, offset });

      if (results.length === 0) {
        hasMore = false;
      } else {
        allParks = allParks.concat(results);
        offset += BATCH_SIZE;
        console.log(`Fetched ${allParks.length} parks from Wikidata`);

        // Small delay to be respectful to Wikidata servers
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`Total parks fetched: ${allParks.length}`);

    // Transform and deduplicate by wikidata_id
    const transformedParks = allParks.map(transformWikidataResult);
    const uniqueParks = Array.from(
      new Map(transformedParks.filter((p) => p.wikidata_id).map((p) => [p.wikidata_id, p])).values()
    );

    console.log(`Unique parks after deduplication: ${uniqueParks.length}`);

    // Upsert parks
    const { data: upsertedData, error: upsertError } = await supabase
      .from('wikidata_parks')
      .upsert(uniqueParks, {
        onConflict: 'wikidata_id',
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
        message: 'Wikidata parks import completed',
        stats: {
          fetched: allParks.length,
          unique: uniqueParks.length,
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