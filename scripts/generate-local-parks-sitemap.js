#!/usr/bin/env node

/**
 * Local Parks Sitemap Generator
 *
 * Generates XML sitemaps for all local parks pages.
 * Splits into multiple files if needed (max 50,000 URLs per sitemap).
 *
 * Usage:
 *   node scripts/generate-local-parks-sitemap.js [options]
 *
 * Options:
 *   --output=DIR    Output directory (default: ./public/sitemaps)
 *   --base-url=URL  Base URL (default: https://parklookup.com)
 *   --dry-run       Show what would be generated without writing files
 *
 * Environment variables required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from './lib/load-env.js';

// Load environment variables
loadEnv();

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY } = process.env;

/** Maximum URLs per sitemap file */
const MAX_URLS_PER_SITEMAP = 50000;

/** Default base URL */
const DEFAULT_BASE_URL = 'https://parklookup.com';

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    outputDir: './public/sitemaps',
    baseUrl: DEFAULT_BASE_URL,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--output=')) {
      options.outputDir = arg.split('=')[1];
    } else if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
};

/**
 * Validates required environment variables
 */
const validateEnv = () => {
  const missing = [];

  if (!SUPABASE_URL) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
};

/**
 * Creates a Supabase client with service role key
 */
const createSupabaseClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

/**
 * Escapes XML special characters
 */
const escapeXml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Formats date for sitemap
 */
const formatDate = (date) => {
  if (!date) return new Date().toISOString().split('T')[0];
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Generates XML sitemap content
 */
const generateSitemapXml = (urls) => {
  const urlEntries = urls
    .map(
      (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq || 'weekly'}</changefreq>
    <priority>${url.priority || '0.5'}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
};

/**
 * Generates sitemap index XML
 */
const generateSitemapIndexXml = (sitemaps, baseUrl) => {
  const sitemapEntries = sitemaps
    .map(
      (sitemap) => `  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemaps/${sitemap.filename}`)}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
};

/**
 * Fetches all local parks for sitemap
 */
const fetchAllParks = async (supabase) => {
  const parks = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('local_parks')
      .select(
        `
        slug,
        park_type,
        updated_at,
        states!inner(slug),
        counties(slug),
        cities(slug)
      `
      )
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching parks:', error);
      break;
    }

    if (data.length === 0) {
      hasMore = false;
    } else {
      parks.push(...data);
      offset += limit;
      process.stdout.write(`\r   Fetched ${parks.length} parks...`);

      if (data.length < limit) {
        hasMore = false;
      }
    }
  }

  console.log('');
  return parks;
};

/**
 * Fetches all counties with parks
 */
const fetchCountiesWithParks = async (supabase) => {
  const { data, error } = await supabase
    .from('counties')
    .select(
      `
      slug,
      states!inner(slug),
      local_parks(count)
    `
    )
    .gt('local_parks.count', 0);

  if (error) {
    console.error('Error fetching counties:', error);
    return [];
  }

  return data?.filter((c) => c.local_parks?.[0]?.count > 0) || [];
};

/**
 * Fetches all cities with parks
 */
const fetchCitiesWithParks = async (supabase) => {
  const { data, error } = await supabase
    .from('cities')
    .select(
      `
      slug,
      states!inner(slug),
      local_parks(count)
    `
    )
    .gt('local_parks.count', 0);

  if (error) {
    console.error('Error fetching cities:', error);
    return [];
  }

  return data?.filter((c) => c.local_parks?.[0]?.count > 0) || [];
};

/**
 * Fetches all states
 */
const fetchStates = async (supabase) => {
  const { data, error } = await supabase.from('states').select('slug');

  if (error) {
    console.error('Error fetching states:', error);
    return [];
  }

  return data || [];
};

/**
 * Main sitemap generation function
 */
const main = async () => {
  console.log('🗺️  Local Parks Sitemap Generator');
  console.log('='.repeat(50));

  // Parse arguments
  const options = parseArgs();

  // Validate environment
  validateEnv();

  // Create Supabase client
  const supabase = createSupabaseClient();

  const urls = [];
  const today = formatDate(new Date());

  try {
    // Fetch all data
    console.log('\n📡 Fetching data from database...');

    console.log('   Fetching parks...');
    const parks = await fetchAllParks(supabase);

    console.log('   Fetching counties...');
    const counties = await fetchCountiesWithParks(supabase);

    console.log('   Fetching cities...');
    const cities = await fetchCitiesWithParks(supabase);

    console.log('   Fetching states...');
    const states = await fetchStates(supabase);

    console.log(`\n📊 Data summary:`);
    console.log(`   - Parks: ${parks.length}`);
    console.log(`   - Counties: ${counties.length}`);
    console.log(`   - Cities: ${cities.length}`);
    console.log(`   - States: ${states.length}`);

    // Generate URLs for parks
    console.log('\n🔗 Generating URLs...');

    for (const park of parks) {
      const stateSlug = park.states?.slug;
      if (!stateSlug) continue;

      const lastmod = formatDate(park.updated_at);

      // County park URL
      if (park.park_type === 'county' && park.counties?.slug) {
        urls.push({
          loc: `${options.baseUrl}/parks/county/${stateSlug}/${park.counties.slug}/${park.slug}`,
          lastmod,
          changefreq: 'weekly',
          priority: '0.6',
        });
      }
      // City park URL
      else if (park.cities?.slug) {
        urls.push({
          loc: `${options.baseUrl}/parks/city/${stateSlug}/${park.cities.slug}/${park.slug}`,
          lastmod,
          changefreq: 'weekly',
          priority: '0.6',
        });
      }
      // Fallback to county if available
      else if (park.counties?.slug) {
        urls.push({
          loc: `${options.baseUrl}/parks/county/${stateSlug}/${park.counties.slug}/${park.slug}`,
          lastmod,
          changefreq: 'weekly',
          priority: '0.6',
        });
      }
    }

    // Generate URLs for county listing pages
    for (const county of counties) {
      const stateSlug = county.states?.slug;
      if (!stateSlug || !county.slug) continue;

      urls.push({
        loc: `${options.baseUrl}/parks/county/${stateSlug}/${county.slug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.5',
      });
    }

    // Generate URLs for city listing pages
    for (const city of cities) {
      const stateSlug = city.states?.slug;
      if (!stateSlug || !city.slug) continue;

      urls.push({
        loc: `${options.baseUrl}/parks/city/${stateSlug}/${city.slug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.5',
      });
    }

    // Generate URLs for state index pages
    for (const state of states) {
      if (!state.slug) continue;

      urls.push({
        loc: `${options.baseUrl}/parks/county/${state.slug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.4',
      });

      urls.push({
        loc: `${options.baseUrl}/parks/city/${state.slug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.4',
      });
    }

    console.log(`   Generated ${urls.length} URLs`);

    if (options.dryRun) {
      console.log('\n[DRY RUN] Would generate the following sitemaps:');
      const numSitemaps = Math.ceil(urls.length / MAX_URLS_PER_SITEMAP);
      for (let i = 0; i < numSitemaps; i++) {
        const start = i * MAX_URLS_PER_SITEMAP;
        const end = Math.min(start + MAX_URLS_PER_SITEMAP, urls.length);
        console.log(`   - local-parks-sitemap-${i + 1}.xml (${end - start} URLs)`);
      }
      console.log(`   - local-parks-sitemap-index.xml`);
      return;
    }

    // Create output directory
    if (!existsSync(options.outputDir)) {
      mkdirSync(options.outputDir, { recursive: true });
    }

    // Split into multiple sitemaps if needed
    console.log('\n📝 Writing sitemap files...');
    const sitemaps = [];
    const numSitemaps = Math.ceil(urls.length / MAX_URLS_PER_SITEMAP);

    for (let i = 0; i < numSitemaps; i++) {
      const start = i * MAX_URLS_PER_SITEMAP;
      const end = Math.min(start + MAX_URLS_PER_SITEMAP, urls.length);
      const sitemapUrls = urls.slice(start, end);

      const filename = `local-parks-sitemap-${i + 1}.xml`;
      const filepath = join(options.outputDir, filename);
      const content = generateSitemapXml(sitemapUrls);

      writeFileSync(filepath, content, 'utf-8');
      console.log(`   ✅ ${filename} (${sitemapUrls.length} URLs)`);

      sitemaps.push({
        filename,
        lastmod: today,
      });
    }

    // Generate sitemap index
    const indexFilename = 'local-parks-sitemap-index.xml';
    const indexFilepath = join(options.outputDir, indexFilename);
    const indexContent = generateSitemapIndexXml(sitemaps, options.baseUrl);

    writeFileSync(indexFilepath, indexContent, 'utf-8');
    console.log(`   ✅ ${indexFilename}`);

    // Print summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 Sitemap Generation Summary:');
    console.log(`   - Total URLs: ${urls.length}`);
    console.log(`   - Sitemap files: ${sitemaps.length}`);
    console.log(`   - Output directory: ${options.outputDir}`);
    console.log('='.repeat(50));

    console.log('\n✅ Sitemap generation completed!');
    console.log(`\nAdd to your robots.txt:`);
    console.log(`Sitemap: ${options.baseUrl}/sitemaps/${indexFilename}`);
  } catch (error) {
    console.error('\n❌ Sitemap generation failed:', error.message);
    process.exit(1);
  }
};

// Run the script
main();