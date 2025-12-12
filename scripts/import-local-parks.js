#!/usr/bin/env node

/**
 * Local Parks Import Script
 *
 * This script fetches county and city parks from OpenStreetMap via Overpass API
 * and imports them into Supabase.
 *
 * Usage:
 *   node scripts/import-local-parks.js [options]
 *
 * Options:
 *   --state=XX    Import parks for a specific state (e.g., --state=CA)
 *   --all         Import parks for all states
 *   --limit=N     Limit number of parks per state (for testing)
 *   --dry-run     Show what would be imported without saving
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import {
  fetchParksByState,
  US_STATE_CODES,
} from '../lib/api/padus.js';
import { loadEnv } from './lib/load-env.js';

// Load environment variables
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY } = process.env;

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
 * Fetches state ID from database
 */
const getStateId = async (supabase, stateCode) => {
  const { data, error } = await supabase
    .from('states')
    .select('id')
    .eq('code', stateCode)
    .single();

  if (error) {
    console.warn(`⚠️  State not found: ${stateCode}`);
    return null;
  }

  return data.id;
};

/**
 * Fetches or creates county ID
 */
const getOrCreateCountyId = async (supabase, stateId, countyName) => {
  if (!countyName) return null;

  const slug = countyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  // Try to find existing county
  const { data: existing } = await supabase
    .from('counties')
    .select('id')
    .eq('state_id', stateId)
    .eq('slug', slug)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new county
  const { data: created, error } = await supabase
    .from('counties')
    .insert({
      state_id: stateId,
      name: countyName,
      slug,
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`⚠️  Failed to create county: ${countyName}`, error.message);
    return null;
  }

  return created.id;
};

/**
 * Logs an import event to the database
 */
const logImport = async (supabase, status, metadata = {}) => {
  const { error } = await supabase.from('import_logs').insert({
    source: 'padus_local',
    status,
    ...metadata,
  });

  if (error) {
    console.warn('⚠️  Failed to log import:', error.message);
  }
};

/**
 * Deduplicates parks by slug within a state
 */
const deduplicateParks = (parks) => {
  const parkMap = new Map();

  for (const park of parks) {
    const key = `${park.state_code}-${park.slug}`;

    if (!parkMap.has(key)) {
      parkMap.set(key, park);
    } else {
      // Keep the one with more data
      const existing = parkMap.get(key);
      if (park.latitude && !existing.latitude) {
        parkMap.set(key, park);
      }
    }
  }

  return Array.from(parkMap.values());
};

/**
 * Upserts parks into the database
 */
const upsertParks = async (supabase, parks, stateId, options = {}) => {
  const results = {
    inserted: 0,
    updated: 0,
    errors: [],
  };

  // Deduplicate parks
  const uniqueParks = deduplicateParks(parks);
  console.log(`   Deduplicated ${parks.length} parks to ${uniqueParks.length} unique parks`);

  // Apply limit if specified
  const parksToProcess = options.limit ? uniqueParks.slice(0, options.limit) : uniqueParks;

  if (options.dryRun) {
    console.log(`   [DRY RUN] Would upsert ${parksToProcess.length} parks`);
    return { inserted: parksToProcess.length, updated: 0, errors: [] };
  }

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < parksToProcess.length; i += batchSize) {
    const batch = parksToProcess.slice(i, i + batchSize);

    // Prepare park records
    const records = [];
    for (const park of batch) {
      // Get or create county if managing agency suggests one
      let countyId = null;
      if (park.managing_agency?.toLowerCase().includes('county')) {
        const countyMatch = park.managing_agency.match(/^([^-]+)\s+County/i);
        if (countyMatch) {
          countyId = await getOrCreateCountyId(supabase, stateId, countyMatch[1].trim());
        }
      }

      // Store OSM ID in padus_id field for now (legacy field repurposed)
      // The osm_id column may not be available in all environments
      records.push({
        name: park.name,
        slug: park.slug,
        park_type: park.park_type,
        managing_agency: park.managing_agency,
        state_id: stateId,
        county_id: countyId,
        latitude: park.latitude,
        longitude: park.longitude,
        access: park.access,
        padus_id: park.osm_id, // Store OSM ID in padus_id field
        raw_data: park.raw_data,
      });
    }

    const { data, error } = await supabase
      .from('local_parks')
      .upsert(records, {
        onConflict: 'state_id,slug',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      results.errors.push({ batch: i / batchSize, error: error.message });
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
    } else {
      results.inserted += data?.length ?? 0;
      process.stdout.write(`\r   ✅ Processed ${Math.min(i + batchSize, parksToProcess.length)}/${parksToProcess.length} parks`);
    }
  }

  console.log(''); // New line after progress

  return results;
};

/**
 * Imports parks for a single state
 */
const importStateParks = async (supabase, stateCode, options = {}) => {
  console.log(`\n📍 Importing parks for ${stateCode}...`);

  // Get state ID
  const stateId = await getStateId(supabase, stateCode);
  if (!stateId) {
    return { fetched: 0, inserted: 0, errors: [{ error: `State not found: ${stateCode}` }] };
  }

  // Fetch parks from OpenStreetMap via Overpass API
  console.log('   Fetching from OpenStreetMap (Overpass API)...');
  const parks = await fetchParksByState(stateCode, {
    parkTypes: ['county', 'city', 'local'],
    onProgress: ({ fetched }) => {
      process.stdout.write(`\r   Progress: ${fetched} parks fetched`);
    },
  });

  console.log(`\n   ✅ Fetched ${parks.length} parks from OpenStreetMap`);

  // Upsert parks
  console.log('   Upserting to database...');
  const results = await upsertParks(supabase, parks, stateId, options);

  return {
    fetched: parks.length,
    inserted: results.inserted,
    errors: results.errors,
  };
};

/**
 * Main import function
 */
const main = async () => {
  console.log('🏞️  Local Parks Import Script (OpenStreetMap)');
  console.log('='.repeat(50));

  // Parse arguments
  const options = parseArgs();

  if (!options.state && !options.all) {
    console.log('\nUsage:');
    console.log('  node scripts/import-local-parks.js --state=CA');
    console.log('  node scripts/import-local-parks.js --all');
    console.log('  node scripts/import-local-parks.js --state=CA --limit=100 --dry-run');
    process.exit(0);
  }

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

// Log import start
const startTime = new Date();
try {
  await logImport(supabase, 'started', { started_at: startTime.toISOString() });
} catch (e) {
  // import_logs table may not exist, continue anyway
  console.warn('⚠️  Could not log import start (import_logs table may not exist)');
}

  const totalResults = {
    states: 0,
    fetched: 0,
    inserted: 0,
    errors: [],
  };

  try {
    // Determine which states to import
    const statesToImport = options.all
      ? US_STATE_CODES.slice(0, 50) // Skip territories for now
      : [options.state];

    for (const stateCode of statesToImport) {
      try {
        const results = await importStateParks(supabase, stateCode, options);
        totalResults.states++;
        totalResults.fetched += results.fetched;
        totalResults.inserted += results.inserted;
        totalResults.errors.push(...results.errors);

        // Add delay between states to avoid rate limiting (Overpass API)
        if (options.all && statesToImport.indexOf(stateCode) < statesToImport.length - 1) {
          console.log('   Waiting 5 seconds before next state (Overpass rate limit)...');
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`❌ Failed to import ${stateCode}:`, error.message);
        totalResults.errors.push({ state: stateCode, error: error.message });
      }
    }

    // Log import completion
    const endTime = new Date();
    try {
      await logImport(supabase, 'completed', {
        records_fetched: totalResults.fetched,
        records_inserted: totalResults.inserted,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        metadata: {
          states_processed: totalResults.states,
          duration_ms: endTime - startTime,
          errors: totalResults.errors,
          dry_run: options.dryRun,
        },
      });
    } catch (e) {
      // import_logs table may not exist, continue anyway
    }

    // Print summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 Import Summary:');
    console.log(`   - States processed: ${totalResults.states}`);
    console.log(`   - Parks fetched: ${totalResults.fetched}`);
    console.log(`   - Parks upserted: ${totalResults.inserted}`);
    console.log(`   - Errors: ${totalResults.errors.length}`);
    console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    if (options.dryRun) {
      console.log('   - Mode: DRY RUN (no data saved)');
    }
    console.log('='.repeat(50));

    if (totalResults.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      totalResults.errors.slice(0, 10).forEach((e) => {
        console.log(`   - ${e.state || `Batch ${e.batch}`}: ${e.error}`);
      });
      if (totalResults.errors.length > 10) {
        console.log(`   ... and ${totalResults.errors.length - 10} more errors`);
      }
    }

    console.log('\n✅ Local parks import completed!');
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);

    // Log import failure
    try {
      await logImport(supabase, 'failed', {
        error_message: error.message,
        started_at: startTime.toISOString(),
        completed_at: new Date().toISOString(),
      });
    } catch (e) {
      // import_logs table may not exist, continue anyway
    }

    process.exit(1);
  }
};

// Run the script
main();