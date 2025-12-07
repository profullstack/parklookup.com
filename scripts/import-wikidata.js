#!/usr/bin/env node

/**
 * Wikidata Data Import Script
 *
 * This script fetches all U.S. National Parks from Wikidata SPARQL endpoint
 * and imports them into the Supabase database.
 *
 * Usage:
 *   node scripts/import-wikidata.js
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { fetchAllWikidataParks } from '../lib/api/wikidata.js';
import { loadEnv } from './lib/load-env.js';

// Load environment variables from .env file
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    source: 'wikidata',
    status,
    ...metadata,
  });

  if (error) {
    console.warn('⚠️  Failed to log import:', error.message);
  }
};

/**
 * Deduplicates parks by wikidata_id, keeping the first occurrence with the most data
 * @param {Array} parks - Array of park objects
 * @returns {Array} Deduplicated array of parks
 */
const deduplicateParks = (parks) => {
  const parkMap = new Map();

  for (const park of parks) {
    if (!park.wikidata_id) continue;

    const existing = parkMap.get(park.wikidata_id);
    if (!existing) {
      parkMap.set(park.wikidata_id, park);
    } else {
      // Merge data, preferring non-null values
      const merged = { ...existing };
      for (const [key, value] of Object.entries(park)) {
        if (value !== null && value !== undefined && merged[key] === null) {
          merged[key] = value;
        }
      }
      parkMap.set(park.wikidata_id, merged);
    }
  }

  return Array.from(parkMap.values());
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

  // Deduplicate parks before upserting
  const uniqueParks = deduplicateParks(parks);
  console.log(`   Deduplicated ${parks.length} parks to ${uniqueParks.length} unique parks`);

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < uniqueParks.length; i += batchSize) {
    const batch = uniqueParks.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('wikidata_parks')
      .upsert(
        batch.map((park) => ({
          wikidata_id: park.wikidata_id,
          label: park.label,
          state: park.state,
          latitude: park.latitude,
          longitude: park.longitude,
          image_url: park.image_url,
          website: park.website,
          area: park.area,
          area_unit: park.area_unit,
          elevation: park.elevation,
          elevation_unit: park.elevation_unit,
          inception: park.inception,
          managing_org: park.managing_org,
          commons_category: park.commons_category,
        })),
        { onConflict: 'wikidata_id' }
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
  console.log('🌐 Wikidata Data Import Script');
  console.log('='.repeat(50));

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  // Log import start
  const startTime = new Date();
  await logImport(supabase, 'started', { started_at: startTime.toISOString() });

  try {
    // Fetch all parks from Wikidata
    console.log('\n📡 Fetching parks from Wikidata SPARQL endpoint...');
    const parks = await fetchAllWikidataParks({
      onProgress: ({ fetched, offset }) => {
        process.stdout.write(`\r   Progress: ${fetched} parks fetched (offset: ${offset})`);
      },
    });
    console.log(`\n✅ Fetched ${parks.length} parks from Wikidata`);

    // Upsert parks into database
    console.log('\n💾 Upserting parks into database...');
    const results = await upsertParks(supabase, parks);

    // Log import completion
    const endTime = new Date();
    await logImport(supabase, 'completed', {
      records_fetched: parks.length,
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
    console.log(`   - Parks fetched: ${parks.length}`);
    console.log(`   - Parks upserted: ${results.inserted}`);
    console.log(`   - Errors: ${results.errors.length}`);
    console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log('='.repeat(50));

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach((e) => console.log(`   - Batch ${e.batch}: ${e.error}`));
    }

    console.log('\n✅ Wikidata import completed successfully!');
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