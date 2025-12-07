#!/usr/bin/env node

/**
 * Import Nearby Places Script
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
 *   --skip-details       Skip fetching detailed place info (faster, less data)
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

const PLACE_CATEGORIES = ['dining', 'entertainment', 'bars', 'lodging', 'shopping', 'attractions'];

const CATEGORY_QUERIES = {
  dining: 'restaurants',
  entertainment: 'entertainment',
  bars: 'bars nightlife',
  lodging: 'hotels motels',
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
 * Import places for a single park
 */
async function importPlacesForPark(park, categories, options = {}) {
  const { dryRun, skipDetails } = options;

  const { location, searchLocation } = extractLocation(park);

  console.log(`\n  Searching near: ${searchLocation}`);

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const category of categories) {
    const query = CATEGORY_QUERIES[category];

    try {
      console.log(`    Searching for ${category}...`);

      const searchResult = await searchPlaces(query, location);
      const places = searchResult?.places_results || [];

      console.log(`    Found ${places.length} ${category} places`);

      for (const place of places) {
        if (!place.data_cid) {
          results.skipped++;
          continue;
        }

        try {
          // Check if place already exists
          const { data: existingPlace } = await supabase
            .from('nearby_places')
            .select('id')
            .eq('data_cid', place.data_cid)
            .single();

          let placeId;

          if (existingPlace) {
            placeId = existingPlace.id;
            console.log(`      Existing: ${place.title}`);
          } else {
            // Get place details if not skipping
            let details = {};
            if (!skipDetails && !dryRun) {
              try {
                await sleep(500); // Rate limiting
                const detailsResult = await getPlaceDetails(place.data_cid);
                details = detailsResult?.place_results || {};
              } catch (err) {
                console.log(`      Warning: Could not get details for ${place.title}`);
              }
            }

            const placeData = {
              data_cid: place.data_cid,
              title: place.title,
              category: category,
              address: place.address || details.address,
              phone: place.phone || details.phone,
              website: place.website || details.website,
              latitude: place.gps_coordinates?.latitude || details.gps_coordinates?.latitude,
              longitude: place.gps_coordinates?.longitude || details.gps_coordinates?.longitude,
              rating: place.rating || details.rating,
              reviews_count: place.reviews || details.reviews,
              price_level: place.price || details.price,
              thumbnail: place.thumbnail,
              hours: place.hours || details.hours,
              images: details.images,
              description: details.description,
              popular_times: details.popular_times,
              reviews: details.reviews_results?.slice(0, 5),
              raw_search_data: place,
              raw_details_data: Object.keys(details).length > 0 ? details : null,
            };

            if (dryRun) {
              console.log(`      [DRY RUN] Would insert: ${place.title}`);
              results.success++;
              continue;
            }

            const { data: newPlace, error: insertError } = await supabase
              .from('nearby_places')
              .insert(placeData)
              .select('id')
              .single();

            if (insertError) {
              console.error(`      Error inserting ${place.title}:`, insertError.message);
              results.failed++;
              continue;
            }

            placeId = newPlace.id;
            console.log(`      Added: ${place.title}`);
          }

          // Link place to park
          if (!dryRun && placeId) {
            const { error: linkError } = await supabase.from('park_nearby_places').upsert(
              {
                park_id: park.id,
                place_id: placeId,
                search_location: searchLocation,
              },
              {
                onConflict: 'park_id,place_id',
              }
            );

            if (linkError) {
              console.error(`      Error linking to park:`, linkError.message);
            }
          }

          results.success++;
        } catch (err) {
          console.error(`      Error processing ${place.title}:`, err.message);
          results.failed++;
        }
      }

      // Rate limiting between category searches
      await sleep(1000);
    } catch (err) {
      console.error(`    Error searching ${category}:`, err.message);
      results.failed++;
    }
  }

  return results;
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
  let dryRun = false;
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
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--skip-details') {
      skipDetails = true;
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
  console.log('Import Nearby Places Script');
  console.log('='.repeat(60));
  console.log(`Categories: ${categories.join(', ')}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Skip details: ${skipDetails}`);
  console.log('='.repeat(60));

  // Build query for parks
  let query = supabase.from('all_parks').select('id, park_code, full_name, states, latitude, longitude');

  if (parkId) {
    query = query.eq('id', parkId);
  } else if (parkCode) {
    query = query.eq('park_code', parkCode);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data: parks, error } = await query;

  if (error) {
    console.error('Error fetching parks:', error.message);
    process.exit(1);
  }

  console.log(`\nFound ${parks.length} parks to process`);

  const totals = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (let i = 0; i < parks.length; i++) {
    const park = parks[i];
    console.log(`\n[${i + 1}/${parks.length}] ${park.full_name}`);

    const results = await importPlacesForPark(park, categories, { dryRun, skipDetails });

    totals.success += results.success;
    totals.failed += results.failed;
    totals.skipped += results.skipped;

    // Rate limiting between parks
    if (i < parks.length - 1) {
      await sleep(2000);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total places added: ${totals.success}`);
  console.log(`Total failed: ${totals.failed}`);
  console.log(`Total skipped: ${totals.skipped}`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes were made to the database');
  }
}

main().catch(console.error);