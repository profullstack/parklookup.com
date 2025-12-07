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

async function checkParkLinks() {
  console.log('Checking park_links table...\n');

  // Check park_links table
  const { data: links, error: linksError } = await supabase
    .from('park_links')
    .select('*')
    .limit(5);
  
  if (linksError) {
    console.log('park_links table error:', linksError.message);
    console.log('\nThe park_links table may not exist. Need to run migrations.');
    return;
  }

  console.log('park_links table exists!');
  console.log('Sample links:', links?.length || 0);
  
  // Count total links
  const { count } = await supabase
    .from('park_links')
    .select('*', { count: 'exact', head: true });
  console.log('Total park links:', count);

  // Check all_parks view
  console.log('\nChecking all_parks view...');
  const { data: allParks, error: allParksError } = await supabase
    .from('all_parks')
    .select('park_code, full_name, source')
    .limit(10);
  
  if (allParksError) {
    console.log('all_parks view error:', allParksError.message);
    return;
  }

  console.log('all_parks view exists!');
  console.log('Sample parks:');
  allParks?.forEach(p => console.log(`  - ${p.full_name} (${p.source})`));
}

checkParkLinks().catch(console.error);
