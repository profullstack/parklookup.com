#!/usr/bin/env node

/**
 * Backfill Place Images Script
 *
 * This script fetches images for nearby places that don't have thumbnails
 * using the ValueSERP images search API.
 *
 * Usage:
 *   node scripts/backfill-place-images.js [options]
 *
 * Options:
 *   --limit <n>          Limit number of places to process
 *   --offset <n>         Skip first N places (for resuming)
 *   --concurrency <n>    Number of places to process in parallel (default: 3)
 *   --dry-run            Don't save to database, just show what would be done
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

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search for an image using ValueSERP API
 */
async function searchImage(placeName, address) {
  const query = address ? `${placeName} ${address}` : placeName;

  const params = new URLSearchParams({
    api_key: valueserpApiKey,
    search_type: 'images',
    q: query,
    num: '1',
  });

  const url = `${VALUESERP_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ValueSERP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.image_results && data.image_results.length > 0) {
    return data.image_results[0].image;
  }

  return null;
}

/**
 * Update place with thumbnail
 */
async function updatePlaceThumbnail(placeId, thumbnail, dryRun) {
  if (dryRun) {
    return true;
  }

  const { error } = await supabase
    .from('nearby_places')
    .update({ thumbnail })
    .eq('id', placeId);

  if (error) {
    console.error(`    Error updating place ${placeId}:`, error.message);
    return false;
  }

  return true;
}

/**
 * Process places in batches
 */
async function processPlacesInBatches(places, options) {
  const { concurrency = 3, dryRun } = options;

  const totals = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Process in batches
  for (let i = 0; i < places.length; i += concurrency) {
    const batch = places.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(places.length / concurrency);

    console.log(`\n[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} places...`);

    const batchPromises = batch.map(async (place, idx) => {
      const placeNum = i + idx + 1;

      try {
        console.log(`  [${placeNum}/${places.length}] ${place.title}`);

        const imageUrl = await searchImage(place.title, place.address);

        if (imageUrl) {
          const success = await updatePlaceThumbnail(place.id, imageUrl, dryRun);
          if (success) {
            console.log(`    ✓ Found image: ${imageUrl.substring(0, 60)}...`);
            return { success: 1, failed: 0, skipped: 0 };
          } else {
            return { success: 0, failed: 1, skipped: 0 };
          }
        } else {
          console.log(`    ⚠ No image found`);
          return { success: 0, failed: 0, skipped: 1 };
        }
      } catch (err) {
        console.error(`    ✗ Error: ${err.message}`);
        return { success: 0, failed: 1, skipped: 0 };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      totals.success += result.success;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    }

    // Delay between batches to avoid rate limiting
    if (i + concurrency < places.length) {
      await sleep(1000);
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
  let limit = null;
  let offset = 0;
  let dryRun = false;
  let concurrency = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--offset' && args[i + 1]) {
      offset = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Backfill Place Images Script

Usage: node scripts/backfill-place-images.js [options]

Options:
  --limit <n>          Limit number of places to process
  --offset <n>         Skip first N places (for resuming)
  --concurrency <n>    Number of places to process in parallel (default: 3)
  --dry-run            Don't save to database, just show what would be done
  --help, -h           Show this help message

Examples:
  # Backfill images for first 100 places
  node scripts/backfill-place-images.js --limit 100

  # Resume from place 500
  node scripts/backfill-place-images.js --offset 500 --limit 100

  # Dry run to see what would be done
  node scripts/backfill-place-images.js --limit 10 --dry-run
`);
      process.exit(0);
    }
  }

  console.log('='.repeat(60));
  console.log('Backfill Place Images Script');
  console.log('='.repeat(60));
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Offset: ${offset}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('='.repeat(60));

  // Build query for places without thumbnails
  let query = supabase
    .from('nearby_places')
    .select('id, title, address')
    .is('thumbnail', null)
    .order('id');

  // Apply offset and limit
  if (offset > 0) {
    query = query.range(offset, offset + (limit || 1000) - 1);
  } else if (limit) {
    query = query.limit(limit);
  }

  const { data: places, error } = await query;

  if (error) {
    console.error('Error fetching places:', error.message);
    process.exit(1);
  }

  console.log(`\nFound ${places.length} places without images`);

  if (places.length === 0) {
    console.log('No places to process!');
    process.exit(0);
  }

  const startTime = Date.now();

  const totals = await processPlacesInBatches(places, {
    concurrency,
    dryRun,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Images added: ${totals.success}`);
  console.log(`Failed: ${totals.failed}`);
  console.log(`No image found: ${totals.skipped}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log(`Places per second: ${(places.length / (elapsed || 1)).toFixed(2)}`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes were made to the database');
  }
}

main().catch(console.error);