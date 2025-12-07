#!/usr/bin/env node

/**
 * Import Nearby Places Script (Optimized)
 *
 * This script uses the ValueSERP API to find places (dining, entertainment, bars, etc.)
 * near parks and stores them in the database.
 *
 * Usage:
 *   node scripts/import-nearby-places.js [options]
 *
 * Options:
 *   --park-id <id>       Import places for a specific park
 *   --park-code <code>   Import places for a park by code
 *   --category <cat>     Only import specific category (dining, entertainment, bars, lodging, shopping, attractions)
 *   --limit <n>          Limit number of parks to process
 *   --dry-run            Don't save to database, just show what would be done
 *   --skip-details       Skip fetching detailed place info (faster, less data) - DEFAULT NOW
 *   --with-details       Fetch detailed place info (slower, more data)
 *   --concurrency <n>    Number of parks to process in parallel (default: 5)
 *   --offset <n>         Skip first N parks (for resuming)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file manually
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  if (line && !line.startsWith('#')) {
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      env[key] = value;
    }
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const valueserpApiKey = env.VALUESERP_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!valueserpApiKey) {
  console.error('Missing VALUESERP_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VALUESERP_BASE_URL = 'https://api.valueserp.com/search';

const PLACE_CATEGORIES = ['dining', 'entertainment', 'bars', 'shopping', 'attractions'];

const CATEGORY_QUERIES = {
  dining: 'restaurants',
  entertainment: 'entertainment',
  bars: 'bars nightlife',
  shopping: 'shopping',
  attractions: 'tourist attractions things to do',
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search for places using ValueSERP API
 */
async function searchPlaces(query, location) {
  const params = new URLSearchParams({
    api_key: valueserpApiKey,
    search_type: 'places',
    q: query,
    location: location,
    google_domain: 'google.com',
    gl: 'us',
    hl: 'en',
  });

  const url = `${VALUESERP_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ValueSERP API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get place details using ValueSERP API
 */
async function getPlaceDetails(dataCid) {
  const params = new URLSearchParams({
    api_key: valueserpApiKey,
    search_type: 'place_details',
    data_cid: dataCid,
  });

  const url = `${VALUESERP_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ValueSERP API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Extract city and state from park data
 */
function extractLocation(park) {
  // For NPS parks, states is comma-separated state codes
  // For Wikidata parks, states might be the city or state name
  const states = park.states || '';

  // Try to get a reasonable location
  // If it looks like state codes (e.g., "CA" or "CA,NV"), we need the park name
  if (states.length <= 3 || states.includes(',')) {
    // Use park name and first state
    const firstState = states.split(',')[0].trim();
    const stateNames = {
      AL: 'Alabama',
      AK: 'Alaska',
      AZ: 'Arizona',
      AR: 'Arkansas',
      CA: 'California',
      CO: 'Colorado',
      CT: 'Connecticut',
      DE: 'Delaware',
      FL: 'Florida',
      GA: 'Georgia',
      HI: 'Hawaii',
      ID: 'Idaho',
      IL: 'Illinois',
      IN: 'Indiana',
      IA: 'Iowa',
      KS: 'Kansas',
      KY: 'Kentucky',
      LA: 'Louisiana',
      ME: 'Maine',
      MD: 'Maryland',
      MA: 'Massachusetts',
      MI: 'Michigan',
      MN: 'Minnesota',
      MS: 'Mississippi',
      MO: 'Missouri',
      MT: 'Montana',
      NE: 'Nebraska',
      NV: 'Nevada',
      NH: 'New Hampshire',
      NJ: 'New Jersey',
      NM: 'New Mexico',
      NY: 'New York',
      NC: 'North Carolina',
      ND: 'North Dakota',
      OH: 'Ohio',
      OK: 'Oklahoma',
      OR: 'Oregon',
      PA: 'Pennsylvania',
      RI: 'Rhode Island',
      SC: 'South Carolina',
      SD: 'South Dakota',
      TN: 'Tennessee',
      TX: 'Texas',
      UT: 'Utah',
      VT: 'Vermont',
      VA: 'Virginia',
      WA: 'Washington',
      WV: 'West Virginia',
      WI: 'Wisconsin',
      WY: 'Wyoming',
      DC: 'District of Columbia',
    };

    const stateName = stateNames[firstState] || firstState;

    // Try to extract a city from the park name or use a nearby city
    // For now, just use the state
    return {
      location: `${stateName},United States`,
      searchLocation: stateName,
    };
  }

  // For Wikidata parks, states might already be a city or state name
  return {
    location: `${states},United States`,
    searchLocation: states,
  };
}

/**
 * Batch insert places and link to park using upsert
 */
async function batchInsertPlaces(places, parkId, searchLocation, dryRun) {
  if (dryRun || places.length === 0) {
    return { success: places.length, failed: 0 };
  }

  const results = { success: 0, failed: 0 };

  // Use upsert to handle duplicates gracefully
  const { data: upsertedPlaces, error: upsertError } = await supabase
    .from('nearby_places')
    .upsert(places, {
      onConflict: 'data_cid',
      ignoreDuplicates: false,
    })
    .select('id');

  if (upsertError) {
    console.error(`    Error upserting places:`, upsertError.message);
    results.failed += places.length;
    return results;
  }

  results.success = upsertedPlaces?.length || 0;

  // Batch link all places to park
  if (upsertedPlaces && upsertedPlaces.length > 0) {
    const links = upsertedPlaces.map((place) => ({
      park_id: parkId,
      place_id: place.id,
      search_location: searchLocation,
    }));

    const { error: linkError } = await supabase.from('park_nearby_places').upsert(links, {
      onConflict: 'park_id,place_id',
    });

    if (linkError) {
      console.error(`    Error linking places to park:`, linkError.message);
    }
  }

  return results;
}

/**
 * Import places for a single park (optimized)
 */
async function importPlacesForPark(park, categories, options = {}) {
  const { dryRun, withDetails } = options;

  const { location, searchLocation } = extractLocation(park);

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Search all categories in parallel
  const categoryPromises = categories.map(async (category) => {
    const query = CATEGORY_QUERIES[category];

    try {
      const searchResult = await searchPlaces(query, location);
      const places = searchResult?.places_results || [];

      // Transform places to database format
      const placeData = places
        .filter((place) => place.data_cid)
        .map((place) => ({
          data_cid: place.data_cid,
          title: place.title,
          category: category,
          address: place.address,
          phone: place.phone,
          website: place.website,
          latitude: place.gps_coordinates?.latitude,
          longitude: place.gps_coordinates?.longitude,
          rating: place.rating,
          reviews_count: place.reviews,
          price_level: place.price,
          thumbnail: place.thumbnail,
          hours: place.hours,
          raw_search_data: place,
        }));

      return { category, places: placeData, count: places.length };
    } catch (err) {
      console.error(`    Error searching ${category}:`, err.message);
      return { category, places: [], count: 0, error: err.message };
    }
  });

  const categoryResults = await Promise.all(categoryPromises);

  // Collect all places and deduplicate by data_cid
  const placesMap = new Map();
  for (const result of categoryResults) {
    if (result.places.length > 0) {
      for (const place of result.places) {
        // Keep first occurrence (preserves original category)
        if (!placesMap.has(place.data_cid)) {
          placesMap.set(place.data_cid, place);
        }
      }
    }
    if (result.error) {
      results.failed++;
    }
  }
  const allPlaces = Array.from(placesMap.values());

  // Log summary
  const summary = categoryResults.map((r) => `${r.category}:${r.count}`).join(', ');
  console.log(`    Found: ${summary}`);

  if (dryRun) {
    console.log(`    [DRY RUN] Would insert ${allPlaces.length} places`);
    results.success = allPlaces.length;
    return results;
  }

  // Batch insert all places
  if (allPlaces.length > 0) {
    const batchResults = await batchInsertPlaces(allPlaces, park.id, searchLocation, dryRun);
    results.success += batchResults.success;
    results.failed += batchResults.failed;
  }

  return results;
}

/**
 * Process parks in parallel batches
 */
async function processParksInBatches(parks, categories, options) {
  const { concurrency = 5, dryRun, withDetails } = options;

  const totals = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Process in batches
  for (let i = 0; i < parks.length; i += concurrency) {
    const batch = parks.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(parks.length / concurrency);

    console.log(`\n[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} parks...`);

    const batchPromises = batch.map(async (park, idx) => {
      const parkNum = i + idx + 1;
      console.log(`  [${parkNum}/${parks.length}] ${park.full_name}`);

      try {
        const results = await importPlacesForPark(park, categories, { dryRun, withDetails });
        return results;
      } catch (err) {
        console.error(`  Error processing ${park.full_name}:`, err.message);
        return { success: 0, failed: 1, skipped: 0 };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      totals.success += result.success;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    }

    // Small delay between batches to avoid rate limiting
    if (i + concurrency < parks.length) {
      await sleep(500);
    }
  }

  return totals;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let parkId = null;
  let parkCode = null;
  let categoryFilter = null;
  let limit = null;
  let offset = 0;
  let dryRun = false;
  let withDetails = false;
  let concurrency = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--park-id' && args[i + 1]) {
      parkId = args[i + 1];
      i++;
    } else if (args[i] === '--park-code' && args[i + 1]) {
      parkCode = args[i + 1];
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      categoryFilter = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--offset' && args[i + 1]) {
      offset = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--with-details') {
      withDetails = true;
    } else if (args[i] === '--skip-details') {
      withDetails = false;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Import Nearby Places Script

Usage: node scripts/import-nearby-places.js [options]

Options:
  --park-id <id>       Import places for a specific park by ID
  --park-code <code>   Import places for a park by code (e.g., yose, yell)
  --category <cat>     Only import specific category
                       (dining, entertainment, bars, lodging, shopping, attractions)
  --limit <n>          Limit number of parks to process
  --offset <n>         Skip first N parks (for resuming)
  --concurrency <n>    Number of parks to process in parallel (default: 5)
  --dry-run            Don't save to database, just show what would be done
  --with-details       Fetch detailed place info (slower, more data)
  --help, -h           Show this help message

Examples:
  # Import dining for first 10 parks
  node scripts/import-nearby-places.js --category dining --limit 10

  # Import all categories for Yellowstone
  node scripts/import-nearby-places.js --park-code yell

  # Resume from park 100 with 10 concurrent requests
  node scripts/import-nearby-places.js --offset 100 --concurrency 10

  # Dry run to see what would be imported
  node scripts/import-nearby-places.js --limit 5 --dry-run
`);
      process.exit(0);
    }
  }

  // Validate category filter
  const categories = categoryFilter ? [categoryFilter] : PLACE_CATEGORIES;
  if (categoryFilter && !PLACE_CATEGORIES.includes(categoryFilter)) {
    console.error(`Invalid category: ${categoryFilter}`);
    console.error(`Valid categories: ${PLACE_CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Import Nearby Places Script (Optimized)');
  console.log('='.repeat(60));
  console.log(`Categories: ${categories.join(', ')}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Offset: ${offset}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`With details: ${withDetails}`);
  console.log('='.repeat(60));

  // Build query for parks
  let query = supabase.from('all_parks').select('id, park_code, full_name, states, latitude, longitude');

  if (parkId) {
    query = query.eq('id', parkId);
  } else if (parkCode) {
    query = query.eq('park_code', parkCode);
  }

  // Apply offset and limit
  if (offset > 0) {
    query = query.range(offset, offset + (limit || 1000) - 1);
  } else if (limit) {
    query = query.limit(limit);
  }

  const { data: parks, error } = await query;

  if (error) {
    console.error('Error fetching parks:', error.message);
    process.exit(1);
  }

  console.log(`\nFound ${parks.length} parks to process`);

  const startTime = Date.now();

  const totals = await processParksInBatches(parks, categories, {
    concurrency,
    dryRun,
    withDetails,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total places added: ${totals.success}`);
  console.log(`Total failed: ${totals.failed}`);
  console.log(`Total skipped: ${totals.skipped}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log(`Parks per second: ${(parks.length / (elapsed || 1)).toFixed(2)}`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes were made to the database');
  }
}

main().catch(console.error);