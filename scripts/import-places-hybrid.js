#!/usr/bin/env node

/**
 * Hybrid Import Nearby Places Script
 *
 * This script uses a cost-optimized hybrid approach:
 * 1. ValueSERP: places search -> data_cid (cheaper/unlimited)
 * 2. ScaleSERP: place_details (data_cid) -> data_id (1 credit)
 * 3. ScaleSERP: place_photos (data_id) -> photos (1 credit)
 *
 * This saves money by using ValueSERP for the bulk search operations
 * and only using ScaleSERP for the details/photos that require it.
 *
 * Usage:
 *   node scripts/import-places-hybrid.js [options]
 *
 * Options:
 *   --park-id <id>       Import places for a specific park
 *   --park-code <code>   Import places for a park by code
 *   --category <cat>     Only import specific category (dining, entertainment, bars, shopping, attractions)
 *   --limit <n>          Limit number of parks to process
 *   --offset <n>         Skip first N parks (for resuming)
 *   --places-per-cat <n> Number of places per category (default: 5)
 *   --concurrency <n>    Number of parks to process in parallel (default: 3)
 *   --dry-run            Don't save to database, just show what would be done
 *   --skip-photos        Skip fetching photos (faster, less API calls)
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
const valueSerpApiKey = env.VALUESERP_API_KEY;
const scaleSerpApiKey = env.SCALESERP_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!valueSerpApiKey) {
  console.error('Missing VALUESERP_API_KEY environment variable');
  process.exit(1);
}

if (!scaleSerpApiKey) {
  console.error('Missing SCALESERP_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VALUESERP_BASE_URL = 'https://api.valueserp.com/search';
const SCALESERP_BASE_URL = 'https://api.scaleserp.com/search';

const PLACE_CATEGORIES = ['dining', 'entertainment', 'bars', 'shopping', 'attractions'];

const CATEGORY_QUERIES = {
  dining: 'restaurants',
  entertainment: 'entertainment',
  bars: 'bars nightlife',
  shopping: 'shopping',
  attractions: 'tourist attractions things to do',
};

// Track API usage
let valueSerpCalls = 0;
let scaleSerpCalls = 0;

// Cooldown duration for server errors (30 seconds)
const ERROR_COOLDOWN_MS = 30000;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an HTTP status code indicates a server error that should trigger cooldown
 */
function isServerError(status) {
  return status >= 500 || status === 429; // 5xx errors or rate limiting
}

/**
 * Make a request to ValueSERP API (for places search) with retry on server errors
 */
async function makeValueSerpRequest(params, retryCount = 0) {
  valueSerpCalls++;
  const searchParams = new URLSearchParams({
    api_key: valueSerpApiKey,
    ...params,
  });

  const url = `${VALUESERP_BASE_URL}?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();

    // If server error, apply cooldown and retry once
    if (isServerError(response.status) && retryCount < 1) {
      console.warn(
        `    ⚠️ ValueSERP server error (${response.status}), cooling down for 30 seconds...`
      );
      await sleep(ERROR_COOLDOWN_MS);
      return makeValueSerpRequest(params, retryCount + 1);
    }

    throw new Error(`ValueSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.request_info?.success === false) {
    throw new Error(`ValueSERP API error: ${data.request_info.message || 'Unknown error'}`);
  }

  return data;
}

/**
 * Make a request to ScaleSERP API (for details and photos) with retry on server errors
 */
async function makeScaleSerpRequest(params, retryCount = 0) {
  scaleSerpCalls++;
  const searchParams = new URLSearchParams({
    api_key: scaleSerpApiKey,
    ...params,
  });

  const url = `${SCALESERP_BASE_URL}?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();

    // If server error, apply cooldown and retry once
    if (isServerError(response.status) && retryCount < 1) {
      console.warn(
        `    ⚠️ ScaleSERP server error (${response.status}), cooling down for 30 seconds...`
      );
      await sleep(ERROR_COOLDOWN_MS);
      return makeScaleSerpRequest(params, retryCount + 1);
    }

    throw new Error(`ScaleSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.request_info?.success === false) {
    throw new Error(`ScaleSERP API error: ${data.request_info.message || 'Unknown error'}`);
  }

  return data;
}

/**
 * Search for places using ValueSERP API (cheaper)
 */
async function searchPlacesValueSerp(query, location) {
  return makeValueSerpRequest({
    search_type: 'places',
    q: query,
    location,
    google_domain: 'google.com',
    gl: 'us',
    hl: 'en',
  });
}

/**
 * Get place details using ValueSERP API (to get data_id)
 * This is cheaper than ScaleSERP and returns the same data_id
 */
async function getPlaceDetailsValueSerp(dataCid) {
  return makeValueSerpRequest({
    search_type: 'place_details',
    data_cid: dataCid,
  });
}

/**
 * Get place photos using ScaleSERP API
 */
async function getPlacePhotosScaleSerp(dataId) {
  return makeScaleSerpRequest({
    search_type: 'place_photos',
    data_id: dataId,
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
 * Import places for a single park using hybrid approach
 */
async function importPlacesForPark(park, categories, options = {}) {
  const { dryRun, skipPhotos, placesPerCategory } = options;

  const { location, searchLocation } = extractLocation(park);

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Search all categories sequentially
  for (const category of categories) {
    const query = CATEGORY_QUERIES[category];

    try {
      // Step 1: Use ValueSERP for places search (cheaper)
      const searchResult = await searchPlacesValueSerp(query, location);
      const places = searchResult?.places_results || [];

      // Limit places per category
      const limitedPlaces = places.slice(0, placesPerCategory);

      console.log(`    ${category}: ${places.length} found, processing ${limitedPlaces.length}`);

      // Transform places to database format
      const placeDataPromises = limitedPlaces
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

          // Step 2: Use ValueSERP for place details (to get data_id) - FREE
          try {
            const detailsResult = await getPlaceDetailsValueSerp(place.data_cid);
            const details = detailsResult?.place_details || {};

            if (details.data_id) {
              placeData.data_id = details.data_id;
            }
            if (details.description) {
              placeData.description = details.description;
            }
            if (details.hours && !placeData.hours) {
              placeData.hours = details.hours;
            }

            await sleep(150);
          } catch (err) {
            console.error(`      Error fetching details for ${place.title}:`, err.message);
          }

          // Step 3: Use ScaleSERP for photos (requires data_id)
          if (placeData.data_id && !skipPhotos) {
            try {
              const photosResult = await getPlacePhotosScaleSerp(placeData.data_id);
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

              await sleep(150);
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
      await sleep(300);
    } catch (err) {
      console.error(`    Error searching ${category}:`, err.message);
      results.failed++;
    }
  }

  return results;
}

/**
 * Process a single park and return results with park info for logging
 */
async function processSinglePark(park, index, total, categories, options) {
  const { dryRun, skipPhotos, placesPerCategory } = options;

  console.log(`\n[${index + 1}/${total}] ${park.full_name}`);

  try {
    const results = await importPlacesForPark(park, categories, {
      dryRun,
      skipPhotos,
      placesPerCategory,
    });
    return {
      success: results.success,
      failed: results.failed,
      skipped: results.skipped,
    };
  } catch (err) {
    console.error(`  Error processing ${park.full_name}:`, err.message);
    return { success: 0, failed: 1, skipped: 0 };
  }
}

/**
 * Process parks in parallel batches
 */
async function processParks(parks, categories, options) {
  const { concurrency = 1 } = options;

  const totals = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Process parks in batches of `concurrency`
  for (let i = 0; i < parks.length; i += concurrency) {
    const batch = parks.slice(i, i + concurrency);

    // Process batch in parallel
    const batchPromises = batch.map((park, batchIndex) =>
      processSinglePark(park, i + batchIndex, parks.length, categories, options)
    );

    const batchResults = await Promise.all(batchPromises);

    // Aggregate results
    for (const result of batchResults) {
      totals.success += result.success;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    }

    // Delay between batches (not between individual parks)
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
  let skipPhotos = false;
  let placesPerCategory = 5;
  let concurrency = 3;

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
    } else if (args[i] === '--places-per-cat' && args[i + 1]) {
      placesPerCategory = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--skip-photos') {
      skipPhotos = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Hybrid Import Nearby Places Script (ValueSERP + ScaleSERP)

Uses ValueSERP for places search (cheaper) and ScaleSERP for details/photos.

Usage: node scripts/import-places-hybrid.js [options]

Options:
  --park-id <id>       Import places for a specific park by ID
  --park-code <code>   Import places for a park by code (e.g., yose, yell)
  --category <cat>     Only import specific category or comma-separated list
                       (dining, entertainment, bars, shopping, attractions)
                       Example: --category dining,bars
  --limit <n>          Limit number of parks to process
  --offset <n>         Skip first N parks (for resuming)
  --places-per-cat <n> Number of places per category (default: 5)
  --concurrency <n>    Number of parks to process in parallel (default: 3)
  --dry-run            Don't save to database, just show what would be done
  --skip-photos        Skip fetching photos (faster, less API calls)
  --help, -h           Show this help message

Examples:
  # Import 5 places per category for first 10 parks (3 at a time)
  node scripts/import-places-hybrid.js --limit 10

  # Import with higher parallelism (5 parks at a time)
  node scripts/import-places-hybrid.js --limit 20 --concurrency 5

  # Import all categories for Yellowstone
  node scripts/import-places-hybrid.js --park-code yell

  # Import only dining and bars for all parks
  node scripts/import-places-hybrid.js --category dining,bars

  # Import without photos (faster)
  node scripts/import-places-hybrid.js --limit 100 --skip-photos

  # Dry run to see what would be imported
  node scripts/import-places-hybrid.js --limit 3 --dry-run
`);
      process.exit(0);
    }
  }

  // Validate category filter (supports comma-separated values)
  let categories = PLACE_CATEGORIES;
  if (categoryFilter) {
    categories = categoryFilter.split(',').map((c) => c.trim());
    const invalidCategories = categories.filter((c) => !PLACE_CATEGORIES.includes(c));
    if (invalidCategories.length > 0) {
      console.error(`Invalid categories: ${invalidCategories.join(', ')}`);
      console.error(`Valid categories: ${PLACE_CATEGORIES.join(', ')}`);
      process.exit(1);
    }
  }

  console.log('='.repeat(60));
  console.log('Hybrid Import (ValueSERP search + ScaleSERP details/photos)');
  console.log('='.repeat(60));
  console.log(`Categories: ${categories.join(', ')}`);
  console.log(`Places per category: ${placesPerCategory}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Offset: ${offset}`);
  console.log(`Concurrency: ${concurrency} parks in parallel`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Skip photos: ${skipPhotos}`);
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
    placesPerCategory,
    concurrency,
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
  console.log('');
  console.log('API Usage:');
  console.log(`  ValueSERP calls: ${valueSerpCalls} (places search)`);
  console.log(`  ScaleSERP calls: ${scaleSerpCalls} (details + photos)`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes were made to the database');
  }
}

main().catch(console.error);