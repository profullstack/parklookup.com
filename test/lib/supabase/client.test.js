/**
 * Tests for Supabase client configuration
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  });

  describe('createBrowserClient', () => {
    it('should create a client with correct URL and anon key', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const { createBrowserClient } = await import('@/lib/supabase/client.js');

      const client = createBrowserClient();

      expect(createClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'test-anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: true,
          }),
        })
      );
      expect(client).toBeDefined();
    });

    it('should return the same instance on subsequent calls (singleton)', async () => {
      const { createBrowserClient } = await import('@/lib/supabase/client.js');

      const client1 = createBrowserClient();
      const client2 = createBrowserClient();

      expect(client1).toBe(client2);
    });
  });

  describe('createServerClient', () => {
    it('should create a server client with service role key when provided', async () => {
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

    it('should create a server client with anon key by default', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const { createServerClient } = await import('@/lib/supabase/client.js');

      createServerClient();

      expect(createClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'test-anon-key',
        expect.any(Object)
      );
    });
  });

  describe('Environment validation', () => {
    it('should throw error if SUPABASE_URL is not defined', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');

      // Re-import to trigger validation
      await expect(async () => {
        vi.resetModules();
        await import('@/lib/supabase/client.js');
      }).rejects.toThrow();

      // Restore
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    });

    it('should throw error if SUPABASE_ANON_KEY is not defined', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

      await expect(async () => {
        vi.resetModules();
        await import('@/lib/supabase/client.js');
      }).rejects.toThrow();

      // Restore
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    });
  });
});

describe('Supabase Helpers', () => {
  describe('getSupabaseUrl', () => {
    it('should return the Supabase URL from environment', async () => {
      const { getSupabaseUrl } = await import('@/lib/supabase/client.js');

      expect(getSupabaseUrl()).toBe('http://localhost:54321');
    });
  });

  describe('isSupabaseConfigured', () => {
    it('should return true when all required env vars are set', async () => {
      const { isSupabaseConfigured } = await import('@/lib/supabase/client.js');

      expect(isSupabaseConfigured()).toBe(true);
    });
  });
});