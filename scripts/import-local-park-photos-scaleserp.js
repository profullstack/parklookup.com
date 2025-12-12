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
const { SUPABASE_SERVICE_ROLE_KEY, SCALESERP_API_KEY, VALUESERP_API_KEY } = process.env;

/** Delay between API requests to avoid rate limiting (ms) */
const REQUEST_DELAY = 1000;

/** Maximum photos to fetch per park */
const MAX_PHOTOS_PER_PARK = 5;

/** ScaleSERP API base URL */
const SCALESERP_BASE_URL = 'https://api.scaleserp.com/search';

/** ValueSERP API base URL (cheaper, used for image search fallback) */
const VALUESERP_BASE_URL = 'https://api.valueserp.com/search';

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

  // ValueSERP is optional but recommended for cheaper image search
  if (!VALUESERP_API_KEY) {
    console.warn('⚠️  VALUESERP_API_KEY not set - will use ScaleSERP for image search (more expensive)');
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
 * Make a request to ValueSERP API (cheaper than ScaleSERP)
 */
const makeValueSerpRequest = async (params) => {
  const searchParams = new URLSearchParams({
    api_key: VALUESERP_API_KEY,
    ...params,
  });

  const url = `${VALUESERP_BASE_URL}?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ValueSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.request_info?.success === false) {
    throw new Error(`ValueSERP API error: ${data.request_info.message || 'Unknown error'}`);
  }

  return data;
};

/**
 * Search for images using ValueSERP (cheaper) or ScaleSERP (fallback)
 * This is a fallback when place_photos doesn't return full-size images
 */
const searchImages = async (query) => {
  const params = {
    search_type: 'images',
    q: query,
    google_domain: 'google.com',
    gl: 'us',
    hl: 'en',
    num: 10,
  };

  // Use ValueSERP if available (cheaper), otherwise fall back to ScaleSERP
  if (VALUESERP_API_KEY) {
    console.log(`   💰 Using ValueSERP for image search (cheaper)`);
    return makeValueSerpRequest(params);
  } else {
    console.log(`   💸 Using ScaleSERP for image search (no ValueSERP key)`);
    return makeScaleSerpRequest(params);
  }
};

/**
 * Validate if a URL returns an image by checking content-type via HEAD request
 * @param {string} url - The URL to validate
 * @param {number} timeout - Timeout in milliseconds (default 5000)
 * @returns {Promise<{isValid: boolean, contentType: string|null}>}
 */
const validateImageUrl = async (url, timeout = 5000) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkLookup/1.0)',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { isValid: false, contentType: null };
    }
    
    const contentType = response.headers.get('content-type') || '';
    const isImage = contentType.startsWith('image/');
    
    return { isValid: isImage, contentType };
  } catch (error) {
    // Timeout, network error, or CORS issue
    return { isValid: false, contentType: null };
  }
};

/**
 * Validate multiple image URLs in parallel batches of 10
 * @param {Array<{url: string, ...rest}>} images - Array of image objects with url property
 * @param {number} batchSize - Number of concurrent requests per batch (default 10)
 * @returns {Promise<Array<{url: string, isValid: boolean, contentType: string|null, ...rest}>>}
 */
const validateImageUrls = async (images, batchSize = 10) => {
  const results = [];
  
  // Process in batches of 10 for controlled parallelism
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (img) => {
        const imageUrl = img.image || img.original || img.url;
        if (!imageUrl) {
          return { ...img, isValid: false, contentType: null };
        }
        const validation = await validateImageUrl(imageUrl);
        return { ...img, ...validation };
      })
    );
    results.push(...batchResults);
  }
  
  return results;
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
  // First, get parks that already have photos (to exclude them unless --force)
  let parksWithPhotos = new Set();
  
  if (!options.force) {
    const { data: photoParkIds } = await supabase
      .from('park_photos')
      .select('park_id')
      .not('park_id', 'is', null);
    
    if (photoParkIds) {
      parksWithPhotos = new Set(photoParkIds.map(p => p.park_id));
    }
  }

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

  // Filter out parks that already have photos (unless --force)
  let parks = data || [];
  if (!options.force && parksWithPhotos.size > 0) {
    parks = parks.filter(p => !parksWithPhotos.has(p.id));
  }

  return parks;
};

/**
 * Inserts photos for a park
 * Note: source must be one of: 'wikimedia', 'nps', 'user', 'other'
 * We use 'other' for ScaleSERP/Google Places photos
 */
const insertParkPhotos = async (supabase, parkId, photos, isPrimary = false) => {
  if (!photos || photos.length === 0) {
    return 0;
  }

  // Log first photo structure for debugging
  if (photos.length > 0) {
    console.log(`   📋 Photo structure: ${JSON.stringify(Object.keys(photos[0]))}`);
  }

  // Filter and map photos - ScaleSERP may use different field names
  const records = photos
    .map((photo, index) => {
      // Try different possible field names for image URL
      // Do NOT use thumbnail as fallback - we want full-size images only
      const imageUrl = photo.image || photo.original || photo.link || photo.url;
      const thumbUrl = photo.thumbnail || photo.thumb || imageUrl;
      
      if (!imageUrl) {
        console.log(`   ⚠️  Photo ${index} has no full-size image (only thumbnail):`, JSON.stringify(photo).substring(0, 200));
        return null;
      }

      return {
        park_id: parkId,
        source: 'other', // ScaleSERP/Google Places photos use 'other' source
        image_url: imageUrl,
        thumb_url: thumbUrl,
        title: photo.title || photo.name || null,
        is_primary: isPrimary && index === 0,
      };
    })
    .filter(Boolean); // Remove null entries

  if (records.length === 0) {
    console.log(`   ⚠️  No valid photos to insert after filtering`);
    return 0;
  }

  console.log(`   📝 Inserting ${records.length} valid photos...`);

  const { data, error } = await supabase
    .from('park_photos')
    .upsert(records, {
      onConflict: 'park_id,image_url',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) {
    console.warn(`   ⚠️  Failed to insert photos:`, error.message);
    return 0;
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
    
    console.log(`\n   📍 Searching for "${park.name}" in ${cityName || countyName || ''}, ${stateName}...`);
    
    // Search for the park on Google Places
    const searchResult = await searchPark(park.name, cityName || countyName, stateName);
    const places = searchResult?.places_results || [];

    console.log(`   📊 Search returned ${places.length} results`);

    if (places.length === 0) {
      console.log(`   ⚪ No Google Places match found`);
      return result;
    }

    // Find the best match (first result is usually best)
    const bestMatch = places[0];
    
    if (!bestMatch.data_cid) {
      console.log(`   ⚪ No data_cid in search result`);
      return result;
    }

    result.matched = true;
    console.log(`   🔍 Found: "${bestMatch.title}" (${bestMatch.address || 'no address'})`);
    console.log(`   📋 data_cid: ${bestMatch.data_cid}`);

    if (options.dryRun) {
      console.log(`   [DRY RUN] Would fetch photos for "${bestMatch.title}"`);
      return result;
    }

    // Get place details to obtain data_id (required for photos)
    console.log(`   ⏳ Fetching place details...`);
    await sleep(REQUEST_DELAY);
    const detailsResult = await getPlaceDetails(bestMatch.data_cid);
    const details = detailsResult?.place_details || {};

    if (!details.data_id) {
      console.log(`   ⚠️  Could not get data_id from place details`);
      console.log(`   📋 Details response keys: ${Object.keys(detailsResult || {}).join(', ')}`);
      return result;
    }

    console.log(`   📋 data_id: ${details.data_id}`);

    // Fetch photos using data_id
    console.log(`   ⏳ Fetching place photos...`);
    await sleep(REQUEST_DELAY);
    const photosResult = await getPlacePhotos(details.data_id);
    let photos = photosResult?.place_photos_results || [];

    console.log(`   📷 Found ${photos.length} place photos`);

    // Check if we have full-size images (not just thumbnails)
    const fullSizePhotos = photos.filter(p => p.image || p.original || p.link || p.url);
    console.log(`   📷 ${fullSizePhotos.length} have full-size images`);

    // If no full-size images from place_photos, try Google Images search
    if (fullSizePhotos.length === 0) {
      console.log(`   🔄 No full-size images from place_photos, trying Google Images search...`);
      await sleep(REQUEST_DELAY);
      
      const imageQuery = `${park.name} park ${cityName || countyName || ''} ${stateName}`;
      const imagesResult = await searchImages(imageQuery);
      const imageResults = imagesResult?.image_results || [];
      
      console.log(`   📷 Google Images returned ${imageResults.length} results`);
      
      // Log first result structure for debugging
      if (imageResults.length > 0) {
        console.log(`   📋 Image result fields: ${Object.keys(imageResults[0]).join(', ')}`);
        console.log(`   📋 First image URL: ${imageResults[0].image || imageResults[0].original || 'none'}`);
      }
      
      // Filter out results without image URLs
      const candidateImages = imageResults.filter(img => {
        const imageUrl = img.image || img.original;
        if (!imageUrl) {
          return false;
        }
        return true;
      });
      
      console.log(`   📷 ${candidateImages.length} candidates with image URLs`);
      
      // Validate image URLs using HEAD requests to check content-type
      // This catches URLs that don't have obvious image extensions but still return images
      console.log(`   🔍 Validating image URLs via HEAD requests...`);
      const validatedImages = await validateImageUrls(candidateImages);
      
      let validCount = 0;
      let invalidCount = 0;
      
      photos = validatedImages
        .filter(img => {
          if (img.isValid) {
            validCount++;
            return true;
          } else {
            invalidCount++;
            const imageUrl = img.image || img.original;
            if (invalidCount <= 3) {
              console.log(`   ⚠️  Invalid image (${img.contentType || 'no response'}): ${imageUrl?.substring(0, 60)}...`);
            }
            return false;
          }
        })
        .map(img => ({
          image: img.image || img.original,
          thumbnail: img.thumbnail,
          title: img.title,
        }));
      
      console.log(`   📷 ${validCount} valid images, ${invalidCount} invalid after HEAD validation`);
    } else {
      photos = fullSizePhotos;
    }

    if (photos.length === 0) {
      console.log(`   🔴 No photos found from either source`);
      return result;
    }

    // Limit photos
    const limitedPhotos = photos.slice(0, MAX_PHOTOS_PER_PARK);
    
    // Insert photos
    console.log(`   ⏳ Inserting ${limitedPhotos.length} photos into database...`);
    const added = await insertParkPhotos(supabase, park.id, limitedPhotos, true);
    result.photosAdded = added;
    result.photoSources.push(`google_places(${added})`);

    console.log(`   🟢 Added ${added} photos from Google Places`);

  } catch (error) {
    result.error = error.message;
    console.log(`   ❌ Error: ${error.message}`);
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