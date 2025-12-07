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

async function checkAllParks() {
  console.log('Checking all_parks view by source...\n');

  // Count by source
  const { count: npsCount } = await supabase
    .from('all_parks')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'nps');
  console.log('NPS parks in all_parks:', npsCount);

  const { count: wikiCount } = await supabase
    .from('all_parks')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'wikidata');
  console.log('Wikidata parks in all_parks:', wikiCount);

  // Get sample wikidata parks
  const { data: wikiParks, error: wikiError } = await supabase
    .from('all_parks')
    .select('park_code, full_name, states, designation, source')
    .eq('source', 'wikidata')
    .limit(10);
  
  if (wikiError) {
    console.log('\nError fetching wikidata parks:', wikiError.message);
  } else {
    console.log('\nSample wikidata parks from all_parks:');
    wikiParks?.forEach(p => console.log(`  - ${p.full_name} (${p.states}) - ${p.designation}`));
  }

  // Check total count
  const { count: totalCount } = await supabase
    .from('all_parks')
    .select('*', { count: 'exact', head: true });
  console.log('\nTotal parks in all_parks view:', totalCount);

  // Check wikidata_parks directly
  const { count: directWikiCount } = await supabase
    .from('wikidata_parks')
    .select('*', { count: 'exact', head: true });
  console.log('Total wikidata_parks in table:', directWikiCount);

  // Check how many wikidata parks are NOT linked
  const { data: unlinkedCount } = await supabase.rpc('count_unlinked_wikidata_parks');
  console.log('Unlinked wikidata parks (via RPC):', unlinkedCount);
}

checkAllParks().catch(console.error);
