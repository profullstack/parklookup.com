#!/usr/bin/env node

/**
 * Park Linking Script
 *
 * This script links NPS parks to their Wikidata counterparts
 * using name and location similarity matching.
 *
 * Usage:
 *   node scripts/link-parks.js
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { linkParks, saveParkLinks } from '../lib/utils/park-linker.js';

// Load environment variables
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
 * Fetches all NPS parks from the database
 */
const fetchNpsParks = async (supabase) => {
  const { data, error } = await supabase
    .from('nps_parks')
    .select('id, park_code, full_name, latitude, longitude')
    .order('full_name');

  if (error) {
    throw new Error(`Failed to fetch NPS parks: ${error.message}`);
  }

  return data ?? [];
};

/**
 * Fetches all Wikidata parks from the database
 */
const fetchWikidataParks = async (supabase) => {
  const { data, error } = await supabase
    .from('wikidata_parks')
    .select('id, wikidata_id, label, latitude, longitude')
    .order('label');

  if (error) {
    throw new Error(`Failed to fetch Wikidata parks: ${error.message}`);
  }

  return data ?? [];
};

/**
 * Main linking function
 */
const main = async () => {
  console.log('🔗 Park Linking Script');
  console.log('='.repeat(50));

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  try {
    // Fetch parks from database
    console.log('\n📡 Fetching parks from database...');

    const [npsParks, wikidataParks] = await Promise.all([
      fetchNpsParks(supabase),
      fetchWikidataParks(supabase),
    ]);

    console.log(`   - NPS parks: ${npsParks.length}`);
    console.log(`   - Wikidata parks: ${wikidataParks.length}`);

    if (npsParks.length === 0 || wikidataParks.length === 0) {
      console.log('\n⚠️  No parks to link. Run import scripts first.');
      process.exit(0);
    }

    // Link parks
    console.log('\n🔄 Linking parks...');
    const startTime = Date.now();

    const links = linkParks(npsParks, wikidataParks, {
      threshold: 0.6,
      onProgress: ({ current, total, matched, currentPark }) => {
        process.stdout.write(
          `\r   Progress: ${current}/${total} (${matched} matched) - ${currentPark.substring(0, 30)}...`
        );
      },
    });

    console.log(`\n✅ Found ${links.length} matches`);

    // Save links to database
    console.log('\n💾 Saving links to database...');
    const result = await saveParkLinks(supabase, links);

    const endTime = Date.now();

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Linking Summary:');
    console.log(`   - NPS parks processed: ${npsParks.length}`);
    console.log(`   - Wikidata parks available: ${wikidataParks.length}`);
    console.log(`   - Links created: ${result.inserted}`);
    console.log(`   - Match rate: ${((links.length / npsParks.length) * 100).toFixed(1)}%`);
    console.log(`   - Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log('='.repeat(50));

    // Show some example matches
    if (links.length > 0) {
      console.log('\n📋 Sample matches:');
      const samples = links.slice(0, 5);
      for (const link of samples) {
        const npsPark = npsParks.find((p) => p.id === link.nps_park_id);
        const wikiPark = wikidataParks.find((p) => p.id === link.wikidata_park_id);
        console.log(`   - "${npsPark?.full_name}" ↔ "${wikiPark?.label}"`);
        console.log(`     Score: ${(link.confidence_score * 100).toFixed(1)}%`);
      }
    }

    // Show unmatched parks
    const unmatchedNps = npsParks.filter((np) => !links.some((l) => l.nps_park_id === np.id));

    if (unmatchedNps.length > 0) {
      console.log(`\n⚠️  ${unmatchedNps.length} NPS parks without Wikidata match:`);
      unmatchedNps.slice(0, 10).forEach((p) => console.log(`   - ${p.full_name}`));
      if (unmatchedNps.length > 10) {
        console.log(`   ... and ${unmatchedNps.length - 10} more`);
      }
    }

    console.log('\n✅ Park linking completed successfully!');
  } catch (error) {
    console.error('\n❌ Linking failed:', error.message);
    process.exit(1);
  }
};

// Run the script
main();