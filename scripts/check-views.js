#!/usr/bin/env node

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

async function checkViews() {
  console.log('Checking database views...\n');

  // Check parks_combined view
  const { data: combined, error: combinedError } = await supabase
    .from('parks_combined')
    .select('park_code, name, source')
    .limit(5);
  console.log('parks_combined view:', combinedError ? `Error: ${combinedError.message}` : `OK (${combined?.length || 0} sample)`);
  if (combined && combined.length > 0) {
    console.log('  Sources:', [...new Set(combined.map(p => p.source))].join(', '));
  }

  // Check all_parks view
  const { data: allParks, error: allParksError } = await supabase
    .from('all_parks')
    .select('park_code, name, source')
    .limit(5);
  console.log('all_parks view:', allParksError ? `Error: ${allParksError.message}` : `OK (${allParks?.length || 0} sample)`);
  if (allParks && allParks.length > 0) {
    console.log('  Sources:', [...new Set(allParks.map(p => p.source))].join(', '));
  }

  // Count by source in all_parks
  if (!allParksError) {
    const { data: npsCount } = await supabase
      .from('all_parks')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'nps');
    const { data: wikiCount } = await supabase
      .from('all_parks')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'wikidata');
    console.log('\nall_parks counts by source:');
    console.log('  NPS:', npsCount);
    console.log('  Wikidata:', wikiCount);
  }

  // Check wikidata_parks for state parks
  const { data: stateParks, error: stateError } = await supabase
    .from('wikidata_parks')
    .select('id, name, park_type')
    .ilike('park_type', '%state%')
    .limit(5);
  console.log('\nWikidata state parks sample:', stateError ? `Error: ${stateError.message}` : `Found ${stateParks?.length || 0}`);
  if (stateParks && stateParks.length > 0) {
    stateParks.forEach(p => console.log(`  - ${p.name} (${p.park_type})`));
  }
}

checkViews().catch(console.error);
