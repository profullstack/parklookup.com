#!/usr/bin/env node

/**
 * Link Parks to States Script
 *
 * This script links NPS parks to their corresponding states
 * based on the states field in the NPS data.
 *
 * Usage:
 *   node scripts/link-parks-to-states.js
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/load-env.js';

// Load environment variables from .env file
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const {SUPABASE_SERVICE_ROLE_KEY} = process.env;

/**
 * Validates required environment variables
 */
const validateEnv = () => {
  const missing = [];

  if (!SUPABASE_URL) {missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');}
  if (!SUPABASE_SERVICE_ROLE_KEY) {missing.push('SUPABASE_SERVICE_ROLE_KEY');}

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
};

/**
 * Creates a Supabase client with service role key
 */
const createSupabaseClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

/**
 * Fetches all states from the database
 */
const fetchStates = async (supabase) => {
  const { data, error } = await supabase.from('states').select('id, code, name').order('name');

  if (error) {
    throw new Error(`Failed to fetch states: ${error.message}`);
  }

  return data ?? [];
};

/**
 * Fetches all NPS parks from the database
 */
const fetchNpsParks = async (supabase) => {
  const { data, error } = await supabase
    .from('nps_parks')
    .select('id, park_code, full_name, states')
    .order('full_name');

  if (error) {
    throw new Error(`Failed to fetch NPS parks: ${error.message}`);
  }

  return data ?? [];
};

/**
 * Parses state codes from NPS states field
 * NPS uses comma-separated state codes like "CA,NV" or "CA"
 */
const parseStateCodes = (statesField) => {
  if (!statesField) {return [];}
  return statesField
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length === 2);
};

/**
 * Creates park-state links
 */
const createParkStateLinks = async (supabase, links) => {
  if (links.length === 0) {return { inserted: 0 };}

  // Process in batches
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('nps_park_locations')
      .upsert(batch, { onConflict: 'nps_park_id,state_id' })
      .select('id');

    if (error) {
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return { inserted };
};

/**
 * Updates park counts for states
 */
const updateStateParkCounts = async (supabase) => {
  // Get park counts per state
  const { data: counts, error: countError } = await supabase
    .from('nps_park_locations')
    .select('state_id')
    .then(({ data, error }) => {
      if (error) {return { data: null, error };}

      // Count parks per state
      const stateCounts = {};
      for (const loc of data ?? []) {
        stateCounts[loc.state_id] = (stateCounts[loc.state_id] || 0) + 1;
      }

      return { data: stateCounts, error: null };
    });

  if (countError) {
    console.error('Failed to get park counts:', countError.message);
    return;
  }

  // Update each state's park_count
  for (const [stateId, count] of Object.entries(counts)) {
    await supabase.from('states').update({ park_count: count }).eq('id', stateId);
  }
};

/**
 * Main function
 */
const main = async () => {
  console.log('🔗 Link Parks to States Script');
  console.log('='.repeat(50));

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  try {
    // Fetch data
    console.log('\n📡 Fetching data from database...');

    const [states, parks] = await Promise.all([fetchStates(supabase), fetchNpsParks(supabase)]);

    console.log(`   - States: ${states.length}`);
    console.log(`   - NPS parks: ${parks.length}`);

    if (states.length === 0) {
      console.log('\n⚠️  No states found. Run the migration first.');
      process.exit(0);
    }

    if (parks.length === 0) {
      console.log('\n⚠️  No parks found. Run import:nps first.');
      process.exit(0);
    }

    // Create state code to ID mapping
    const stateCodeToId = {};
    for (const state of states) {
      stateCodeToId[state.code] = state.id;
    }

    // Create links
    console.log('\n🔄 Creating park-state links...');
    const links = [];
    let parksWithStates = 0;
    let parksWithoutStates = 0;

    for (const park of parks) {
      const stateCodes = parseStateCodes(park.states);

      if (stateCodes.length === 0) {
        parksWithoutStates++;
        continue;
      }

      parksWithStates++;
      let isPrimary = true;

      for (const stateCode of stateCodes) {
        const stateId = stateCodeToId[stateCode];

        if (stateId) {
          links.push({
            nps_park_id: park.id,
            state_id: stateId,
            is_primary: isPrimary,
          });
          isPrimary = false; // Only first state is primary
        } else {
          console.warn(`   ⚠️  Unknown state code: ${stateCode} for park ${park.full_name}`);
        }
      }
    }

    console.log(`   - Parks with state info: ${parksWithStates}`);
    console.log(`   - Parks without state info: ${parksWithoutStates}`);
    console.log(`   - Total links to create: ${links.length}`);

    // Save links
    console.log('\n💾 Saving links to database...');
    const result = await createParkStateLinks(supabase, links);
    console.log(`   - Links created: ${result.inserted}`);

    // Update park counts
    console.log('\n📊 Updating state park counts...');
    await updateStateParkCounts(supabase);

    // Print summary
    console.log(`\n${  '='.repeat(50)}`);
    console.log('📊 Summary:');
    console.log(`   - Parks processed: ${parks.length}`);
    console.log(`   - Links created: ${result.inserted}`);
    console.log('='.repeat(50));

    // Show states with most parks
    const { data: topStates } = await supabase
      .from('states')
      .select('name, park_count')
      .gt('park_count', 0)
      .order('park_count', { ascending: false })
      .limit(10);

    if (topStates?.length > 0) {
      console.log('\n🏆 Top 10 states by park count:');
      topStates.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.name}: ${s.park_count} parks`);
      });
    }

    console.log('\n✅ Park-state linking completed successfully!');
  } catch (error) {
    console.error('\n❌ Linking failed:', error.message);
    process.exit(1);
  }
};

// Run the script
main();