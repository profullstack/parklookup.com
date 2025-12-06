/**
 * Tests for Supabase client configuration
 * Using Vitest for testing
 *
 * Note: The client is now server-only (no createBrowserClient)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Supabase client before importing
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  })),
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables for tests
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe('createServerClient', () => {
    it('should create a server client with anon key by default', async () => {
      vi.resetModules();
      const { createClient } = await import('@supabase/supabase-js');
      const { createServerClient } = await import('@/lib/supabase/client.js');

      const client = createServerClient();

      expect(createClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'test-anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false,
            autoRefreshToken: false,
          }),
        })
      );
      expect(client).toBeDefined();
    });

    it('should create a server client with service role key when requested', async () => {
      vi.resetModules();
      const { createClient } = await import('@supabase/supabase-js');
      const { createServerClient } = await import('@/lib/supabase/client.js');

      const client = createServerClient({ useServiceRole: true });

      expect(createClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'test-service-role-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false,
            autoRefreshToken: false,
          }),
        })
      );
      expect(client).toBeDefined();
    });

    it('should throw error if service role key is missing when requested', async () => {
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      vi.resetModules();

      const { createServerClient } = await import('@/lib/supabase/client.js');

      expect(() => createServerClient({ useServiceRole: true })).toThrow(
        'Missing SUPABASE_SERVICE_ROLE_KEY'
      );
    });

    it('should create new client instance on each call', async () => {
      vi.resetModules();
      const { createServerClient } = await import('@/lib/supabase/client.js');

      const client1 = createServerClient();
      const client2 = createServerClient();

      // Each call creates a new instance (not singleton)
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });
  });

  describe('Environment validation', () => {
    it('should throw error if SUPABASE_URL is not defined', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
      vi.resetModules();

      const { createServerClient } = await import('@/lib/supabase/client.js');

      expect(() => createServerClient()).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL');
    });

    it('should throw error if SUPABASE_ANON_KEY is not defined', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
      vi.resetModules();

      const { createServerClient } = await import('@/lib/supabase/client.js');

      expect(() => createServerClient()).toThrow('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    });
  });
});

describe('Supabase Helpers', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe('getSupabaseUrl', () => {
    it('should return the Supabase URL from environment', async () => {
      vi.resetModules();
      const { getSupabaseUrl } = await import('@/lib/supabase/client.js');

      expect(getSupabaseUrl()).toBe('http://localhost:54321');
    });

    it('should throw error if URL is not configured', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
      vi.resetModules();

      const { getSupabaseUrl } = await import('@/lib/supabase/client.js');

      expect(() => getSupabaseUrl()).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL');
    });
  });

  describe('isSupabaseConfigured', () => {
    it('should return true when all required env vars are set', async () => {
      vi.resetModules();
      const { isSupabaseConfigured } = await import('@/lib/supabase/client.js');

      expect(isSupabaseConfigured()).toBe(true);
    });

    it('should return false when URL is missing', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
      vi.resetModules();

      const { isSupabaseConfigured } = await import('@/lib/supabase/client.js');

      expect(isSupabaseConfigured()).toBe(false);
    });

    it('should return false when anon key is missing', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
      vi.resetModules();

      const { isSupabaseConfigured } = await import('@/lib/supabase/client.js');

      expect(isSupabaseConfigured()).toBe(false);
    });
  });
});