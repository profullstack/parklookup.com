#!/usr/bin/env node

/**
 * Check database tables status
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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Checking database tables...\n');

  // Check nps_parks table
  const { data: npsParks, error: npsError } = await supabase.from('nps_parks').select('id').limit(1);
  console.log('nps_parks:', npsError ? `Error: ${npsError.message}` : `OK (${npsParks?.length || 0} sample)`);

  // Check wikidata_parks table
  const { data: wikiParks, error: wikiError } = await supabase.from('wikidata_parks').select('id').limit(1);
  console.log('wikidata_parks:', wikiError ? `Error: ${wikiError.message}` : `OK (${wikiParks?.length || 0} sample)`);

  // Check states table
  const { data: states, error: statesError } = await supabase.from('states').select('code, name').limit(3);
  console.log('states:', statesError ? `Error: ${statesError.message}` : `OK (${states?.length || 0} sample)`);
  if (states && states.length > 0) {
    console.log('  Sample states:', states.map((s) => s.name).join(', '));
  }

  // Check nps_park_locations table
  const { data: locations, error: locError } = await supabase.from('nps_park_locations').select('id').limit(1);
  console.log('nps_park_locations:', locError ? `Error: ${locError.message}` : `OK (${locations?.length || 0} sample)`);

  // Count total parks
  const { count: npsCount } = await supabase.from('nps_parks').select('*', { count: 'exact', head: true });
  const { count: wikiCount } = await supabase.from('wikidata_parks').select('*', { count: 'exact', head: true });
  const { count: statesCount } = await supabase.from('states').select('*', { count: 'exact', head: true });

  console.log('\nCounts:');
  console.log('  NPS Parks:', npsCount ?? 'N/A');
  console.log('  Wikidata Parks:', wikiCount ?? 'N/A');
  console.log('  States:', statesCount ?? 'N/A');
}

checkTables().catch(console.error);