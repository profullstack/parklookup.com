#!/usr/bin/env node

/**
 * Geocode Parks Script
 *
 * This script uses the HERE API to geocode all parks and store
 * the physical addresses in the database.
 *
 * Usage:
 *   node scripts/geocode-parks.js [--table nps|wikidata|all] [--limit N] [--dry-run]
 *
 * Options:
 *   --table    Which table to geocode (default: all)
 *   --limit    Maximum number of parks to geocode (default: all)
 *   --dry-run  Don't save to database, just show what would be done
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
const hereApiKey = env.HERE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!hereApiKey) {
  console.error('Missing HERE_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const HERE_REVERSE_GEOCODE_URL = 'https://revgeocode.search.hereapi.com/v1/revgeocode';

/**
 * Reverse geocode coordinates to address using HERE API
 */
async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    at: `${lat},${lng}`,
    lang: 'en-US',
    apiKey: hereApiKey,
  });

  const url = `${HERE_REVERSE_GEOCODE_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HERE API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const item = data.items[0];
  const address = item.address || {};

  // Return the label which is the most complete address
  return address.label || null;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geocode parks from a specific table
 */
async function geocodeTable(tableName, options = {}) {
  const { limit, dryRun } = options;

  console.log(`\nGeocoding ${tableName}...`);

  // Build query for parks without physical_address
  let query = supabase
    .from(tableName)
    .select('id, latitude, longitude, physical_address')
    .is('physical_address', null)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (limit) {
    query = query.limit(limit);
  }

  const { data: parks, error } = await query;

  if (error) {
    console.error(`Error fetching ${tableName}:`, error.message);
    return { success: 0, failed: 0, skipped: 0 };
  }

  console.log(`Found ${parks.length} parks to geocode`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < parks.length; i++) {
    const park = parks[i];

    // Skip if already has address
    if (park.physical_address) {
      skipped++;
      continue;
    }

    try {
      const address = await reverseGeocode(park.latitude, park.longitude);

      if (address) {
        if (dryRun) {
          console.log(`[DRY RUN] Would update ${park.id}: ${address}`);
        } else {
          const { error: updateError } = await supabase
            .from(tableName)
            .update({ physical_address: address })
            .eq('id', park.id);

          if (updateError) {
            console.error(`Error updating ${park.id}:`, updateError.message);
            failed++;
          } else {
            success++;
          }
        }

        // Progress indicator
        if ((i + 1) % 10 === 0 || i === parks.length - 1) {
          console.log(`Progress: ${i + 1}/${parks.length} (${success} success, ${failed} failed)`);
        }
      } else {
        console.log(`No address found for ${park.id} (${park.latitude}, ${park.longitude})`);
        failed++;
      }

      // Rate limiting: HERE API allows 5 requests per second on free tier
      // We'll do 3 per second to be safe
      await sleep(350);
    } catch (err) {
      console.error(`Error geocoding ${park.id}:`, err.message);
      failed++;

      // If we hit rate limit, wait longer
      if (err.message.includes('429') || err.message.includes('rate')) {
        console.log('Rate limited, waiting 5 seconds...');
        await sleep(5000);
      }
    }
  }

  return { success, failed, skipped };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let table = 'all';
  let limit = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--table' && args[i + 1]) {
      table = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  console.log('='.repeat(50));
  console.log('Park Geocoding Script');
  console.log('='.repeat(50));
  console.log(`Table: ${table}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('='.repeat(50));

  const results = {
    nps_parks: { success: 0, failed: 0, skipped: 0 },
    wikidata_parks: { success: 0, failed: 0, skipped: 0 },
  };

  if (table === 'all' || table === 'nps') {
    results.nps_parks = await geocodeTable('nps_parks', { limit, dryRun });
  }

  if (table === 'all' || table === 'wikidata') {
    results.wikidata_parks = await geocodeTable('wikidata_parks', { limit, dryRun });
  }

  console.log(`\n${  '='.repeat(50)}`);
  console.log('Summary');
  console.log('='.repeat(50));

  if (table === 'all' || table === 'nps') {
    console.log(`NPS Parks: ${results.nps_parks.success} success, ${results.nps_parks.failed} failed, ${results.nps_parks.skipped} skipped`);
  }

  if (table === 'all' || table === 'wikidata') {
    console.log(`Wikidata Parks: ${results.wikidata_parks.success} success, ${results.wikidata_parks.failed} failed, ${results.wikidata_parks.skipped} skipped`);
  }

  const totalSuccess = results.nps_parks.success + results.wikidata_parks.success;
  const totalFailed = results.nps_parks.failed + results.wikidata_parks.failed;

  console.log(`\nTotal: ${totalSuccess} geocoded, ${totalFailed} failed`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes were made to the database');
  }
}

main().catch(console.error);