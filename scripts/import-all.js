#!/usr/bin/env node

/**
 * Master Import Script
 *
 * This script runs all data import scripts in sequence:
 * 1. Import NPS parks
 * 2. Import Wikidata parks
 * 3. Link parks together
 *
 * Usage:
 *   node scripts/import-all.js
 *
 * Environment variables required:
 *   - NPS_API_KEY: Your NPS API key
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Runs a script and returns a promise
 */
const runScript = (scriptPath, name) => {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Running: ${name}`);
    console.log('='.repeat(60));

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start ${name}: ${error.message}`));
    });
  });
};

/**
 * Main function
 */
const main = async () => {
  console.log('🏞️  ParkLookup.com - Master Import Script');
  console.log('='.repeat(60));
  console.log('This script will import data from:');
  console.log('  1. National Park Service API');
  console.log('  2. Wikidata SPARQL endpoint');
  console.log('  3. Link parks together');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: Import NPS parks
    await runScript(join(__dirname, 'import-nps.js'), 'NPS Import');

    // Step 2: Import Wikidata parks
    await runScript(join(__dirname, 'import-wikidata.js'), 'Wikidata Import');

    // Step 3: Link parks
    await runScript(join(__dirname, 'link-parks.js'), 'Park Linking');

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ All imports completed successfully!');
    console.log(`   Total duration: ${duration}s`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error(`\n❌ Import failed: ${error.message}`);
    process.exit(1);
  }
};

// Run the script
main();