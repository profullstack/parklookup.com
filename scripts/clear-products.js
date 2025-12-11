#!/usr/bin/env node

/**
 * Clear Products Data Script
 *
 * This script deletes all product data from the database.
 * Use this before re-running the import script to get fresh data.
 *
 * Usage:
 *   node scripts/clear-products.js
 *   node scripts/clear-products.js --confirm  (skip confirmation prompt)
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/load-env.js';
import readline from 'readline';

// Load environment variables from .env file
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const {SUPABASE_SERVICE_ROLE_KEY} = process.env;

/**
 * Creates a Supabase client with service role key
 */
const createSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    if (!SUPABASE_URL) {console.error('   - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');}
    if (!SUPABASE_SERVICE_ROLE_KEY) {console.error('   - SUPABASE_SERVICE_ROLE_KEY');}
    process.exit(1);
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * Prompts user for confirmation
 */
const confirmAction = async (message) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

/**
 * Main function
 */
const main = async () => {
  console.log('🗑️  Clear Products Data Script');
  console.log('='.repeat(50));

  const skipConfirm = process.argv.includes('--confirm');

  const supabase = createSupabaseClient();

  // Get current counts
  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  const { count: activityProductsCount } = await supabase
    .from('activity_products')
    .select('*', { count: 'exact', head: true });

  const { count: parkProductsCount } = await supabase
    .from('park_products')
    .select('*', { count: 'exact', head: true });

  const { count: importLogsCount } = await supabase
    .from('product_import_logs')
    .select('*', { count: 'exact', head: true });

  console.log('\nCurrent data:');
  console.log(`  - Products: ${productsCount ?? 0}`);
  console.log(`  - Activity-Product links: ${activityProductsCount ?? 0}`);
  console.log(`  - Park-Product links: ${parkProductsCount ?? 0}`);
  console.log(`  - Import logs: ${importLogsCount ?? 0}`);

  if ((productsCount ?? 0) === 0) {
    console.log('\n✅ Products table is already empty!');
    return;
  }

  if (!skipConfirm) {
    const confirmed = await confirmAction('\n⚠️  This will delete ALL product data. Continue?');
    if (!confirmed) {
      console.log('❌ Cancelled.');
      return;
    }
  }

  console.log('\n🗑️  Deleting data...');

  // Delete in order due to foreign key constraints
  // 1. Delete activity_products (references products)
  const { error: activityError } = await supabase
    .from('activity_products')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (activityError) {
    console.error('❌ Failed to delete activity_products:', activityError.message);
  } else {
    console.log(`   ✅ Deleted ${activityProductsCount ?? 0} activity-product links`);
  }

  // 2. Delete park_products (references products)
  const { error: parkError } = await supabase
    .from('park_products')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (parkError) {
    console.error('❌ Failed to delete park_products:', parkError.message);
  } else {
    console.log(`   ✅ Deleted ${parkProductsCount ?? 0} park-product links`);
  }

  // 3. Delete products
  const { error: productsError } = await supabase
    .from('products')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (productsError) {
    console.error('❌ Failed to delete products:', productsError.message);
  } else {
    console.log(`   ✅ Deleted ${productsCount ?? 0} products`);
  }

  // 4. Optionally delete import logs
  const { error: logsError } = await supabase
    .from('product_import_logs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (logsError) {
    console.error('❌ Failed to delete import logs:', logsError.message);
  } else {
    console.log(`   ✅ Deleted ${importLogsCount ?? 0} import logs`);
  }

  console.log('\n✅ Product data cleared successfully!');
  console.log('\nYou can now run the import script:');
  console.log('  node scripts/import-products.js --all');
};

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});