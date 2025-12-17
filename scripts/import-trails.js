#!/usr/bin/env node

/**
 * Trail Data Import Script
 *
 * This script fetches hiking trails from OpenStreetMap via the Overpass API
 * and imports them into the Supabase database, associating them with parks.
 *
 * Usage:
 *   pnpm run import:trails [options]
 *
 * Options:
 *   --park-type <type>   Filter parks by type: nps, wikidata, local, all (default: all)
 *   --limit <n>          Limit number of parks to process (default: all)
 *   --skip <n>           Skip first n parks (for resuming interrupted imports)
 *   --park-id <id>       Import trails for a specific park ID only
 *   --radius <km>        Search radius around park center in km (default: 5)
 *   --delay <ms>         Delay between parks in ms (default: 3000)
 *   --dry-run            Don't insert into database, just log what would be done
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/load-env.js';
import {
  fetchTrailsInBbox,
  calculateBbox,
  extractCoordinates,
} from '../lib/api/overpass.js';
import {
  transformOsmElements,
  prepareForDatabase,
  deduplicateTrails,
} from '../lib/api/trails.js';

// Load environment variables from .env file
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY } = process.env;

// Default configuration
const DEFAULT_RADIUS_KM = 5;
const DEFAULT_DELAY_MS = 3000;
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    parkType: 'all',
    limit: null,
    skip: 0,
    parkId: null,
    radiusKm: DEFAULT_RADIUS_KM,
    delayMs: DEFAULT_DELAY_MS,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--park-type':
        options.parkType = args[++i];
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--skip':
        options.skip = parseInt(args[++i], 10);
        break;
      case '--park-id':
        options.parkId = args[++i];
        break;
      case '--radius':
        options.radiusKm = parseFloat(args[++i]);
        break;
      case '--delay':
        options.delayMs = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Trail Import Script

Usage: pnpm run import:trails [options]

Options:
  --park-type <type>   Filter parks by type: nps, wikidata, local, all (default: all)
  --limit <n>          Limit number of parks to process (default: all)
  --skip <n>           Skip first n parks (for resuming interrupted imports)
  --park-id <id>       Import trails for a specific park ID only
  --radius <km>        Search radius around park center in km (default: 5)
  --delay <ms>         Delay between parks in ms (default: 3000)
  --dry-run            Don't insert into database, just log what would be done
  --help               Show this help message

Examples:
  pnpm run import:trails -- --park-type=nps --limit=10
  pnpm run import:trails -- --park-id=abc123-def456
  pnpm run import:trails -- --skip=50 --limit=50
        `);
        process.exit(0);
    }
  }

  return options;
};

/**
 * Validates required environment variables
 */
const validateEnv = () => {
  const missing = [];

  if (!SUPABASE_URL) {
    missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

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
 * Logs an import event to the database
 */
const logImport = async (supabase, status, metadata = {}) => {
  const { error } = await supabase.from('import_logs').insert({
    source: 'trails',
    status,
    ...metadata,
  });

  if (error) {
    console.warn('⚠️  Failed to log import:', error.message);
  }
};

/**
 * Fetch parks from the database based on type filter
 *
 * @param {Object} supabase - Supabase client
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of parks with coordinates
 */
const fetchParks = async (supabase, options) => {
  const { parkType, limit, skip, parkId } = options;

  // If specific park ID is provided, fetch just that park
  if (parkId) {
    console.log(`\n📍 Fetching specific park: ${parkId}...`);
    
    const { data, error } = await supabase
      .from('all_parks')
      .select('id, park_code, full_name, latitude, longitude, source')
      .eq('id', parkId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch park ${parkId}: ${error.message}`);
    }

    if (!data.latitude || !data.longitude) {
      throw new Error(`Park ${parkId} has no coordinates`);
    }

    console.log(`✅ Found park: ${data.full_name}`);
    return [data];
  }

  console.log(`\n📍 Fetching parks (type: ${parkType})...`);

  let query = supabase
    .from('all_parks')
    .select('id, park_code, full_name, latitude, longitude, source')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('full_name', { ascending: true });

  // Filter by source type
  if (parkType !== 'all') {
    query = query.eq('source', parkType);
  }

  // Apply range for skip/limit
  if (skip > 0 || limit) {
    const start = skip || 0;
    const end = limit ? start + limit - 1 : start + 999999;
    query = query.range(start, end);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch parks: ${error.message}`);
  }

  console.log(`✅ Found ${data.length} parks with coordinates`);
  if (skip > 0) {
    console.log(`   (skipped first ${skip} parks)`);
  }
  return data;
};

/**
 * Fetch trails for a single park with retry logic
 *
 * @param {Object} park - Park object with coordinates
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Promise<{trails: Array, success: boolean}>} Array of normalized trail objects and success status
 */
const fetchTrailsForPark = async (park, radiusKm) => {
  const { latitude, longitude } = park;

  // Calculate bounding box
  const bbox = calculateBbox(parseFloat(latitude), parseFloat(longitude), radiusKm);

  let lastError = null;

  // Retry up to MAX_RETRIES times
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Fetch trails from Overpass API
      const elements = await fetchTrailsInBbox(bbox);

      if (elements.length === 0) {
        return { trails: [], success: true };
      }

      // Transform OSM elements to normalized trail objects
      const trails = transformOsmElements(elements, extractCoordinates);

      return { trails, success: true };
    } catch (error) {
      lastError = error;
      console.warn(`   ⚠️  Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);

      if (attempt < MAX_RETRIES) {
        console.log(`   ⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  // All retries failed
  console.error(`   ❌ All ${MAX_RETRIES} attempts failed for ${park.full_name}. Skipping.`);
  return { trails: [], success: false, error: lastError?.message };
};

/**
 * Upsert trails into the database
 *
 * @param {Object} supabase - Supabase client
 * @param {Array} trails - Array of trail objects ready for database
 * @returns {Promise<Object>} Results with counts
 */
const upsertTrails = async (supabase, trails) => {
  const results = {
    inserted: 0,
    updated: 0,
    errors: [],
  };

  // Process in batches
  for (let i = 0; i < trails.length; i += BATCH_SIZE) {
    const batch = trails.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('trails')
      .upsert(batch, {
        onConflict: 'source,source_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      results.errors.push({ batch: Math.floor(i / BATCH_SIZE), error: error.message });
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
    } else {
      results.inserted += data?.length ?? 0;
    }
  }

  return results;
};

/**
 * Main import function
 */
const main = async () => {
  console.log('🥾 Trail Data Import Script');
  console.log('='.repeat(50));

  // Parse arguments
  const options = parseArgs();
  console.log('Options:', options);

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  // Log import start
  const startTime = new Date();
  await logImport(supabase, 'started', { started_at: startTime.toISOString() });

  try {
    // Fetch parks
    const parks = await fetchParks(supabase, options);

    if (parks.length === 0) {
      console.log('⚠️  No parks found to process');
      return;
    }

    // Track all trails and stats
    const allTrails = [];
    let parksProcessed = 0;
    let parksWithTrails = 0;
    let parksSkipped = 0;

    // Process each park
    for (const park of parks) {
      parksProcessed++;
      const parkNum = options.skip + parksProcessed;
      console.log(`\n🔍 [${parkNum}] Processing: ${park.full_name}`);

      // Fetch trails for this park (includes retry logic)
      const result = await fetchTrailsForPark(park, options.radiusKm);

      if (!result.success) {
        // All retries failed, skip this park
        parksSkipped++;
      } else if (result.trails.length > 0) {
        parksWithTrails++;
        console.log(`   ✅ Found ${result.trails.length} trails`);

        // Prepare trails for database with park association
        const preparedTrails = result.trails.map((trail) =>
          prepareForDatabase(trail, {
            parkId: park.id,
            parkSource: park.source,
          })
        );

        allTrails.push(...preparedTrails);
      } else {
        console.log(`   ⚪ No trails found`);
      }

      // Delay between parks to avoid overwhelming the Overpass API
      if (parksProcessed < parks.length) {
        console.log(`   ⏳ Waiting ${options.delayMs / 1000}s before next park...`);
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    }

    console.log('\n');

    // Deduplicate trails (same trail may appear in multiple park searches)
    const uniqueTrails = deduplicateTrails(allTrails);
    console.log(`📊 Found ${allTrails.length} trails, ${uniqueTrails.length} unique`);

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN - Would insert the following trails:');
      uniqueTrails.slice(0, 10).forEach((trail) => {
        console.log(`   - ${trail.name || trail.slug} (${trail.difficulty}, ${trail.length_meters}m)`);
      });
      if (uniqueTrails.length > 10) {
        console.log(`   ... and ${uniqueTrails.length - 10} more`);
      }
    } else {
      // Insert trails into database
      console.log('\n💾 Upserting trails into database...');
      const results = await upsertTrails(supabase, uniqueTrails);

      // Log import completion
      const endTime = new Date();
      await logImport(supabase, 'completed', {
        records_fetched: allTrails.length,
        records_inserted: results.inserted,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        metadata: {
          duration_ms: endTime - startTime,
          parks_processed: parksProcessed,
          parks_with_trails: parksWithTrails,
          parks_skipped: parksSkipped,
          unique_trails: uniqueTrails.length,
          errors: results.errors,
        },
      });

      // Print summary
      console.log(`\n${'='.repeat(50)}`);
      console.log('📊 Import Summary:');
      console.log(`   - Parks processed: ${parksProcessed}`);
      console.log(`   - Parks with trails: ${parksWithTrails}`);
      console.log(`   - Parks skipped (failed after ${MAX_RETRIES} retries): ${parksSkipped}`);
      console.log(`   - Total trails found: ${allTrails.length}`);
      console.log(`   - Unique trails: ${uniqueTrails.length}`);
      console.log(`   - Trails upserted: ${results.inserted}`);
      console.log(`   - Errors: ${results.errors.length}`);
      console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
      console.log('='.repeat(50));

      if (results.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        results.errors.forEach((e) => console.log(`   - Batch ${e.batch}: ${e.error}`));
      }
    }

    console.log('\n✅ Trail import completed successfully!');
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