/**
 * Supabase Client Configuration
 *
 * This module provides Supabase client instances for both browser and server contexts.
 * It implements a singleton pattern for the browser client to prevent multiple instances.
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Validates that required environment variables are set
 * @throws {Error} If required environment variables are missing
 */
const validateEnvironment = () => {
  if (!SUPABASE_URL) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
        'Please set it in your .env file.'
    );
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
        'Please set it in your .env file.'
    );
  }
};

// Validate on module load
validateEnvironment();

// Singleton instance for browser client
let browserClient = null;

/**
 * Creates or returns the singleton Supabase client for browser use
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const createBrowserClient = () => {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      headers: {
        'x-client-info': 'parklookup-web',
      },
    },
  });

  return browserClient;
};

/**
 * Creates a Supabase client for server-side use
 * @param {Object} options - Configuration options
 * @param {boolean} [options.useServiceRole=false] - Whether to use the service role key
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const createServerClient = ({ useServiceRole = false } = {}) => {
  const key = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;

  if (useServiceRole && !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
        'This is required for server-side operations with elevated privileges.'
    );
  }

  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-client-info': 'parklookup-server',
      },
    },
  });
};

/**
 * Gets the Supabase URL from environment
 * @returns {string} The Supabase project URL
 */
export const getSupabaseUrl = () => SUPABASE_URL;

/**
 * Checks if Supabase is properly configured
 * @returns {boolean} True if all required environment variables are set
 */
export const isSupabaseConfigured = () => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};

/**
 * Gets the browser client instance (alias for createBrowserClient)
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const supabase = createBrowserClient();

export default supabase;