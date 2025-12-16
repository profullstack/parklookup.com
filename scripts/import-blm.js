#!/usr/bin/env node

/**
 * BLM Land Data Import Script
 *
 * This script imports BLM (Bureau of Land Management) land boundaries
 * from a GeoJSON file into the Supabase database.
 *
 * Data Source: USGS National Map - Surface Management Agency (SMA) dataset
 * Download from: https://apps.nationalmap.gov/downloader/
 *
 * Pre-processing with GDAL:
 *   ogr2ogr -f GeoJSON -where "ADMIN_AGENCY = 'Bureau of Land Management'" \
 *     data/blm/blm.geojson SMA_National.gpkg
 *
 * Usage:
 *   pnpm run import:blm [options]
 *
 * Options:
 *   --file <path>      Path to GeoJSON file (default: data/blm/blm.geojson)
 *   --state <abbr>     Filter by state abbreviation (e.g., CA, NV, UT)
 *   --limit <n>        Limit number of records to import
 *   --skip <n>         Skip first n records (for resuming interrupted imports)
 *   --dry-run          Don't insert into database, just log what would be done
 *   --truncate         Truncate table before import (full refresh)
 *   --batch-size <n>   Number of records per batch (default: 50)
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createReadStream, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/load-env.js';
import {
  transformFeature,
  prepareForDatabase,
  deduplicateBLMLands,
  isBLMManaged,
} from '../lib/api/blm.js';

// Load environment variables from .env file
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY } = process.env;

// Default configuration
const DEFAULT_FILE_PATH = 'data/blm/blm.geojson';
const DEFAULT_BATCH_SIZE = 50;

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    filePath: DEFAULT_FILE_PATH,
    stateFilter: null,
    limit: null,
    skip: 0,
    dryRun: false,
    truncate: false,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Handle --key=value format
    if (arg.includes('=')) {
      const [key, value] = arg.split('=');
      switch (key) {
        case '--file':
          options.filePath = value;
          continue;
        case '--state':
          options.stateFilter = value?.toUpperCase();
          continue;
        case '--limit':
          options.limit = parseInt(value, 10);
          continue;
        case '--skip':
          options.skip = parseInt(value, 10);
          continue;
        case '--batch-size':
          options.batchSize = parseInt(value, 10);
          continue;
      }
    }
    
    // Handle --key value format
    switch (arg) {
      case '--file':
        options.filePath = args[++i];
        break;
      case '--state':
        options.stateFilter = args[++i]?.toUpperCase();
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--skip':
        options.skip = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--truncate':
        options.truncate = true;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`
BLM Land Import Script

Usage: pnpm run import:blm [options]

Options:
  --file <path>      Path to GeoJSON file (default: data/blm/blm.geojson)
  --state <abbr>     Filter by state abbreviation (e.g., CA, NV, UT)
  --limit <n>        Limit number of records to import
  --skip <n>         Skip first n records (for resuming interrupted imports)
  --dry-run          Don't insert into database, just log what would be done
  --truncate         Truncate table before import (full refresh)
  --batch-size <n>   Number of records per batch (default: 50)
  --help             Show this help message

Data Preparation:
  1. Download SMA dataset from USGS National Map:
     https://apps.nationalmap.gov/downloader/
  
  2. Convert to GeoJSON with GDAL (filter BLM only):
     ogr2ogr -f GeoJSON -where "ADMIN_AGENCY = 'Bureau of Land Management'" \\
       data/blm/blm.geojson SMA_National.gpkg

Examples:
  pnpm run import:blm
  pnpm run import:blm -- --state=CA --limit=100
  pnpm run import:blm -- --truncate --file=./my-blm-data.geojson
  pnpm run import:blm -- --skip=500 --limit=500
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
  try {
    const { error } = await supabase.from('import_logs').insert({
      source: 'blm',
      status,
      ...metadata,
    });

    if (error) {
      console.warn('⚠️  Failed to log import:', error.message);
    }
  } catch (err) {
    console.warn('⚠️  Failed to log import:', err.message);
  }
};

/**
 * Load and parse GeoJSON file
 *
 * @param {string} filePath - Path to GeoJSON file
 * @returns {Promise<Object>} Parsed GeoJSON object
 */
const loadGeoJSON = async (filePath) => {
  console.log(`\n📂 Loading GeoJSON from: ${filePath}`);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  const geojson = JSON.parse(content);

  if (!geojson.features || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON: missing features array');
  }

  console.log(`✅ Loaded ${geojson.features.length} features`);
  return geojson;
};

/**
 * Filter features based on options
 *
 * @param {Array} features - GeoJSON features
 * @param {Object} options - Filter options
 * @returns {Array} Filtered features
 */
const filterFeatures = (features, options) => {
  const { stateFilter, limit, skip } = options;

  let filtered = features;

  // Filter by BLM agency (in case the file wasn't pre-filtered)
  const blmFeatures = filtered.filter((f) => isBLMManaged(f.properties));
  if (blmFeatures.length < filtered.length) {
    console.log(`   Filtered to ${blmFeatures.length} BLM-managed features`);
    filtered = blmFeatures;
  }

  // Filter by state if specified
  if (stateFilter) {
    const beforeCount = filtered.length;
    filtered = filtered.filter((f) => {
      const state =
        f.properties?.STATE_ABBR ||
        f.properties?.STATE ||
        f.properties?.STATEABBR ||
        '';
      return state.toUpperCase() === stateFilter;
    });
    console.log(`   Filtered to ${filtered.length} features in ${stateFilter} (from ${beforeCount})`);
  }

  // Apply skip
  if (skip > 0) {
    filtered = filtered.slice(skip);
    console.log(`   Skipped first ${skip} features, ${filtered.length} remaining`);
  }

  // Apply limit
  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
    console.log(`   Limited to ${filtered.length} features`);
  }

  return filtered;
};

/**
 * Transform features to database records
 *
 * @param {Array} features - GeoJSON features
 * @returns {Array} Database-ready records
 */
const transformFeatures = (features) => {
  const records = [];
  let skipped = 0;

  for (const feature of features) {
    try {
      const transformed = transformFeature(feature);
      if (transformed) {
        records.push(prepareForDatabase(transformed));
      } else {
        skipped++;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to transform feature: ${error.message}`);
      skipped++;
    }
  }

  if (skipped > 0) {
    console.log(`   ⚠️  Skipped ${skipped} features due to transformation errors`);
  }

  return records;
};

/**
 * Truncate the blm_lands table
 *
 * @param {Object} supabase - Supabase client
 */
const truncateTable = async (supabase) => {
  console.log('\n🗑️  Truncating blm_lands table...');

  const { error } = await supabase.rpc('truncate_blm_lands');

  if (error) {
    // If RPC doesn't exist, try direct delete
    const { error: deleteError } = await supabase
      .from('blm_lands')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      throw new Error(`Failed to truncate table: ${deleteError.message}`);
    }
  }

  console.log('✅ Table truncated');
};

/**
 * Insert BLM lands into the database
 *
 * @param {Object} supabase - Supabase client
 * @param {Array} records - Array of BLM land records
 * @param {number} batchSize - Records per batch
 * @returns {Promise<Object>} Results with counts
 */
const insertBLMLands = async (supabase, records, batchSize) => {
  const results = {
    inserted: 0,
    errors: [],
  };

  const totalBatches = Math.ceil(records.length / batchSize);

  // Process in batches using simple insert
  // For BLM data, we recommend using --truncate for full refreshes
  // since the data is updated infrequently
  for (let i = 0; i < records.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = records.slice(i, i + batchSize);

    process.stdout.write(`\r   Processing batch ${batchNum}/${totalBatches}...`);

    try {
      const { data, error } = await supabase
        .from('blm_lands')
        .insert(batch)
        .select('id');

      if (error) {
        results.errors.push({ batch: batchNum, error: error.message });
        console.error(`\n❌ Batch ${batchNum} failed: ${error.message}`);
      } else {
        results.inserted += data?.length ?? 0;
      }
    } catch (error) {
      results.errors.push({ batch: batchNum, error: error.message });
      console.error(`\n❌ Batch ${batchNum} failed: ${error.message}`);
    }
  }

  console.log(''); // New line after progress

  return results;
};

/**
 * Main import function
 */
const main = async () => {
  console.log('🏜️  BLM Land Data Import Script');
  console.log('='.repeat(50));

  // Parse arguments
  const options = parseArgs();
  console.log('Options:', {
    ...options,
    filePath: options.filePath,
  });

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  // Log import start
  const startTime = new Date();
  await logImport(supabase, 'started', { started_at: startTime.toISOString() });

  try {
    // Load GeoJSON file
    const geojson = await loadGeoJSON(options.filePath);

    // Filter features
    console.log('\n🔍 Filtering features...');
    const filteredFeatures = filterFeatures(geojson.features, options);

    if (filteredFeatures.length === 0) {
      console.log('⚠️  No features to import after filtering');
      return;
    }

    // Transform features
    console.log('\n🔄 Transforming features...');
    const records = transformFeatures(filteredFeatures);

    // Deduplicate
    const uniqueRecords = deduplicateBLMLands(records);
    console.log(`   ${records.length} records, ${uniqueRecords.length} unique`);

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN - Would insert the following records:');
      uniqueRecords.slice(0, 10).forEach((record) => {
        console.log(`   - ${record.unit_name || 'Unnamed'} (${record.state || 'Unknown state'}, ${record.area_acres?.toLocaleString() || '?'} acres)`);
      });
      if (uniqueRecords.length > 10) {
        console.log(`   ... and ${uniqueRecords.length - 10} more`);
      }
      return;
    }

    // Truncate if requested (recommended for BLM data since it's updated infrequently)
    if (options.truncate) {
      await truncateTable(supabase);
    } else {
      console.log('⚠️  Warning: Running without --truncate may cause duplicate key errors.');
      console.log('   For BLM data, it is recommended to use --truncate for full refreshes.');
    }

    // Insert records (always use simple insert - BLM data is updated infrequently)
    console.log(`\n💾 Inserting BLM lands into database...`);
    const results = await insertBLMLands(supabase, uniqueRecords, options.batchSize);

    // Log import completion
    const endTime = new Date();
    await logImport(supabase, 'completed', {
      records_fetched: filteredFeatures.length,
      records_inserted: results.inserted,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      metadata: {
        duration_ms: endTime - startTime,
        unique_records: uniqueRecords.length,
        state_filter: options.stateFilter,
        errors: results.errors,
      },
    });

    // Print summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 Import Summary:');
    console.log(`   - Features loaded: ${geojson.features.length}`);
    console.log(`   - Features filtered: ${filteredFeatures.length}`);
    console.log(`   - Records transformed: ${records.length}`);
    console.log(`   - Unique records: ${uniqueRecords.length}`);
    console.log(`   - Records inserted: ${results.inserted}`);
    console.log(`   - Errors: ${results.errors.length}`);
    console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log('='.repeat(50));

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach((e) => console.log(`   - Batch ${e.batch}: ${e.error}`));
    }

    console.log('\n✅ BLM land import completed successfully!');
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