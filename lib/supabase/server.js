/**
 * Server-side Supabase Client
 *
 * This module provides Supabase client for server-side use only.
 * NO client-side Supabase access - all calls go through API routes.
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const {SUPABASE_SERVICE_ROLE_KEY} = process.env;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Creates a Supabase client for server-side use with service role
 * This bypasses RLS and should only be used in API routes
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const createServiceClient = () => {
  if (!SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
 * Creates a Supabase client for server-side use with anon key
 * This respects RLS policies
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const createAnonClient = () => {
  if (!SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

export default createServiceClient;