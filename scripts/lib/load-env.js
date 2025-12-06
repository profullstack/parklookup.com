/**
 * Load environment variables from .env file
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Loads environment variables from .env file
 * @returns {Object} Environment variables
 */
export const loadEnv = () => {
  const envPath = resolve(__dirname, '..', '..', '.env');

  if (!existsSync(envPath)) {
    console.warn('⚠️  No .env file found at', envPath);
    return {};
  }

  const envContent = readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach((line) => {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) return;

    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      env[key] = value;
      // Also set in process.env
      process.env[key] = value;
    }
  });

  return env;
};

export default loadEnv;