/**
 * Tests for Pro Status Utility
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isProUser, isUserProFromDb, getProStatusFields } from '@/lib/subscription/pro-status';

describe('Pro Status Utility', () => {
  describe('isProUser', () => {
    describe('with null/undefined profile', () => {
      it('should return false for null profile', () => {
        expect(isProUser(null)).toBe(false);
      });

      it('should return false for undefined profile', () => {
        expect(isProUser(undefined)).toBe(false);
      });
    });

    describe('with is_pro flag', () => {
      it('should return true when is_pro is true', () => {
        expect(isProUser({ is_pro: true })).toBe(true);
      });

      it('should return false when is_pro is false', () => {
        expect(isProUser({ is_pro: false })).toBe(false);
      });

      it('should return false when is_pro is null', () => {
        expect(isProUser({ is_pro: null })).toBe(false);
      });

      it('should return false when is_pro is undefined', () => {
        expect(isProUser({})).toBe(false);
      });

      it('should return false when is_pro is truthy but not true', () => {
        expect(isProUser({ is_pro: 1 })).toBe(false);
        expect(isProUser({ is_pro: 'true' })).toBe(false);
      });
    });

    describe('with subscription_status and subscription_tier', () => {
      it('should return true when subscription_status is active and subscription_tier is pro', () => {
        expect(
          isProUser({
            subscription_status: 'active',
            subscription_tier: 'pro',
          })
        ).toBe(true);
      });

      it('should return false when subscription_status is active but subscription_tier is free', () => {
        expect(
          isProUser({
            subscription_status: 'active',
            subscription_tier: 'free',
          })
        ).toBe(false);
      });

      it('should return false when subscription_status is past_due and subscription_tier is pro', () => {
        expect(
          isProUser({
            subscription_status: 'past_due',
            subscription_tier: 'pro',
          })
        ).toBe(false);
      });

      it('should return false when subscription_status is canceled and subscription_tier is pro', () => {
        expect(
          isProUser({
            subscription_status: 'canceled',
            subscription_tier: 'pro',
          })
        ).toBe(false);
      });

      it('should return false when only subscription_status is provided', () => {
        expect(isProUser({ subscription_status: 'active' })).toBe(false);
      });

      it('should return false when only subscription_tier is provided', () => {
        expect(isProUser({ subscription_tier: 'pro' })).toBe(false);
      });
    });

    describe('with combined flags', () => {
      it('should return true when is_pro is true regardless of subscription fields', () => {
        expect(
          isProUser({
            is_pro: true,
            subscription_status: 'canceled',
            subscription_tier: 'free',
          })
        ).toBe(true);
      });

      it('should return true when is_pro is false but subscription is active pro', () => {
        expect(
          isProUser({
            is_pro: false,
            subscription_status: 'active',
            subscription_tier: 'pro',
          })
        ).toBe(true);
      });

      it('should return false when is_pro is false and subscription is not active pro', () => {
        expect(
          isProUser({
            is_pro: false,
            subscription_status: 'past_due',
            subscription_tier: 'pro',
          })
        ).toBe(false);
      });
    });
  });

  describe('isUserProFromDb', () => {
    let mockSupabase;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    it('should return false when supabase is null', async () => {
      expect(await isUserProFromDb(null, 'user-123')).toBe(false);
    });

    it('should return false when userId is null', async () => {
      expect(await isUserProFromDb(mockSupabase, null)).toBe(false);
    });

    it('should return false when userId is undefined', async () => {
      expect(await isUserProFromDb(mockSupabase, undefined)).toBe(false);
    });

    it('should return true when profile has is_pro true', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { is_pro: true, subscription_status: null, subscription_tier: null },
        error: null,
      });

      expect(await isUserProFromDb(mockSupabase, 'user-123')).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.select).toHaveBeenCalledWith(
        'is_pro, subscription_status, subscription_tier'
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should return true when profile has active pro subscription', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { is_pro: false, subscription_status: 'active', subscription_tier: 'pro' },
        error: null,
      });

      expect(await isUserProFromDb(mockSupabase, 'user-123')).toBe(true);
    });

    it('should return false when profile has is_pro false and no active subscription', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { is_pro: false, subscription_status: 'canceled', subscription_tier: 'free' },
        error: null,
      });

      expect(await isUserProFromDb(mockSupabase, 'user-123')).toBe(false);
    });

    it('should return false when database returns error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      expect(await isUserProFromDb(mockSupabase, 'user-123')).toBe(false);
    });

    it('should return false when profile is not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      expect(await isUserProFromDb(mockSupabase, 'user-123')).toBe(false);
    });

    it('should return false when database throws exception', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Connection failed'));

      expect(await isUserProFromDb(mockSupabase, 'user-123')).toBe(false);
    });
  });

  describe('getProStatusFields', () => {
    it('should return the correct field list', () => {
      expect(getProStatusFields()).toBe('is_pro, subscription_status, subscription_tier');
    });

    it('should include is_pro field', () => {
      expect(getProStatusFields()).toContain('is_pro');
    });

    it('should include subscription_status field', () => {
      expect(getProStatusFields()).toContain('subscription_status');
    });

    it('should include subscription_tier field', () => {
      expect(getProStatusFields()).toContain('subscription_tier');
    });
  });
});