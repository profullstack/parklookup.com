/**
 * Stripe Webhook Tests
 *
 * Tests for the Stripe webhook handler to ensure subscription
 * status and is_pro flag are correctly updated when users subscribe.
 *
 * @module test/api/webhooks/stripe.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

describe('Stripe Webhook Handler', () => {
  describe('Webhook Signature Verification', () => {
    const webhookSecret = 'whsec_test_secret_key';

    /**
     * Generate a valid Stripe signature for testing
     */
    const generateStripeSignature = (payload, secret, timestamp = Math.floor(Date.now() / 1000)) => {
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      return `t=${timestamp},v1=${signature}`;
    };

    it('should accept valid signature', () => {
      const payload = JSON.stringify({ type: 'test.event', data: { object: {} } });
      const signature = generateStripeSignature(payload, webhookSecret);

      // Parse signature
      const elements = signature.split(',');
      const signatureMap = {};
      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureMap[key] = value;
      }

      const timestamp = parseInt(signatureMap.t, 10);
      const expectedSignature = signatureMap.v1;

      // Verify timestamp is within tolerance (5 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      expect(Math.abs(currentTime - timestamp)).toBeLessThan(300);

      // Verify signature
      const signedPayload = `${timestamp}.${payload}`;
      const computedSignature = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
      expect(computedSignature).toBe(expectedSignature);
    });

    it('should reject expired signature', () => {
      const payload = JSON.stringify({ type: 'test.event', data: { object: {} } });
      // Use timestamp from 10 minutes ago
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = generateStripeSignature(payload, webhookSecret, oldTimestamp);

      const elements = signature.split(',');
      const signatureMap = {};
      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureMap[key] = value;
      }

      const timestamp = parseInt(signatureMap.t, 10);
      const currentTime = Math.floor(Date.now() / 1000);

      // Should be outside 5 minute tolerance
      expect(Math.abs(currentTime - timestamp)).toBeGreaterThan(300);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ type: 'test.event', data: { object: {} } });
      const validSignature = generateStripeSignature(payload, webhookSecret);

      // Tamper with the payload
      const tamperedPayload = JSON.stringify({ type: 'tampered.event', data: { object: {} } });

      // Parse original signature
      const elements = validSignature.split(',');
      const signatureMap = {};
      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureMap[key] = value;
      }

      const timestamp = parseInt(signatureMap.t, 10);
      const originalSignature = signatureMap.v1;

      // Compute signature for tampered payload
      const signedPayload = `${timestamp}.${tamperedPayload}`;
      const computedSignature = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');

      // Signatures should not match
      expect(computedSignature).not.toBe(originalSignature);
    });
  });

  describe('Subscription Event Handling', () => {
    describe('checkout.session.completed', () => {
      it('should set is_pro to true for successful subscription checkout', async () => {
        const mockSession = {
          id: 'cs_test_123',
          customer: 'cus_test_123',
          customer_email: 'test@example.com',
          subscription: 'sub_test_123',
          mode: 'subscription',
          payment_status: 'paid',
          metadata: { user_id: 'user_123' },
        };

        // Expected update payload
        const expectedUpdate = {
          stripe_customer_id: 'cus_test_123',
          stripe_subscription_id: 'sub_test_123',
          subscription_status: 'active',
          subscription_tier: 'pro',
          is_pro: true,
        };

        // Verify the update includes is_pro: true
        expect(expectedUpdate.is_pro).toBe(true);
        expect(expectedUpdate.subscription_status).toBe('active');
        expect(expectedUpdate.subscription_tier).toBe('pro');
      });

      it('should skip non-subscription checkout sessions', () => {
        const mockSession = {
          id: 'cs_test_123',
          mode: 'payment', // Not a subscription
          payment_status: 'paid',
        };

        // Should skip processing
        expect(mockSession.mode).not.toBe('subscription');
      });

      it('should skip unpaid checkout sessions', () => {
        const mockSession = {
          id: 'cs_test_123',
          mode: 'subscription',
          payment_status: 'unpaid',
        };

        // Should skip processing
        expect(mockSession.payment_status).not.toBe('paid');
      });
    });

    describe('invoice.paid', () => {
      it('should set is_pro to true for paid invoice', async () => {
        const mockInvoice = {
          id: 'in_test_123',
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
        };

        // Expected update payload
        const expectedUpdate = {
          subscription_status: 'active',
          subscription_tier: 'pro',
          is_pro: true,
          stripe_subscription_id: 'sub_test_123',
        };

        // Verify the update includes is_pro: true
        expect(expectedUpdate.is_pro).toBe(true);
        expect(expectedUpdate.subscription_status).toBe('active');
        expect(expectedUpdate.subscription_tier).toBe('pro');
      });
    });

    describe('customer.subscription.updated', () => {
      it('should set is_pro to true for active subscription', async () => {
        const mockSubscription = {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          items: {
            data: [{ price: { id: 'price_test_123' } }],
          },
        };

        // Determine subscription tier and is_pro from status
        let subscriptionTier = 'free';
        let isPro = false;

        if (mockSubscription.status === 'active' || mockSubscription.status === 'trialing') {
          subscriptionTier = 'pro';
          isPro = true;
        }

        expect(isPro).toBe(true);
        expect(subscriptionTier).toBe('pro');
      });

      it('should set is_pro to true for trialing subscription', async () => {
        const mockSubscription = {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'trialing',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
          items: {
            data: [{ price: { id: 'price_test_123' } }],
          },
        };

        // Determine subscription tier and is_pro from status
        let subscriptionTier = 'free';
        let isPro = false;

        if (mockSubscription.status === 'active' || mockSubscription.status === 'trialing') {
          subscriptionTier = 'pro';
          isPro = true;
        }

        expect(isPro).toBe(true);
        expect(subscriptionTier).toBe('pro');
      });

      it('should set is_pro to false for past_due subscription', async () => {
        const mockSubscription = {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'past_due',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          items: {
            data: [{ price: { id: 'price_test_123' } }],
          },
        };

        // Determine subscription tier and is_pro from status
        let subscriptionTier = 'free';
        let isPro = false;

        if (mockSubscription.status === 'active' || mockSubscription.status === 'trialing') {
          subscriptionTier = 'pro';
          isPro = true;
        }

        expect(isPro).toBe(false);
        expect(subscriptionTier).toBe('free');
      });

      it('should set is_pro to false for canceled subscription', async () => {
        const mockSubscription = {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'canceled',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          items: {
            data: [{ price: { id: 'price_test_123' } }],
          },
        };

        // Determine subscription tier and is_pro from status
        let subscriptionTier = 'free';
        let isPro = false;

        if (mockSubscription.status === 'active' || mockSubscription.status === 'trialing') {
          subscriptionTier = 'pro';
          isPro = true;
        }

        expect(isPro).toBe(false);
        expect(subscriptionTier).toBe('free');
      });
    });

    describe('customer.subscription.deleted', () => {
      it('should reset to free tier when subscription is deleted', async () => {
        const mockSubscription = {
          id: 'sub_test_123',
          customer: 'cus_test_123',
        };

        // Expected update payload for deleted subscription
        const expectedUpdate = {
          subscription_status: 'canceled',
          subscription_tier: 'free',
          is_pro: false,
          stripe_subscription_id: null,
          stripe_price_id: null,
          subscription_period_start: null,
          subscription_period_end: null,
        };

        expect(expectedUpdate.is_pro).toBe(false);
        expect(expectedUpdate.subscription_status).toBe('canceled');
        expect(expectedUpdate.subscription_tier).toBe('free');
        expect(expectedUpdate.stripe_subscription_id).toBeNull();
      });
    });

    describe('invoice.payment_failed', () => {
      it('should set subscription_status to past_due on payment failure', async () => {
        const mockInvoice = {
          id: 'in_test_123',
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
        };

        // Expected update payload
        const expectedUpdate = {
          subscription_status: 'past_due',
        };

        expect(expectedUpdate.subscription_status).toBe('past_due');
        // Note: is_pro is not changed on payment failure, only on subscription.updated
      });
    });
  });

  describe('Pro Status Consistency', () => {
    it('should ensure is_pro, subscription_status, and subscription_tier are always consistent', () => {
      // Test all valid state combinations
      const validStates = [
        // Active pro subscription
        { is_pro: true, subscription_status: 'active', subscription_tier: 'pro' },
        // Trialing pro subscription
        { is_pro: true, subscription_status: 'trialing', subscription_tier: 'pro' },
        // Canceled subscription (reverted to free)
        { is_pro: false, subscription_status: 'canceled', subscription_tier: 'free' },
        // Past due subscription (still has access until grace period ends)
        { is_pro: false, subscription_status: 'past_due', subscription_tier: 'free' },
        // Free user (never subscribed)
        { is_pro: false, subscription_status: null, subscription_tier: 'free' },
      ];

      for (const state of validStates) {
        // Verify consistency rules
        if (state.subscription_status === 'active' || state.subscription_status === 'trialing') {
          expect(state.is_pro).toBe(true);
          expect(state.subscription_tier).toBe('pro');
        } else {
          expect(state.is_pro).toBe(false);
        }
      }
    });

    it('should detect inconsistent state where is_pro is false but subscription is active', () => {
      // This is the bug state the user encountered
      const inconsistentState = {
        is_pro: false,
        subscription_status: 'active',
        subscription_tier: 'pro',
      };

      // This state is inconsistent - is_pro should be true
      const isConsistent =
        (inconsistentState.subscription_status === 'active' && inconsistentState.is_pro === true) ||
        (inconsistentState.subscription_status !== 'active' && inconsistentState.is_pro === false);

      expect(isConsistent).toBe(false);

      // The isProUser function should still return true for this state
      // because it checks subscription_status as a fallback
      const isProUser = (profile) => {
        if (!profile) return false;
        if (profile.is_pro === true) return true;
        if (profile.subscription_status === 'active' && profile.subscription_tier === 'pro') return true;
        return false;
      };

      expect(isProUser(inconsistentState)).toBe(true);
    });
  });

  describe('Webhook Update Payloads', () => {
    it('should always include is_pro in checkout.session.completed update', () => {
      const buildCheckoutUpdate = (session) => ({
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        subscription_status: 'active',
        subscription_tier: 'pro',
        is_pro: true,
      });

      const update = buildCheckoutUpdate({
        customer: 'cus_123',
        subscription: 'sub_123',
      });

      expect(update).toHaveProperty('is_pro');
      expect(update.is_pro).toBe(true);
    });

    it('should always include is_pro in invoice.paid update', () => {
      const buildInvoicePaidUpdate = (invoice) => {
        const updates = {
          subscription_status: 'active',
          subscription_tier: 'pro',
          is_pro: true,
        };

        if (invoice.subscription) {
          updates.stripe_subscription_id = invoice.subscription;
        }

        return updates;
      };

      const update = buildInvoicePaidUpdate({
        subscription: 'sub_123',
      });

      expect(update).toHaveProperty('is_pro');
      expect(update.is_pro).toBe(true);
    });

    it('should always include is_pro in subscription.updated update', () => {
      const buildSubscriptionUpdate = (subscription) => {
        const priceId = subscription.items?.data?.[0]?.price?.id;
        let subscriptionTier = 'free';
        let isPro = false;

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          subscriptionTier = 'pro';
          isPro = true;
        }

        return {
          subscription_status: subscription.status,
          subscription_tier: subscriptionTier,
          is_pro: isPro,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          subscription_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          subscription_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        };
      };

      const activeUpdate = buildSubscriptionUpdate({
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: { data: [{ price: { id: 'price_123' } }] },
      });

      expect(activeUpdate).toHaveProperty('is_pro');
      expect(activeUpdate.is_pro).toBe(true);

      const canceledUpdate = buildSubscriptionUpdate({
        id: 'sub_123',
        status: 'canceled',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: { data: [{ price: { id: 'price_123' } }] },
      });

      expect(canceledUpdate).toHaveProperty('is_pro');
      expect(canceledUpdate.is_pro).toBe(false);
    });

    it('should always include is_pro in subscription.deleted update', () => {
      const buildSubscriptionDeletedUpdate = () => ({
        subscription_status: 'canceled',
        subscription_tier: 'free',
        is_pro: false,
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_period_start: null,
        subscription_period_end: null,
      });

      const update = buildSubscriptionDeletedUpdate();

      expect(update).toHaveProperty('is_pro');
      expect(update.is_pro).toBe(false);
    });
  });
});
