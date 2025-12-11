/**
 * Supabase Edge Function: Link Parks
 * Links NPS parks to Wikidata parks using name and location similarity
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Normalize a string for comparison
 */
function normalizeString(str) {
  if (!str) {return '';}
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function calculateLevenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {dp[i][0] = i;}
  for (let j = 0; j <= n; j++) {dp[0][j] = j;}

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate name similarity between two strings
 */
function calculateNameSimilarity(name1, name2) {
  if (!name1 || !name2) {return 0;}

  const normalized1 = normalizeString(name1);
  const normalized2 = normalizeString(name2);

  if (!normalized1 || !normalized2) {return 0;}
  if (normalized1 === normalized2) {return 1.0;}

  const distance = calculateLevenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - distance / maxLength;
}

/**
 * Calculate Haversine distance between two coordinates in kilometers
 */
function haversineDistance(coord1, coord2) {
  const R = 6371;

  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate location similarity based on distance
 */
function calculateLocationSimilarity(coord1, coord2, maxDistance = 100) {
  if (!coord1 || !coord2) {return 0;}
  if (
    coord1.latitude == null ||
    coord1.longitude == null ||
    coord2.latitude == null ||
    coord2.longitude == null
  ) {
    return 0;
  }

  const distance = haversineDistance(coord1, coord2);

  if (distance === 0) {return 1.0;}
  if (distance >= maxDistance) {return 0;}

  return 1 - distance / maxDistance;
}

/**
 * Calculate overall match score
 */
function calculateOverallScore({ nameSimilarity, locationSimilarity }, weights = { name: 0.7, location: 0.3 }) {
  return nameSimilarity * weights.name + locationSimilarity * weights.location;
}

/**
 * Find the best matching Wikidata park for an NPS park
 */
function findBestMatch(npsPark, wikidataParks, options = {}) {
  const { threshold = 0.6 } = options;

  let bestMatch = null;
  let bestScore = 0;

  for (const wikidataPark of wikidataParks) {
    const nameSimilarity = calculateNameSimilarity(npsPark.full_name, wikidataPark.label);

    const npsCoord =
      npsPark.latitude && npsPark.longitude
        ? { latitude: npsPark.latitude, longitude: npsPark.longitude }
        : null;

    const wikiCoord =
      wikidataPark.latitude && wikidataPark.longitude
        ? { latitude: wikidataPark.latitude, longitude: wikidataPark.longitude }
        : null;

    const locationSimilarity = calculateLocationSimilarity(npsCoord, wikiCoord);

    const score = calculateOverallScore({ nameSimilarity, locationSimilarity });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        wikidataPark,
        score,
        nameSimilarity,
        locationSimilarity,
      };
    }
  }

  if (bestScore < threshold) {
    return null;
  }

  return bestMatch;
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

    // Parse request body for options
    const options = { threshold: 0.6 };
    try {
      const body = await req.json();
      if (body.threshold) {options.threshold = body.threshold;}
    } catch {
      // Use defaults if no body
    }

    console.log('Starting park linking process...');

    // Fetch all NPS parks
    const { data: npsParks, error: npsError } = await supabase
      .from('nps_parks')
      .select('id, park_code, full_name, latitude, longitude');

    if (npsError) {
      throw new Error(`Failed to fetch NPS parks: ${npsError.message}`);
    }

    console.log(`Fetched ${npsParks.length} NPS parks`);

    // Fetch all Wikidata parks
    const { data: wikidataParks, error: wikiError } = await supabase
      .from('wikidata_parks')
      .select('id, wikidata_id, label, latitude, longitude');

    if (wikiError) {
      throw new Error(`Failed to fetch Wikidata parks: ${wikiError.message}`);
    }

    console.log(`Fetched ${wikidataParks.length} Wikidata parks`);

    // Link parks
    const links = [];
    const usedWikidataIds = new Set();

    for (const npsPark of npsParks) {
      const availableWikidataParks = wikidataParks.filter(
        (wp) => !usedWikidataIds.has(wp.wikidata_id)
      );

      const match = findBestMatch(npsPark, availableWikidataParks, options);

      if (match) {
        usedWikidataIds.add(match.wikidataPark.wikidata_id);

        links.push({
          nps_park_id: npsPark.id,
          wikidata_park_id: match.wikidataPark.id,
          confidence_score: match.score,
          match_method: 'name_location_similarity',
        });
      }
    }

    console.log(`Found ${links.length} park links`);

    // Upsert links
    if (links.length > 0) {
      const { error: upsertError } = await supabase
        .from('park_links')
        .upsert(links, {
          onConflict: 'nps_park_id,wikidata_park_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(`Failed to upsert park links: ${upsertError.message}`);
      }
    }

    console.log('Park linking completed');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Park linking completed',
        stats: {
          npsParks: npsParks.length,
          wikidataParks: wikidataParks.length,
          linksCreated: links.length,
          threshold: options.threshold,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Linking error:', error);

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