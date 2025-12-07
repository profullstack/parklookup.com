import loadEnv from './lib/load-env.js';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStateParks() {
  // Check for "state park" in label
  const { data: stateParks, error: stateError, count } = await supabase
    .from('wikidata_parks')
    .select('id, label, state', { count: 'exact' })
    .ilike('label', '%state park%')
    .limit(20);
  
  if (stateError) {
    console.error('Error:', stateError);
    return;
  }
  
  console.log(`Found ${count} parks with "state park" in name`);
  console.log('\nSample state parks:');
  stateParks.forEach(p => console.log(`  - ${p.label} (${p.state})`));
  
  // Check the all_parks view
  console.log('\n\nChecking all_parks view...');
  const { data: allParks, error: allError, count: allCount } = await supabase
    .from('all_parks')
    .select('*', { count: 'exact' })
    .limit(5);
  
  if (allError) {
    console.error('Error with all_parks view:', allError);
    return;
  }
  
  console.log(`all_parks view has ${allCount} parks`);
  console.log('\nSample from all_parks:');
  console.log(JSON.stringify(allParks, null, 2));
  
  // Search for state parks in all_parks
  const { data: searchResults, error: searchError, count: searchCount } = await supabase
    .from('all_parks')
    .select('*', { count: 'exact' })
    .ilike('full_name', '%state park%')
    .limit(10);
  
  if (searchError) {
    console.error('Error searching all_parks:', searchError);
    return;
  }
  
  console.log(`\nFound ${searchCount} state parks in all_parks view`);
  console.log('\nSample state parks from all_parks:');
  searchResults.forEach(p => console.log(`  - ${p.full_name} (${p.states}) - source: ${p.source}`));
}

checkStateParks();
