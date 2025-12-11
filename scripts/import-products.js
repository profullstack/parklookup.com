#!/usr/bin/env node

/**
 * Amazon Products Import Script
 *
 * This script fetches camping gear and outdoor products from the Rainforest API
 * (Amazon Product Data) and imports them into the Supabase database.
 *
 * Product titles and descriptions are rewritten using OpenAI to avoid
 * duplicate content penalties in search engine results.
 *
 * Usage:
 *   node scripts/import-products.js [options]
 *
 * Options:
 *   --search-term <term>  Import products for a specific search term
 *   --all                 Import products for all predefined search terms
 *   --details             Fetch detailed product information (slower, more API calls)
 *   --max <number>        Maximum products per search term (default: 10)
 *   --delay <ms>          Delay between API calls in milliseconds (default: 2000)
 *   --concurrency <n>     Number of search terms to process in parallel (default: 3)
 *   --no-rewrite          Skip AI rewriting of titles and descriptions
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 *   - RAINFOREST_API_KEY: Your Rainforest API key
 *   - AMAZON_TAG: Your Amazon affiliate tag
 *   - OPENAI_API_KEY: Your OpenAI API key (for content rewriting)
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  searchProducts,
  getProductDetails,
  transformSearchProduct,
  transformProductDetails,
  buildAffiliateUrl,
  CAMPING_SEARCH_TERMS,
  ACTIVITY_SEARCH_TERMS,
} from '../lib/api/rainforest.js';
import { loadEnv } from './lib/load-env.js';

// Load environment variables from .env file
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const {SUPABASE_SERVICE_ROLE_KEY} = process.env;
const {RAINFOREST_API_KEY} = process.env;
const {AMAZON_TAG} = process.env;
const {OPENAI_API_KEY} = process.env;

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : null;
};
const hasFlag = (name) => args.includes(name);

const OPTIONS = {
  searchTerm: getArg('--search-term'),
  all: hasFlag('--all'),
  details: hasFlag('--details'),
  maxProducts: parseInt(getArg('--max') || '10', 10),
  delayMs: parseInt(getArg('--delay') || '2000', 10),
  concurrency: parseInt(getArg('--concurrency') || '3', 10),
  noRewrite: hasFlag('--no-rewrite'),
};

/**
 * Validates required environment variables
 */
const validateEnv = () => {
  const missing = [];

  if (!SUPABASE_URL) {missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');}
  if (!SUPABASE_SERVICE_ROLE_KEY) {missing.push('SUPABASE_SERVICE_ROLE_KEY');}
  if (!RAINFOREST_API_KEY) {missing.push('RAINFOREST_API_KEY');}

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }

  if (!AMAZON_TAG) {
    console.warn('⚠️  AMAZON_TAG not set, using default: parklookup-20');
  }

  if (!OPENAI_API_KEY && !OPTIONS.noRewrite) {
    console.warn('⚠️  OPENAI_API_KEY not set, content rewriting will be skipped');
  }
};

/**
 * Creates an OpenAI client
 */
const createOpenAIClient = () => {
  if (!OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: OPENAI_API_KEY });
};

/**
 * Rewrites product title and description using OpenAI to avoid duplicate content
 * @param {Object} openai - OpenAI client instance
 * @param {string} title - Original product title
 * @param {string} description - Original product description
 * @param {string} brand - Product brand
 * @returns {Promise<{title: string, description: string}>} Rewritten content
 */
const rewriteProductContent = async (openai, title, description, brand) => {
  if (!openai) {
    return { title, description };
  }

  try {
    const prompt = `You are a product copywriter for an outdoor and camping gear website called ParkLookup.
Rewrite the following Amazon product title and description to be unique, engaging, and SEO-friendly.
Keep the essential product information but make it original to avoid duplicate content issues.
Focus on how the product benefits outdoor enthusiasts, campers, and park visitors.

Original Title: ${title}
Original Description: ${description || 'No description available'}
Brand: ${brand || 'Unknown'}

Respond in JSON format with exactly these fields:
{
  "title": "rewritten title (max 100 characters)",
  "description": "rewritten description (max 500 characters, focus on benefits for outdoor activities)"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful product copywriter. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return {
      title: parsed.title || title,
      description: parsed.description || description,
    };
  } catch (error) {
    console.warn(`   ⚠️  Failed to rewrite content: ${error.message}`);
    return { title, description };
  }
};

/**
 * Rewrites multiple products in batch
 * @param {Object} openai - OpenAI client instance
 * @param {Array} products - Array of product objects
 * @param {number} delayMs - Delay between API calls
 * @returns {Promise<Array>} Products with rewritten content
 */
const rewriteProductsBatch = async (openai, products, delayMs) => {
  if (!openai || OPTIONS.noRewrite) {
    return products;
  }

  console.log(`   🤖 Rewriting ${products.length} product descriptions with AI...`);
  const rewrittenProducts = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Add delay between API calls to avoid rate limiting
    if (i > 0) {
      await delay(delayMs / 2); // Use half the delay for OpenAI calls
    }

    const { title, description } = await rewriteProductContent(
      openai,
      product.title,
      product.description,
      product.brand
    );

    rewrittenProducts.push({
      ...product,
      title,
      description,
      original_title: product.title,
      original_description: product.description,
    });

    process.stdout.write(`\r   AI rewrite progress: ${i + 1}/${products.length}`);
  }
  console.log(''); // New line after progress

  return rewrittenProducts;
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
 * Delay execution for a specified time
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Logs a product import event to the database
 */
const logImport = async (supabase, searchTerm, status, metadata = {}) => {
  const { error } = await supabase.from('product_import_logs').insert({
    search_term: searchTerm,
    status,
    ...metadata,
  });

  if (error) {
    console.warn('⚠️  Failed to log import:', error.message);
  }
};

/**
 * Gets or creates a category by slug
 */
const getCategoryId = async (supabase, searchTerm) => {
  // Map search terms to category slugs
  const categoryMap = {
    'camping gear': 'camping-gear',
    'camping tent': 'tents-shelters',
    'sleeping bag': 'sleeping-gear',
    'camping cookware': 'cooking-food',
    'camping lantern': 'lighting',
    'hiking backpack': 'backpacks-bags',
    'hiking boots': 'footwear',
    'trekking poles': 'hiking-equipment',
    'water filter': 'water-hydration',
    'first aid': 'safety-first-aid',
    binoculars: 'wildlife-watching',
    fishing: 'fishing-gear',
    'rain jacket': 'outdoor-clothing',
    headlamp: 'lighting',
    compass: 'navigation',
    gps: 'navigation',
  };

  // Find matching category
  let categorySlug = 'camping-gear'; // default
  for (const [keyword, slug] of Object.entries(categoryMap)) {
    if (searchTerm.toLowerCase().includes(keyword)) {
      categorySlug = slug;
      break;
    }
  }

  const { data, error } = await supabase
    .from('product_categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (error || !data) {
    console.warn(`⚠️  Category not found for slug: ${categorySlug}`);
    return null;
  }

  return data.id;
};

/**
 * Deduplicates products by ASIN, keeping the first occurrence with the most data
 * @param {Array} products - Array of product objects
 * @returns {Array} Deduplicated array of products
 */
const deduplicateProducts = (products) => {
  const productMap = new Map();

  for (const product of products) {
    if (!product.asin) {continue;}

    const existing = productMap.get(product.asin);
    if (!existing) {
      productMap.set(product.asin, product);
    } else {
      // Merge data, preferring non-null values
      const merged = { ...existing };
      for (const [key, value] of Object.entries(product)) {
        if (value !== null && value !== undefined && merged[key] === null) {
          merged[key] = value;
        }
      }
      productMap.set(product.asin, merged);
    }
  }

  return Array.from(productMap.values());
};

/**
 * Upserts products into the database
 */
const upsertProducts = async (supabase, products, categoryId, aiRewritten = false) => {
  const results = {
    inserted: 0,
    updated: 0,
    errors: [],
  };

  // Deduplicate products before upserting
  const uniqueProducts = deduplicateProducts(products);
  if (uniqueProducts.length < products.length) {
    console.log(`   Deduplicated ${products.length} products to ${uniqueProducts.length} unique products`);
  }

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < uniqueProducts.length; i += batchSize) {
    const batch = uniqueProducts.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('products')
      .upsert(
        batch.map((product) => ({
          asin: product.asin,
          title: product.title,
          description: product.description,
          original_title: product.original_title || null,
          original_description: product.original_description || null,
          ai_rewritten: aiRewritten && !!product.original_title,
          ai_rewritten_at: aiRewritten && product.original_title ? new Date().toISOString() : null,
          brand: product.brand,
          category_id: categoryId,
          price: product.price,
          currency: product.currency,
          original_price: product.original_price,
          rating: product.rating,
          ratings_total: product.ratings_total,
          reviews_total: product.reviews_total,
          main_image_url: product.main_image_url,
          images: product.images,
          features: product.features || [],
          specifications: product.specifications || {},
          availability: product.availability,
          is_prime: product.is_prime,
          affiliate_url: product.affiliate_url,
          search_term: product.search_term,
          raw_data: product.raw_data,
          is_active: true,
        })),
        { onConflict: 'asin' }
      )
      .select('id');

    if (error) {
      results.errors.push({ batch: i / batchSize, error: error.message });
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
    } else {
      results.inserted += data?.length ?? 0;
    }
  }

  return results;
};

/**
 * Links products to activities
 */
const linkProductsToActivities = async (supabase, products, searchTerm) => {
  // Find which activities this search term relates to
  const relatedActivities = [];
  for (const [activity, terms] of Object.entries(ACTIVITY_SEARCH_TERMS)) {
    if (terms.some((term) => searchTerm.toLowerCase().includes(term.toLowerCase().split(' ')[0]))) {
      relatedActivities.push(activity);
    }
  }

  if (relatedActivities.length === 0) {
    return;
  }

  // Get product IDs
  const asins = products.map((p) => p.asin);
  const { data: productData } = await supabase
    .from('products')
    .select('id, asin')
    .in('asin', asins);

  if (!productData || productData.length === 0) {
    return;
  }

  // Create activity-product links
  const links = [];
  for (const product of productData) {
    for (const activity of relatedActivities) {
      links.push({
        activity_name: activity,
        product_id: product.id,
        relevance_score: 0.8,
      });
    }
  }

  if (links.length > 0) {
    const { error } = await supabase
      .from('activity_products')
      .upsert(links, { onConflict: 'activity_name,product_id' });

    if (error) {
      console.warn(`⚠️  Failed to link products to activities:`, error.message);
    } else {
      console.log(`   Linked ${links.length} product-activity relationships`);
    }
  }
};

/**
 * Imports products for a single search term
 */
const importForSearchTerm = async (supabase, openai, searchTerm, options) => {
  const { maxProducts, delayMs, details, noRewrite } = options;

  console.log(`\n🔍 Searching for: "${searchTerm}"`);

  const startTime = new Date();
  await logImport(supabase, searchTerm, 'started', { started_at: startTime.toISOString() });

  try {
    // Search for products
    const searchResults = await searchProducts(searchTerm);
    const rawProducts = searchResults.products.slice(0, maxProducts);

    console.log(`   Found ${searchResults.totalResults} results, processing ${rawProducts.length}`);

    let products = [];

    if (details) {
      // Fetch detailed information for each product
      console.log(`   Fetching detailed product information...`);
      for (let i = 0; i < rawProducts.length; i++) {
        const product = rawProducts[i];
        try {
          if (i > 0) {
            await delay(delayMs);
          }
          const productDetails = await getProductDetails(product.asin);
          if (productDetails) {
            products.push(transformProductDetails(productDetails, searchTerm));
          }
          process.stdout.write(`\r   Progress: ${i + 1}/${rawProducts.length} products`);
        } catch (error) {
          console.error(`\n   ⚠️  Failed to get details for ${product.asin}:`, error.message);
          // Fall back to search result data
          products.push(transformSearchProduct(product, searchTerm));
        }
      }
      console.log(''); // New line after progress
    } else {
      // Use search result data only
      products = rawProducts.map((p) => transformSearchProduct(p, searchTerm));
    }

    // Rewrite product content with AI (unless disabled)
    if (!noRewrite && openai) {
      products = await rewriteProductsBatch(openai, products, delayMs);
    }

    // Get category ID
    const categoryId = await getCategoryId(supabase, searchTerm);

    // Upsert products (pass aiRewritten flag)
    const aiRewritten = !noRewrite && !!openai;
    const results = await upsertProducts(supabase, products, categoryId, aiRewritten);

    // Link products to activities
    await linkProductsToActivities(supabase, products, searchTerm);

    // Log completion
    const endTime = new Date();
    await logImport(supabase, searchTerm, 'completed', {
      products_fetched: rawProducts.length,
      products_inserted: results.inserted,
      products_updated: results.updated,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      metadata: {
        duration_ms: endTime - startTime,
        errors: results.errors,
        with_details: details,
        ai_rewritten: !noRewrite && !!openai,
      },
    });

    console.log(`   ✅ Imported ${results.inserted} products`);
    if (results.errors.length > 0) {
      console.log(`   ⚠️  ${results.errors.length} errors occurred`);
    }

    return results;
  } catch (error) {
    console.error(`   ❌ Failed:`, error.message);

    await logImport(supabase, searchTerm, 'failed', {
      error_message: error.message,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
    });

    return { inserted: 0, updated: 0, errors: [{ error: error.message }] };
  }
};

/**
 * Main import function
 */
const main = async () => {
  console.log('🛒 Amazon Products Import Script');
  console.log('='.repeat(50));

  // Validate environment
  validateEnv();

  // Determine search terms to process
  let searchTerms = [];

  if (OPTIONS.searchTerm) {
    searchTerms = [OPTIONS.searchTerm];
  } else if (OPTIONS.all) {
    searchTerms = CAMPING_SEARCH_TERMS;
  } else {
    console.log('\nUsage:');
    console.log('  node scripts/import-products.js --search-term "camping gear"');
    console.log('  node scripts/import-products.js --all');
    console.log('  node scripts/import-products.js --all --details --max 5');
    console.log('  node scripts/import-products.js --all --no-rewrite');
    console.log('\nOptions:');
    console.log('  --search-term <term>  Import products for a specific search term');
    console.log('  --all                 Import products for all predefined search terms');
    console.log('  --details             Fetch detailed product information (slower)');
    console.log('  --max <number>        Maximum products per search term (default: 10)');
    console.log('  --delay <ms>          Delay between API calls (default: 2000)');
    console.log('  --concurrency <n>     Number of search terms to process in parallel (default: 3)');
    console.log('  --no-rewrite          Skip AI rewriting of titles and descriptions');
    console.log('\nPredefined search terms:');
    CAMPING_SEARCH_TERMS.forEach((term) => console.log(`  - ${term}`));
    process.exit(0);
  }

  console.log(`\nConfiguration:`);
  console.log(`  - Search terms: ${searchTerms.length}`);
  console.log(`  - Max products per term: ${OPTIONS.maxProducts}`);
  console.log(`  - Fetch details: ${OPTIONS.details}`);
  console.log(`  - Delay between calls: ${OPTIONS.delayMs}ms`);
  console.log(`  - Concurrency: ${OPTIONS.concurrency} search terms in parallel`);
  console.log(`  - Amazon affiliate tag: ${AMAZON_TAG || 'parklookup-20'}`);
  console.log(`  - AI content rewriting: ${!OPTIONS.noRewrite && OPENAI_API_KEY ? 'enabled' : 'disabled'}`);

  // Create Supabase client
  const supabase = createSupabaseClient();

  // Create OpenAI client (if API key is available)
  const openai = createOpenAIClient();

  // Track overall results
  const overallResults = {
    totalTerms: searchTerms.length,
    totalProducts: 0,
    totalErrors: 0,
    startTime: new Date(),
  };

  // Process search terms in parallel batches
  const { concurrency } = OPTIONS;
  for (let i = 0; i < searchTerms.length; i += concurrency) {
    const batch = searchTerms.slice(i, i + concurrency);

    // Add delay between batches to avoid rate limiting
    if (i > 0) {
      console.log(`\n⏳ Waiting ${OPTIONS.delayMs}ms before next batch...`);
      await delay(OPTIONS.delayMs);
    }

    console.log(`\n📦 Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(searchTerms.length / concurrency)} (${batch.length} terms)`);

    // Process batch in parallel
    const batchPromises = batch.map((searchTerm) =>
      importForSearchTerm(supabase, openai, searchTerm, OPTIONS)
    );

    const batchResults = await Promise.all(batchPromises);

    // Aggregate results
    for (const results of batchResults) {
      overallResults.totalProducts += results.inserted;
      overallResults.totalErrors += results.errors.length;
    }
  }

  // Print summary
  const endTime = new Date();
  const duration = (endTime - overallResults.startTime) / 1000;

  console.log(`\n${  '='.repeat(50)}`);
  console.log('📊 Import Summary:');
  console.log(`   - Search terms processed: ${overallResults.totalTerms}`);
  console.log(`   - Total products imported: ${overallResults.totalProducts}`);
  console.log(`   - Total errors: ${overallResults.totalErrors}`);
  console.log(`   - Duration: ${duration.toFixed(2)}s`);
  console.log('='.repeat(50));

  if (overallResults.totalErrors > 0) {
    console.log('\n⚠️  Some errors occurred during import. Check the logs above for details.');
  }

  console.log('\n✅ Product import completed!');
};

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});