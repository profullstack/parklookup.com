#!/usr/bin/env node

/**
 * BLM Land Data Download Script
 *
 * Downloads BLM Surface Management Agency data from the official BLM ArcGIS Hub.
 * Data source: https://gbp-blm-egis.hub.arcgis.com/
 *
 * The BLM provides state-specific Feature Services that can be queried via REST API.
 *
 * Usage:
 *   pnpm run download:blm [options]
 *
 * Options:
 *   --state <abbr>    Download data for a specific state (e.g., CA, NV, UT)
 *   --all             Download data for all western states
 *   --output <dir>    Output directory (default: data/)
 *   --limit <n>       Limit records per state (for testing)
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Direct service URLs for BLM SMA datasets by state
// Each state has different field names and service configurations
const BLM_SERVICES = {
  AZ: {
    url: 'https://gis.blm.gov/azarcgis/rest/services/lands/BLM_AZ_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  CA: {
    url: 'https://gis.blm.gov/caarcgis/rest/services/lands/BLM_CA_LandStatus_SurfaceManagementAgency/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  CO: {
    url: 'https://gis.blm.gov/coarcgis/rest/services/lands/BLM_CO_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  ID: {
    url: 'https://gis.blm.gov/idarcgis/rest/services/realty/BLM_ID_Surface_Management_Agency/FeatureServer/0',
    where: "MGMT_AGNCY = 'BLM'",
    stateField: null, // No state field, all data is ID
  },
  MT: {
    url: 'https://gis.blm.gov/mtarcgis/rest/services/cadastral/BLM_MT_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  NM: {
    url: 'https://gis.blm.gov/nmarcgis/rest/services/lands/BLM_NM_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  NV: {
    url: 'https://gis.blm.gov/nvarcgis/rest/services/lands/BLM_NV_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  OR: {
    url: 'https://gis.blm.gov/orarcgis/rest/services/lands/BLM_OR_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  UT: {
    url: 'https://gis.blm.gov/utarcgis/rest/services/lands/BLM_UT_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
  WY: {
    url: 'https://gis.blm.gov/wyarcgis/rest/services/lands/BLM_WY_SMA/FeatureServer/0',
    where: "ADMIN_AGENCY_CODE = 'BLM'",
    stateField: 'ADMIN_ST',
  },
};

// Legacy item IDs (kept for reference)
const BLM_ITEM_IDS = {
  AK: 'f01b30f543274245a8329f569ce76c96', // BLM AK Administered Lands
  AZ: 'e9318136c1ad4783941889d2e33ced10', // BLM AZ Surface Management Agency
  CA: 'f69a3b8f82314b38a6b975448482d0d5', // BLM CA Land Status Surface Management Agency
  CO: '43857a5ce49345c3b05a6037a74c2191', // BLM Colorado Surface Management Agency
  ID: '38f3343413d34278bac55a8d1e8c6f9c', // BLM ID Surface Management Agency
  MT: '138e109140ea4773a7c5d4e48d85461a', // BLM MT SMA Surface Ownership Polygon
  NM: '2e245db5b0b4466a93f3a7c233536157', // BLM NM Lands Surface Management Agency
  NV: 'b977d306a6c8447ea19b8b74379a7af2', // BLM NV Surface Management Agency (SMA)
  OR: 'b4d233270b404b37874e7d913e4f2ea6', // BLM OR Withdrawals Polygon Hub (fallback)
  UT: '56beb07d63f947f59987635854085a40', // BLM UT Surface Management Agency (Polygon)
  WA: null, // No dedicated WA service found - use national
  WY: '4cd0b7182c6442d2b27cdda0d799c0a1', // BLM WY Surface Management Agency
};

// National SMA service (all states in one)
const NATIONAL_SMA_ITEM_ID = '6bf2e737c59d4111be92420ee5ab0b46';

// Default output directory
const DEFAULT_OUTPUT_DIR = 'data';

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    state: null,
    all: false,
    outputDir: DEFAULT_OUTPUT_DIR,
    limit: null,
    useNational: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--state':
        options.state = args[++i]?.toUpperCase();
        break;
      case '--all':
        options.all = true;
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--national':
        options.useNational = true;
        break;
      case '--help':
        console.log(`
BLM Land Data Download Script

Downloads BLM Surface Management Agency data from the official BLM ArcGIS Hub.

Usage: pnpm run download:blm [options]

Options:
  --state <abbr>    Download data for a specific state (e.g., CA, NV, UT)
  --all             Download data for all western states
  --national        Use national SMA service instead of state services
  --output <dir>    Output directory (default: data/)
  --limit <n>       Limit records per state (for testing)
  --help            Show this help message

Available states: ${Object.keys(BLM_ITEM_IDS).filter(s => BLM_ITEM_IDS[s]).join(', ')}

Examples:
  pnpm run download:blm -- --state=CA
  pnpm run download:blm -- --all
  pnpm run download:blm -- --state=NV --limit=100
        `);
        process.exit(0);
    }
  }

  return options;
};

/**
 * Get the Feature Service URL for an ArcGIS item
 *
 * @param {string} itemId - ArcGIS item ID
 * @returns {Promise<string|null>} Feature Service URL
 */
const getServiceUrl = async (itemId) => {
  const url = `https://www.arcgis.com/sharing/rest/content/items/${itemId}?f=json`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error(`   Failed to get service URL for item ${itemId}: ${error.message}`);
    return null;
  }
};

/**
 * Fetch GeoJSON from ArcGIS Feature Service
 *
 * @param {string} serviceUrl - Base URL of the feature service
 * @param {Object} options - Query options
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
const fetchFromArcGIS = async (serviceUrl, options = {}) => {
  const { limit = null, offset = 0, where = "ADMIN_AGENCY_CODE = 'BLM'" } = options;

  // Build query URL - try layer 0 first
  const layerUrl = serviceUrl.includes('/FeatureServer') 
    ? (serviceUrl.endsWith('/0') ? serviceUrl : `${serviceUrl}/0`)
    : `${serviceUrl}/0`;

  const params = new URLSearchParams({
    where,
    outFields: '*',
    f: 'geojson',
    returnGeometry: 'true',
    outSR: '4326',
  });

  if (limit) {
    params.set('resultRecordCount', limit.toString());
    params.set('resultOffset', offset.toString());
  }

  const url = `${layerUrl}/query?${params.toString()}`;
  console.log(`   Fetching: ${url.substring(0, 100)}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Handle ArcGIS error responses
  if (data.error) {
    throw new Error(`ArcGIS Error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data;
};

/**
 * Fetch all features from a service (handles pagination)
 *
 * @param {string} serviceUrl - Base URL of the feature service
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Complete GeoJSON FeatureCollection
 */
const fetchAllFeatures = async (serviceUrl, options = {}) => {
  const { limit = null, batchSize = 1000 } = options;

  const allFeatures = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const currentLimit = limit ? Math.min(batchSize, limit - allFeatures.length) : batchSize;

    if (currentLimit <= 0) break;

    try {
      const data = await fetchFromArcGIS(serviceUrl, {
        ...options,
        limit: currentLimit,
        offset,
      });

      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        console.log(`   Fetched ${data.features.length} features (total: ${allFeatures.length})`);

        // Check if we got fewer than requested (end of data)
        if (data.features.length < currentLimit) {
          hasMore = false;
        } else {
          offset += data.features.length;
        }

        // Check if we've hit the limit
        if (limit && allFeatures.length >= limit) {
          hasMore = false;
        }

        // Check for exceededTransferLimit flag
        if (!data.exceededTransferLimit && data.features.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`   Error fetching batch at offset ${offset}: ${error.message}`);
      hasMore = false;
    }

    // Rate limiting - be nice to the BLM servers
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return {
    type: 'FeatureCollection',
    features: allFeatures,
  };
};

/**
 * Download BLM data for a specific state using direct service URL
 *
 * @param {string} state - State abbreviation
 * @param {Object} options - Download options
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
const downloadStateData = async (state, options = {}) => {
  const serviceConfig = BLM_SERVICES[state];

  if (!serviceConfig) {
    console.log(`⚠️  No service configured for ${state}, skipping...`);
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  console.log(`\n📥 Downloading BLM data for ${state}...`);
  console.log(`   Service URL: ${serviceConfig.url}`);
  console.log(`   Filter: ${serviceConfig.where}`);

  try {
    // Try with the configured BLM filter first
    const geojson = await fetchAllFeaturesFromUrl(serviceConfig.url, {
      limit: options.limit,
      where: serviceConfig.where,
    });

    console.log(`✅ Downloaded ${geojson.features.length} features for ${state}`);
    return geojson;
  } catch (error) {
    console.error(`❌ Failed with BLM filter: ${error.message}`);

    // Try without filter
    console.log(`   Retrying with 1=1 filter...`);
    try {
      const geojson = await fetchAllFeaturesFromUrl(serviceConfig.url, {
        limit: options.limit,
        where: '1=1',
      });

      // Filter client-side for BLM
      const blmFeatures = geojson.features.filter(f => {
        const props = f.properties || {};
        return (
          props.ADMIN_AGENCY_CODE === 'BLM' ||
          props.MGMT_AGNCY === 'BLM' ||
          props.CATEGORY === 'BLM' ||
          props.DESC_?.includes('Bureau of Land') ||
          props.AGNCY_NAME === 'BLM'
        );
      });

      console.log(`✅ Downloaded ${blmFeatures.length} BLM features for ${state} (filtered from ${geojson.features.length})`);
      return {
        type: 'FeatureCollection',
        features: blmFeatures,
      };
    } catch (retryError) {
      console.error(`❌ Retry failed for ${state}: ${retryError.message}`);
      return {
        type: 'FeatureCollection',
        features: [],
      };
    }
  }
};

/**
 * Fetch all features from a direct URL (handles pagination)
 *
 * @param {string} layerUrl - Direct layer URL
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Complete GeoJSON FeatureCollection
 */
const fetchAllFeaturesFromUrl = async (layerUrl, options = {}) => {
  const { limit = null, batchSize = 1000, where = '1=1' } = options;

  const allFeatures = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const currentLimit = limit ? Math.min(batchSize, limit - allFeatures.length) : batchSize;

    if (currentLimit <= 0) break;

    const params = new URLSearchParams({
      where,
      outFields: '*',
      f: 'geojson',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: currentLimit.toString(),
      resultOffset: offset.toString(),
    });

    const url = `${layerUrl}/query?${params.toString()}`;
    console.log(`   Fetching offset ${offset}...`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ParkLookup/1.0 (https://parklookup.com)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle ArcGIS error responses
      if (data.error) {
        throw new Error(`ArcGIS Error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        console.log(`   Fetched ${data.features.length} features (total: ${allFeatures.length})`);

        // Check if we got fewer than requested (end of data)
        if (data.features.length < currentLimit) {
          hasMore = false;
        } else {
          offset += data.features.length;
        }

        // Check if we've hit the limit
        if (limit && allFeatures.length >= limit) {
          hasMore = false;
        }

        // Check for exceededTransferLimit flag
        if (!data.exceededTransferLimit && data.features.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`   Error fetching batch at offset ${offset}: ${error.message}`);
      hasMore = false;
    }

    // Rate limiting - be nice to the BLM servers
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return {
    type: 'FeatureCollection',
    features: allFeatures,
  };
};

/**
 * Save GeoJSON to file
 *
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {string} filePath - Output file path
 */
const saveGeoJSON = async (geojson, filePath) => {
  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(filePath, JSON.stringify(geojson, null, 2));
  console.log(`💾 Saved to ${filePath}`);
};

/**
 * Main function
 */
const main = async () => {
  console.log('🏜️  BLM Land Data Download Script');
  console.log('='.repeat(50));
  console.log('Data source: https://gbp-blm-egis.hub.arcgis.com/');
  console.log('');

  const options = parseArgs();

  // Determine which states to download
  let states = [];

  if (options.state) {
    states = [options.state];
  } else if (options.all) {
    states = Object.keys(BLM_SERVICES);
  } else {
    // Default: download a few key western states
    states = ['AZ', 'ID', 'NV', 'UT', 'CA'];
    console.log(`No state specified. Downloading default states: ${states.join(', ')}`);
    console.log('Use --all to download all states, or --state=XX for a specific state.');
  }

  // Ensure output directory exists
  if (!existsSync(options.outputDir)) {
    await mkdir(options.outputDir, { recursive: true });
  }

  // Download each state
  const allFeatures = [];

  for (const state of states) {
    const geojson = await downloadStateData(state, options);

    // Add state to each feature's properties
    for (const feature of geojson.features) {
      feature.properties = feature.properties || {};
      feature.properties.ADMIN_ST = state;
    }

    allFeatures.push(...geojson.features);

    // Save state-specific file
    const stateFile = join(options.outputDir, `blm-${state.toLowerCase()}.geojson`);
    await saveGeoJSON(geojson, stateFile);
  }

  // Save combined file
  const combinedGeojson = {
    type: 'FeatureCollection',
    features: allFeatures,
  };

  const combinedFile = join(options.outputDir, 'blm.geojson');
  await saveGeoJSON(combinedGeojson, combinedFile);

  // Print summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 Download Summary:');
  console.log(`   - States downloaded: ${states.length}`);
  console.log(`   - Total features: ${allFeatures.length}`);
  console.log(`   - Output directory: ${options.outputDir}`);
  console.log('='.repeat(50));

  if (allFeatures.length === 0) {
    console.log('\n⚠️  No features downloaded. The BLM API may be unavailable.');
    console.log('   Try again later or check https://gbp-blm-egis.hub.arcgis.com/');
  } else {
    console.log('\n✅ Download complete!');
    console.log(`\nNext steps:`);
    console.log(`  1. Import the data: pnpm run import:blm -- --file ${combinedFile} --truncate`);
    console.log(`  2. Or import a specific state: pnpm run import:blm -- --file ${join(options.outputDir, 'blm-az.geojson')} --truncate`);
  }
};

// Run the script
main().catch((error) => {
  console.error('\n❌ Download failed:', error.message);
  process.exit(1);
});