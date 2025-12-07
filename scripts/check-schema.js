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

async function checkSchema() {
  console.log('Checking wikidata_parks schema...\n');

  // Get one row to see the columns
  const { data: sample, error } = await supabase
    .from('wikidata_parks')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (sample && sample.length > 0) {
    console.log('Columns in wikidata_parks:');
    Object.keys(sample[0]).forEach(col => {
      console.log(`  - ${col}: ${typeof sample[0][col]} (${sample[0][col] === null ? 'null' : sample[0][col]?.toString().substring(0, 50)})`);
    });
  }

  // Check nps_parks schema too
  console.log('\nChecking nps_parks schema...\n');
  const { data: npsSample, error: npsError } = await supabase
    .from('nps_parks')
    .select('*')
    .limit(1);
  
  if (npsError) {
    console.log('Error:', npsError.message);
    return;
  }

  if (npsSample && npsSample.length > 0) {
    console.log('Columns in nps_parks:');
    Object.keys(npsSample[0]).forEach(col => {
      console.log(`  - ${col}: ${typeof npsSample[0][col]} (${npsSample[0][col] === null ? 'null' : npsSample[0][col]?.toString().substring(0, 50)})`);
    });
  }

  // Check parks_combined view
  console.log('\nChecking parks_combined view...\n');
  const { data: combinedSample, error: combinedError } = await supabase
    .from('parks_combined')
    .select('*')
    .limit(1);
  
  if (combinedError) {
    console.log('Error:', combinedError.message);
    return;
  }

  if (combinedSample && combinedSample.length > 0) {
    console.log('Columns in parks_combined:');
    Object.keys(combinedSample[0]).forEach(col => {
      console.log(`  - ${col}: ${typeof combinedSample[0][col]} (${combinedSample[0][col] === null ? 'null' : combinedSample[0][col]?.toString().substring(0, 50)})`);
    });
  }
}

checkSchema().catch(console.error);
