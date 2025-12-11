#!/usr/bin/env node

/**
 * Import Nearby Places Script (ScaleSERP)
 *
 * This script uses the ScaleSERP API to find places (dining, entertainment, bars, etc.)
 * near parks and stores them in the database WITH PHOTOS.
 *
 * ScaleSERP is used instead of ValueSERP because it supports place_photos search type.
 *
 * Usage:
 *   node scripts/import-places-scaleserp.js [options]
 *
 * Options:
 *   --park-id <id>       Import places for a specific park
 *   --park-code <code>   Import places for a park by code
 *   --category <cat>     Only import specific category (dining, entertainment, bars, shopping, attractions)
 *   --limit <n>          Limit number of parks to process
 *   --offset <n>         Skip first N parks (for resuming)
 *   --concurrency <n>    Number of parks to process in parallel (default: 3)
 *   --dry-run            Don't save to database, just show what would be done
 *   --skip-photos        Skip fetching photos (faster, less API calls)
 *   --skip-details       Skip fetching place details
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
const scaleSerpApiKey = env.SCALESERP_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!scaleSerpApiKey) {
  console.error('Missing SCALESERP_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SCALESERP_BASE_URL = 'https://api.scaleserp.com/search';

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
 * Make a request to ScaleSERP API
 */
async function makeScaleSerpRequest(params) {
  const searchParams = new URLSearchParams({
    api_key: scaleSerpApiKey,
    ...params,
  });

  const url = `${SCALESERP_BASE_URL}?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ScaleSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.request_info?.success === false) {
    throw new Error(`ScaleSERP API error: ${data.request_info.message || 'Unknown error'}`);
  }

  return data;
}

/**
 * Search for places using ScaleSERP API
 */
async function searchPlaces(query, location) {
  return makeScaleSerpRequest({
    search_type: 'places',
    q: query,
    location,
    google_domain: 'google.com',
    gl: 'us',
    hl: 'en',
  });
}

/**
 * Get place photos using ScaleSERP API
 * Requires data_id (not data_cid)
 */
async function getPlacePhotos(dataId) {
  return makeScaleSerpRequest({
    search_type: 'place_photos',
    data_id: dataId,
  });
}

/**
 * Get place details using ScaleSERP API
 * Uses data_cid (from places search) to get data_id (needed for photos)
 */
async function getPlaceDetailsByCid(dataCid) {
  return makeScaleSerpRequest({
    search_type: 'place_details',
    data_cid: dataCid,
  });
}

/**
 * Extract city and state from park data
 */
function extractLocation(park) {
  const states = park.states || '';

  if (states.length <= 3 || states.includes(',')) {
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
    return {
      location: `${stateName},United States`,
      searchLocation: stateName,
    };
  }

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
  // Use data_id as the conflict key if available, otherwise data_cid
  const { data: upsertedPlaces, error: upsertError } = await supabase
    .from('nearby_places')
    .upsert(places, {
      onConflict: 'data_cid',
      ignoreDuplicates: false,
    })
    .select('id, title, category');

  if (upsertError) {
    console.error(`    Error upserting places:`, upsertError.message);
    results.failed += places.length;
    return results;
  }

  results.success = upsertedPlaces?.length || 0;

  // Log successful inserts
  if (upsertedPlaces && upsertedPlaces.length > 0) {
    for (const place of upsertedPlaces) {
      console.log(`    ✓ Inserted: ${place.title} (${place.category})`);
    }
    console.log(`    Total inserted: ${upsertedPlaces.length} places`);
  }

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
 * Import places for a single park
 */
async function importPlacesForPark(park, categories, options = {}) {
  const { dryRun, skipPhotos, skipDetails } = options;

  const { location, searchLocation } = extractLocation(park);

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Search all categories sequentially to avoid rate limiting
  for (const category of categories) {
    const query = CATEGORY_QUERIES[category];

    try {
      const searchResult = await searchPlaces(query, location);
      const places = searchResult?.places_results || [];

      console.log(`    ${category}: ${places.length} places found`);

      // Transform places to database format
      // Note: Places search returns data_cid, not data_id
      // We need to get place details first to get data_id for photos
      const placeDataPromises = places
        .filter((place) => place.data_cid)
        .map(async (place) => {
          const placeData = {
            data_cid: String(place.data_cid),
            data_id: null,
            title: place.title,
            category,
            address: place.address,
            phone: place.phone,
            website: place.website,
            latitude: place.gps_coordinates?.latitude,
            longitude: place.gps_coordinates?.longitude,
            rating: place.rating,
            reviews_count: place.reviews,
            price_level: place.price,
            hours: place.hours,
            raw_search_data: place,
          };

          // First, get place details to obtain data_id (required for photos)
          // This also gives us description and other details
          if (place.data_cid && (!skipDetails || !skipPhotos)) {
            try {
              const detailsResult = await getPlaceDetailsByCid(place.data_cid);
              const details = detailsResult?.place_details || {};

              // Store data_id for photos
              if (details.data_id) {
                placeData.data_id = details.data_id;
              }

              if (details.description) {
                placeData.description = details.description;
              }
              if (details.hours && !placeData.hours) {
                placeData.hours = details.hours;
              }

              await sleep(200);
            } catch (err) {
              console.error(`      Error fetching details for ${place.title}:`, err.message);
            }
          }

          // Now fetch photos using data_id (if we have it)
          if (placeData.data_id && !skipPhotos) {
            try {
              const photosResult = await getPlacePhotos(placeData.data_id);
              const photos = photosResult?.place_photos_results || [];

              if (photos.length > 0) {
                placeData.photos = photos.map((p) => ({
                  image: p.image,
                  thumbnail: p.thumbnail,
                  title: p.title,
                }));
                placeData.thumbnail = photos[0].thumbnail || photos[0].image;
                console.log(`      📷 ${place.title}: ${photos.length} photos`);
              }

              // Small delay to avoid rate limiting
              await sleep(200);
            } catch (err) {
              console.error(`      Error fetching photos for ${place.title}:`, err.message);
            }
          }

          return placeData;
        });

      const placeData = await Promise.all(placeDataPromises);

      if (dryRun) {
        console.log(`    [DRY RUN] Would insert ${placeData.length} ${category} places`);
        results.success += placeData.length;
      } else if (placeData.length > 0) {
        const batchResults = await batchInsertPlaces(placeData, park.id, searchLocation, dryRun);
        results.success += batchResults.success;
        results.failed += batchResults.failed;
      }

      // Delay between categories
      await sleep(500);
    } catch (err) {
      console.error(`    Error searching ${category}:`, err.message);
      results.failed++;
    }
  }

  return results;
}

/**
 * Process parks sequentially
 */
async function processParks(parks, categories, options) {
  const { dryRun, skipPhotos, skipDetails } = options;

  const totals = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (let i = 0; i < parks.length; i++) {
    const park = parks[i];
    console.log(`\n[${i + 1}/${parks.length}] ${park.full_name}`);

    try {
      const results = await importPlacesForPark(park, categories, { dryRun, skipPhotos, skipDetails });
      totals.success += results.success;
      totals.failed += results.failed;
      totals.skipped += results.skipped;
    } catch (err) {
      console.error(`  Error processing ${park.full_name}:`, err.message);
      totals.failed++;
    }

    // Delay between parks
    await sleep(1000);
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
  let skipPhotos = false;
  let skipDetails = false;

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
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--skip-photos') {
      skipPhotos = true;
    } else if (args[i] === '--skip-details') {
      skipDetails = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Import Nearby Places Script (ScaleSERP with Photos)

Usage: node scripts/import-places-scaleserp.js [options]

Options:
  --park-id <id>       Import places for a specific park by ID
  --park-code <code>   Import places for a park by code (e.g., yose, yell)
  --category <cat>     Only import specific category
                       (dining, entertainment, bars, shopping, attractions)
  --limit <n>          Limit number of parks to process
  --offset <n>         Skip first N parks (for resuming)
  --dry-run            Don't save to database, just show what would be done
  --skip-photos        Skip fetching photos (faster, less API calls)
  --skip-details       Skip fetching place details
  --help, -h           Show this help message

Examples:
  # Import dining with photos for first 5 parks
  node scripts/import-places-scaleserp.js --category dining --limit 5

  # Import all categories for Yellowstone
  node scripts/import-places-scaleserp.js --park-code yell

  # Import without photos (faster)
  node scripts/import-places-scaleserp.js --limit 10 --skip-photos

  # Dry run to see what would be imported
  node scripts/import-places-scaleserp.js --limit 3 --dry-run
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
  console.log('Import Nearby Places Script (ScaleSERP with Photos)');
  console.log('='.repeat(60));
  console.log(`Categories: ${categories.join(', ')}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Offset: ${offset}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Skip photos: ${skipPhotos}`);
  console.log(`Skip details: ${skipDetails}`);
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

  const totals = await processParks(parks, categories, {
    dryRun,
    skipPhotos,
    skipDetails,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${  '='.repeat(60)}`);
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