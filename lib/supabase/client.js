/**
 * Supabase Client Configuration
 *
 * SERVER-SIDE ONLY - Do not import this in client components!
 * All Supabase calls must go through API routes.
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

/**
 * Creates a Supabase client for server-side use
 * @param {Object} options - Configuration options
 * @param {boolean} [options.useServiceRole=false] - Whether to use the service role key
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const createServerClient = ({ useServiceRole = false } = {}) => {
  validateEnvironment();

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
export const getSupabaseUrl = () => {
  validateEnvironment();
  return SUPABASE_URL;
};

/**
 * Checks if Supabase is properly configured
 * @returns {boolean} True if all required environment variables are set
 */
export const isSupabaseConfigured = () => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};

export default createServerClient;