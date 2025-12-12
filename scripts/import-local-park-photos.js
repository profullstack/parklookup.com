#!/usr/bin/env node

/**
 * Local Park Photos Import Script
 *
 * This script matches local parks with Wikidata entities and imports
 * photos from Wikimedia Commons.
 *
 * Usage:
 *   node scripts/import-local-park-photos.js [options]
 *
 * Options:
 *   --state=XX    Process parks for a specific state (e.g., --state=CA)
 *   --all         Process parks for all states
 *   --limit=N     Limit number of parks to process (for testing)
 *   --dry-run     Show what would be imported without saving
 *   --force       Re-process parks that already have wikidata_id
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import {
  fetchParkMatch,
  fetchCommonsImages,
  fetchWikidataImage,
} from '../lib/api/wikidata-local.js';
import { loadEnv } from './lib/load-env.js';

// Load environment variables
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY } = process.env;

/** Delay between API requests to avoid rate limiting (ms) */
const REQUEST_DELAY = 1000;

/** Maximum photos to fetch per park */
const MAX_PHOTOS_PER_PARK = 5;

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    state: null,
    all: false,
    limit: null,
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
      wikidata_id,
      state_id,
      states!inner(code, name)
    `)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  // Filter by state if specified
  if (options.state) {
    query = query.eq('states.code', options.state);
  }

  // Only process parks without wikidata_id unless force is set
  if (!options.force) {
    query = query.is('wikidata_id', null);
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  } else {
    query = query.limit(1000); // Default batch size
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch parks: ${error.message}`);
  }

  return data || [];
};

/**
 * Updates park with Wikidata ID
 */
const updateParkWikidataId = async (supabase, parkId, wikidataId) => {
  const { error } = await supabase
    .from('local_parks')
    .update({ wikidata_id: wikidataId })
    .eq('id', parkId);

  if (error) {
    console.warn(`⚠️  Failed to update park ${parkId}:`, error.message);
    return false;
  }

  return true;
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
    source: photo.source || 'wikimedia',
    image_url: photo.image_url,
    thumb_url: photo.thumb_url,
    title: photo.title,
    license: photo.license,
    attribution: photo.attribution,
    width: photo.width,
    height: photo.height,
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

  return data?.length ?? 0;
};

/**
 * Processes a single park for photo matching
 */
const processPark = async (supabase, park, options) => {
  const result = {
    matched: false,
    photosAdded: 0,
    error: null,
  };

  try {
    // Try to match with Wikidata
    const match = await fetchParkMatch({
      name: park.name,
      latitude: park.latitude,
      longitude: park.longitude,
    });

    if (!match) {
      return result;
    }

    result.matched = true;

    if (options.dryRun) {
      console.log(`   [DRY RUN] Would match "${park.name}" with ${match.wikidata_id} (${match.label})`);
      return result;
    }

    // Update park with Wikidata ID
    await updateParkWikidataId(supabase, park.id, match.wikidata_id);

    // Fetch primary image from Wikidata P18
    if (match.image_url) {
      const primaryImage = await fetchWikidataImage(match.wikidata_id);
      if (primaryImage) {
        const added = await insertParkPhotos(supabase, park.id, [primaryImage], true);
        result.photosAdded += added;
      }
    }

    // Fetch additional images from Commons category
    if (match.commons_category) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
      const commonsImages = await fetchCommonsImages(match.commons_category, {
        limit: MAX_PHOTOS_PER_PARK - 1,
      });
      if (commonsImages.length > 0) {
        const added = await insertParkPhotos(supabase, park.id, commonsImages, !match.image_url);
        result.photosAdded += added;
      }
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
};

/**
 * Logs an import event to the database
 */
const logImport = async (supabase, status, metadata = {}) => {
  const { error } = await supabase.from('import_logs').insert({
    source: 'wikidata_local_photos',
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
  console.log('📸 Local Park Photos Import Script (Wikidata/Commons)');
  console.log('='.repeat(50));

  // Parse arguments
  const options = parseArgs();

  if (!options.state && !options.all) {
    console.log('\nUsage:');
    console.log('  node scripts/import-local-park-photos.js --state=CA');
    console.log('  node scripts/import-local-park-photos.js --all');
    console.log('  node scripts/import-local-park-photos.js --state=CA --limit=50 --dry-run');
    console.log('  node scripts/import-local-park-photos.js --state=CA --force');
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
    console.log('\n🔍 Matching parks with Wikidata...\n');

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
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
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
    console.log('='.repeat(50));
    console.log('📊 Import Summary:');
    console.log(`   - Parks processed: ${totalResults.processed}`);
    console.log(`   - Parks matched: ${totalResults.matched} (${((totalResults.matched / totalResults.processed) * 100).toFixed(1)}%)`);
    console.log(`   - Photos added: ${totalResults.photosAdded}`);
    console.log(`   - Errors: ${totalResults.errors.length}`);
    console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    if (options.dryRun) {
      console.log('   - Mode: DRY RUN (no data saved)');
    }
    console.log('='.repeat(50));

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