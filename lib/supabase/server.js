/**
 * Server-side Supabase Client
 *
 * This module provides Supabase client for server-side use only.
 * NO client-side Supabase access - all calls go through API routes.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Get environment variables at runtime (not at module load time)
 * This is important for Next.js build process where env vars may not be available
 */
const getSupabaseConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Creates a Supabase client for server-side use with service role
 * This bypasses RLS and should only be used in API routes
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const createServiceClient = () => {
  const config = getSupabaseConfig();

  if (!config.url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!config.serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createSupabaseClient(config.url, config.serviceRoleKey, {
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
  const config = getSupabaseConfig();

  if (!config.url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!config.anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createSupabaseClient(config.url, config.anonKey, {
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
export const getSupabaseUrl = () => getSupabaseConfig().url;

/**
 * Alias for createServiceClient for backward compatibility
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export const createClient = createServiceClient;

export default createServiceClient;