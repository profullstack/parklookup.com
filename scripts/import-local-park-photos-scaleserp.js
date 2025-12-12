#!/usr/bin/env node

/**
 * Import Local Park Photos Script (ScaleSERP)
 *
 * This script uses the ScaleSERP API to find photos for local parks
 * (county/city parks) by searching Google Places.
 *
 * Usage:
 *   node scripts/import-local-park-photos-scaleserp.js [options]
 *
 * Options:
 *   --state=XX       Process parks for a specific state (e.g., --state=CA)
 *   --all            Process parks for all states
 *   --limit=N        Limit number of parks to process
 *   --offset=N       Skip first N parks (for resuming)
 *   --dry-run        Don't save to database, just show what would be done
 *   --force          Re-process parks that already have photos
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 *   - SCALESERP_API_KEY: Your ScaleSERP API key
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/load-env.js';

// Load environment variables
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY, SCALESERP_API_KEY } = process.env;

/** Delay between API requests to avoid rate limiting (ms) */
const REQUEST_DELAY = 1000;

/** Maximum photos to fetch per park */
const MAX_PHOTOS_PER_PARK = 5;

/** ScaleSERP API base URL */
const SCALESERP_BASE_URL = 'https://api.scaleserp.com/search';

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    state: null,
    all: false,
    limit: null,
    offset: 0,
    dryRun: false,
    force: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--state=')) {
      options.state = arg.split('=')[1].toUpperCase();
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--offset=')) {
      options.offset = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    }
  }

  return options;
};

/**
 * Validates required environment variables
 */
const validateEnv = () => {
  const missing = [];

  if (!SUPABASE_URL) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!SCALESERP_API_KEY) missing.push('SCALESERP_API_KEY');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
};

/**
 * Creates a Supabase client with service role key
 */
const createSupabaseClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Make a request to ScaleSERP API
 */
const makeScaleSerpRequest = async (params) => {
  const searchParams = new URLSearchParams({
    api_key: SCALESERP_API_KEY,
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
};

/**
 * Search for a park using ScaleSERP Places API
 */
const searchPark = async (parkName, city, state) => {
  const query = city 
    ? `${parkName} park ${city} ${state}`
    : `${parkName} park ${state}`;
  
  return makeScaleSerpRequest({
    search_type: 'places',
    q: query,
    google_domain: 'google.com',
    gl: 'us',
    hl: 'en',
  });
};

/**
 * Get place photos using ScaleSERP API
 */
const getPlacePhotos = async (dataId) => {
  return makeScaleSerpRequest({
    search_type: 'place_photos',
    data_id: dataId,
  });
};

/**
 * Get place details to obtain data_id (needed for photos)
 */
const getPlaceDetails = async (dataCid) => {
  return makeScaleSerpRequest({
    search_type: 'place_details',
    data_cid: dataCid,
  });
};

/**
 * Fetches parks that need photo matching
 */
const fetchParksToProcess = async (supabase, options) => {
  let query = supabase
    .from('local_parks')
    .select(`
      id,
      name,
      slug,
      latitude,
      longitude,
      state_id,
      city_id,
      county_id,
      states!inner(code, name),
      cities(name),
      counties(name)
    `)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  // Filter by state if specified
  if (options.state) {
    query = query.eq('states.code', options.state);
  }

  // Only process parks without photos unless force is set
  if (!options.force) {
    // Check if park has any photos in park_photos table
    query = query.is('primary_photo_url', null);
  }

  // Apply offset
  if (options.offset > 0) {
    query = query.range(options.offset, options.offset + (options.limit || 1000) - 1);
  } else if (options.limit) {
    query = query.limit(options.limit);
  } else {
    query = query.limit(1000);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch parks: ${error.message}`);
  }

  return data || [];
};

/**
 * Inserts photos for a park
 */
const insertParkPhotos = async (supabase, parkId, photos, isPrimary = false) => {
  if (!photos || photos.length === 0) {
    return 0;
  }

  const records = photos.map((photo, index) => ({
    park_id: parkId,
    source: 'scaleserp',
    image_url: photo.image,
    thumb_url: photo.thumbnail,
    title: photo.title || null,
    is_primary: isPrimary && index === 0,
  }));

  const { data, error } = await supabase
    .from('park_photos')
    .upsert(records, {
      onConflict: 'park_id,image_url',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) {
    console.warn(`⚠️  Failed to insert photos:`, error.message);
    return 0;
  }

  // Update primary_photo_url on the park if we added photos
  if (data?.length > 0 && isPrimary && photos[0]?.thumbnail) {
    await supabase
      .from('local_parks')
      .update({ primary_photo_url: photos[0].thumbnail })
      .eq('id', parkId);
  }

  return data?.length ?? 0;
};

/**
 * Processes a single park for photo fetching
 */
const processPark = async (supabase, park, options) => {
  const result = {
    matched: false,
    photosAdded: 0,
    error: null,
    photoSources: [],
  };

  try {
    const stateName = park.states?.name || park.states?.code;
    const cityName = park.cities?.name;
    const countyName = park.counties?.name;
    
    // Search for the park on Google Places
    const searchResult = await searchPark(park.name, cityName || countyName, stateName);
    const places = searchResult?.places_results || [];

    if (places.length === 0) {
      console.log(`\n   ⚪ "${park.name}" - No Google Places match found`);
      return result;
    }

    // Find the best match (first result is usually best)
    const bestMatch = places[0];
    
    if (!bestMatch.data_cid) {
      console.log(`\n   ⚪ "${park.name}" - No data_cid in search result`);
      return result;
    }

    result.matched = true;
    console.log(`\n   🔍 "${park.name}" - Found: "${bestMatch.title}" (${bestMatch.address || 'no address'})`);

    if (options.dryRun) {
      console.log(`   [DRY RUN] Would fetch photos for "${bestMatch.title}"`);
      return result;
    }

    // Get place details to obtain data_id (required for photos)
    await sleep(REQUEST_DELAY);
    const detailsResult = await getPlaceDetails(bestMatch.data_cid);
    const details = detailsResult?.place_details || {};

    if (!details.data_id) {
      console.log(`   ⚠️  "${park.name}" - Could not get data_id from place details`);
      return result;
    }

    // Fetch photos using data_id
    await sleep(REQUEST_DELAY);
    const photosResult = await getPlacePhotos(details.data_id);
    const photos = photosResult?.place_photos_results || [];

    if (photos.length === 0) {
      console.log(`   🔴 "${park.name}" - Matched but NO PHOTOS found on Google Places`);
      return result;
    }

    // Limit photos
    const limitedPhotos = photos.slice(0, MAX_PHOTOS_PER_PARK);
    
    // Insert photos
    const added = await insertParkPhotos(supabase, park.id, limitedPhotos, true);
    result.photosAdded = added;
    result.photoSources.push(`google_places(${added})`);

    console.log(`   🟢 "${park.name}" - Added ${added} photos from Google Places`);

  } catch (error) {
    result.error = error.message;
    console.log(`\n   ❌ "${park.name}" - Error: ${error.message}`);
  }

  return result;
};

/**
 * Logs an import event to the database
 */
const logImport = async (supabase, status, metadata = {}) => {
  const { error } = await supabase.from('import_logs').insert({
    source: 'scaleserp_local_photos',
    status,
    ...metadata,
  });

  if (error) {
    console.warn('⚠️  Failed to log import:', error.message);
  }
};

/**
 * Main import function
 */
const main = async () => {
  console.log('📸 Local Park Photos Import Script (ScaleSERP/Google Places)');
  console.log('='.repeat(60));

  // Parse arguments
  const options = parseArgs();

  if (!options.state && !options.all) {
    console.log('\nUsage:');
    console.log('  node scripts/import-local-park-photos-scaleserp.js --state=CA');
    console.log('  node scripts/import-local-park-photos-scaleserp.js --all');
    console.log('  node scripts/import-local-park-photos-scaleserp.js --state=CA --limit=50 --dry-run');
    console.log('  node scripts/import-local-park-photos-scaleserp.js --state=CA --force');
    console.log('  node scripts/import-local-park-photos-scaleserp.js --all --offset=100 --limit=100');
    process.exit(0);
  }

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  // Log import start
  const startTime = new Date();
  await logImport(supabase, 'started', { started_at: startTime.toISOString() });

  const totalResults = {
    processed: 0,
    matched: 0,
    photosAdded: 0,
    errors: [],
  };

  try {
    // Fetch parks to process
    console.log('\n📍 Fetching parks to process...');
    const parks = await fetchParksToProcess(supabase, options);
    console.log(`   Found ${parks.length} parks to process`);

    if (parks.length === 0) {
      console.log('\n✅ No parks to process!');
      return;
    }

    // Process each park
    console.log('\n🔍 Searching Google Places for park photos...\n');

    for (let i = 0; i < parks.length; i++) {
      const park = parks[i];
      const stateCode = park.states?.code || 'XX';

      process.stdout.write(`\r   Processing ${i + 1}/${parks.length}: ${park.name.substring(0, 40).padEnd(40)}`);

      const result = await processPark(supabase, park, options);

      totalResults.processed++;
      if (result.matched) {
        totalResults.matched++;
        totalResults.photosAdded += result.photosAdded;
      }
      if (result.error) {
        totalResults.errors.push({ park: park.name, state: stateCode, error: result.error });
      }

      // Rate limiting delay
      if (i < parks.length - 1) {
        await sleep(REQUEST_DELAY);
      }
    }

    console.log('\n'); // New line after progress

    // Log import completion
    const endTime = new Date();
    await logImport(supabase, 'completed', {
      records_fetched: parks.length,
      records_inserted: totalResults.photosAdded,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      metadata: {
        parks_processed: totalResults.processed,
        parks_matched: totalResults.matched,
        photos_added: totalResults.photosAdded,
        duration_ms: endTime - startTime,
        errors: totalResults.errors,
        dry_run: options.dryRun,
      },
    });

    // Print summary
    console.log('='.repeat(60));
    console.log('📊 Import Summary:');
    console.log(`   - Parks processed: ${totalResults.processed}`);
    console.log(`   - Parks matched: ${totalResults.matched} (${((totalResults.matched / totalResults.processed) * 100).toFixed(1)}%)`);
    console.log(`   - Photos added: ${totalResults.photosAdded}`);
    console.log(`   - Errors: ${totalResults.errors.length}`);
    console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    if (options.dryRun) {
      console.log('   - Mode: DRY RUN (no data saved)');
    }
    console.log('='.repeat(60));

    if (totalResults.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      totalResults.errors.slice(0, 10).forEach((e) => {
        console.log(`   - ${e.park} (${e.state}): ${e.error}`);
      });
      if (totalResults.errors.length > 10) {
        console.log(`   ... and ${totalResults.errors.length - 10} more errors`);
      }
    }

    console.log('\n✅ Photo import completed!');
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);

    // Log import failure
    await logImport(supabase, 'failed', {
      error_message: error.message,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
    });

    process.exit(1);
  }
};

// Run the script
main();