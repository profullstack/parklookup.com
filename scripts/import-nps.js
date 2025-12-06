#!/usr/bin/env node

/**
 * NPS Data Import Script
 *
 * This script fetches all parks from the National Park Service API
 * and imports them into the Supabase database.
 *
 * Usage:
 *   node scripts/import-nps.js
 *
 * Environment variables required:
 *   - NPS_API_KEY: Your NPS API key
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { fetchAllParks, transformParkData } from '../lib/api/nps.js';
import { loadEnv } from './lib/load-env.js';

// Load environment variables from .env file
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NPS_API_KEY = process.env.NPS_API_KEY;

/**
 * Validates required environment variables
 */
const validateEnv = () => {
  const missing = [];

  if (!SUPABASE_URL) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!NPS_API_KEY) missing.push('NPS_API_KEY');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
};

/**
 * Creates a Supabase client with service role key
 */
const createSupabaseClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * Logs an import event to the database
 */
const logImport = async (supabase, status, metadata = {}) => {
  const { error } = await supabase.from('import_logs').insert({
    source: 'nps',
    status,
    ...metadata,
  });

  if (error) {
    console.warn('⚠️  Failed to log import:', error.message);
  }
};

/**
 * Upserts parks into the database
 */
const upsertParks = async (supabase, parks) => {
  const results = {
    inserted: 0,
    updated: 0,
    errors: [],
  };

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < parks.length; i += batchSize) {
    const batch = parks.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('nps_parks')
      .upsert(
        batch.map((park) => ({
          park_code: park.park_code,
          full_name: park.full_name,
          description: park.description,
          states: park.states,
          latitude: park.latitude,
          longitude: park.longitude,
          designation: park.designation,
          url: park.url,
          weather_info: park.weather_info,
          images: park.images,
          activities: park.activities,
          topics: park.topics,
          contacts: park.contacts,
          entrance_fees: park.entrance_fees,
          operating_hours: park.operating_hours,
          addresses: park.addresses,
        })),
        { onConflict: 'park_code' }
      )
      .select('id');

    if (error) {
      results.errors.push({ batch: i / batchSize, error: error.message });
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
    } else {
      results.inserted += data?.length ?? 0;
      console.log(`✅ Batch ${i / batchSize + 1}: ${data?.length ?? 0} parks upserted`);
    }
  }

  return results;
};

/**
 * Main import function
 */
const main = async () => {
  console.log('🏞️  NPS Data Import Script');
  console.log('='.repeat(50));

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  // Log import start
  const startTime = new Date();
  await logImport(supabase, 'started', { started_at: startTime.toISOString() });

  try {
    // Fetch all parks from NPS API
    console.log('\n📡 Fetching parks from NPS API...');
    const rawParks = await fetchAllParks({
      onProgress: ({ fetched, total, percentage }) => {
        process.stdout.write(`\r   Progress: ${fetched}/${total} (${percentage}%)`);
      },
    });
    console.log(`\n✅ Fetched ${rawParks.length} parks from NPS API`);

    // Transform parks
    console.log('\n🔄 Transforming park data...');
    const parks = rawParks.map(transformParkData);
    console.log(`✅ Transformed ${parks.length} parks`);

    // Upsert parks into database
    console.log('\n💾 Upserting parks into database...');
    const results = await upsertParks(supabase, parks);

    // Log import completion
    const endTime = new Date();
    await logImport(supabase, 'completed', {
      records_fetched: rawParks.length,
      records_inserted: results.inserted,
      records_updated: results.updated,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      metadata: {
        duration_ms: endTime - startTime,
        errors: results.errors,
      },
    });

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary:');
    console.log(`   - Parks fetched: ${rawParks.length}`);
    console.log(`   - Parks upserted: ${results.inserted}`);
    console.log(`   - Errors: ${results.errors.length}`);
    console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log('='.repeat(50));

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach((e) => console.log(`   - Batch ${e.batch}: ${e.error}`));
    }

    console.log('\n✅ NPS import completed successfully!');
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