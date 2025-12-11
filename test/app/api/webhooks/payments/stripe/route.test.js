/**
 * Tests for Stripe Webhook API endpoint
 * Using Vitest for testing (following project conventions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// Mock Supabase client with proper chaining
const createMockSupabaseClient = () => {
  const mockClient = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
  };

  // Set up chaining - each method returns the mock client
  mockClient.from.mockReturnValue(mockClient);
  mockClient.select.mockReturnValue(mockClient);
  mockClient.eq.mockReturnValue(mockClient);
  mockClient.update.mockReturnValue(mockClient);
  mockClient.upsert.mockReturnValue(mockClient);
  mockClient.insert.mockReturnValue(mockClient);
  // single() is the terminal method that returns the result
  mockClient.single.mockResolvedValue({ data: null, error: null });

  return mockClient;
};

let mockSupabaseClient;

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
  default: vi.fn(() => mockSupabaseClient),
}));

/**
 * Helper function to generate a valid Stripe webhook signature
 * @param {string} payload - The raw request body
 * @param {string} secret - The webhook signing secret
 * @param {number} timestamp - Unix timestamp
 * @returns {string} The Stripe-Signature header value
 */
const generateStripeSignature = (payload, secret, timestamp = Math.floor(Date.now() / 1000)) => {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
};

describe('Stripe Webhook API Route', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret_key_12345';

  // Mock Stripe events
  const mockCheckoutSessionCompleted = {
    id: 'evt_test_checkout_completed',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_session_123',
        customer: 'cus_test_customer_123',
        customer_email: 'test@example.com',
        subscription: 'sub_test_subscription_123',
        metadata: {
          user_id: 'user-uuid-123',
        },
        mode: 'subscription',
        payment_status: 'paid',
      },
    },
  };

  const mockInvoicePaid = {
    id: 'evt_test_invoice_paid',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test_invoice_123',
        customer: 'cus_test_customer_123',
        subscription: 'sub_test_subscription_123',
        status: 'paid',
        amount_paid: 999,
        currency: 'usd',
        lines: {
          data: [
            {
              price: {
                id: 'price_1SdCHcILlMKSylYEArIqU52v',
                product: 'prod_TaN0ld45TuZARW',
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              },
            },
          ],
        },
      },
    },
  };

  const mockInvoicePaymentFailed = {
    id: 'evt_test_invoice_failed',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test_invoice_failed_123',
        customer: 'cus_test_customer_123',
        subscription: 'sub_test_subscription_123',
        status: 'open',
        attempt_count: 1,
      },
    },
  };

  const mockCustomerSubscriptionUpdated = {
    id: 'evt_test_subscription_updated',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_test_subscription_123',
        customer: 'cus_test_customer_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [
            {
              price: {
                id: 'price_1SdCHcILlMKSylYEArIqU52v',
                product: 'prod_TaN0ld45TuZARW',
              },
            },
          ],
        },
      },
    },
  };

  const mockCustomerSubscriptionDeleted = {
    id: 'evt_test_subscription_deleted',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_test_subscription_123',
        customer: 'cus_test_customer_123',
        status: 'canceled',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_secret_key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    // Create fresh mock client for each test
    mockSupabaseClient = createMockSupabaseClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('POST /api/webhooks/payments/stripe', () => {
    describe('Signature Verification', () => {
      it('should return 400 when stripe-signature header is missing', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: JSON.stringify(mockCheckoutSessionCompleted),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing stripe-signature header');
      });

      it('should return 400 when signature is invalid', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);
        // Use a current timestamp but wrong signature (must be 64 hex chars)
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const invalidSignature = `t=${currentTimestamp},v1=${'a'.repeat(64)}`;

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': invalidSignature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid signature');
      });

      it('should return 400 when signature timestamp is too old', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);
        // Timestamp from 10 minutes ago (beyond 5 minute tolerance)
        const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET, oldTimestamp);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Timestamp outside tolerance');
      });

      it('should accept valid signature', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123', stripe_customer_id: 'cus_test_customer_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
      });
    });

    describe('Event: checkout.session.completed', () => {
      it('should update user subscription status on successful checkout', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
        expect(mockSupabaseClient.update).toHaveBeenCalled();
      });

      it('should store stripe customer ID in user profile', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        await POST(request);

        expect(mockSupabaseClient.update).toHaveBeenCalledWith(
          expect.objectContaining({
            stripe_customer_id: 'cus_test_customer_123',
          })
        );
      });
    });

    describe('Event: invoice.paid', () => {
      it('should update subscription period on invoice paid', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123', stripe_customer_id: 'cus_test_customer_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockInvoicePaid);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
      });
    });

    describe('Event: invoice.payment_failed', () => {
      it('should mark subscription as past_due on payment failure', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123', stripe_customer_id: 'cus_test_customer_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockInvoicePaymentFailed);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
        expect(mockSupabaseClient.update).toHaveBeenCalledWith(
          expect.objectContaining({
            subscription_status: 'past_due',
          })
        );
      });
    });

    describe('Event: customer.subscription.updated', () => {
      it('should update subscription status and period', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123', stripe_customer_id: 'cus_test_customer_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCustomerSubscriptionUpdated);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
        expect(mockSupabaseClient.update).toHaveBeenCalledWith(
          expect.objectContaining({
            subscription_status: 'active',
          })
        );
      });
    });

    describe('Event: customer.subscription.deleted', () => {
      it('should mark subscription as canceled', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123', stripe_customer_id: 'cus_test_customer_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCustomerSubscriptionDeleted);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
        expect(mockSupabaseClient.update).toHaveBeenCalledWith(
          expect.objectContaining({
            subscription_status: 'canceled',
          })
        );
      });

      it('should reset subscription tier to free', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123', stripe_customer_id: 'cus_test_customer_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCustomerSubscriptionDeleted);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        await POST(request);

        expect(mockSupabaseClient.update).toHaveBeenCalledWith(
          expect.objectContaining({
            subscription_tier: 'free',
          })
        );
      });
    });

    describe('Unhandled Events', () => {
      it('should acknowledge unhandled event types', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const unhandledEvent = {
          id: 'evt_test_unhandled',
          type: 'payment_intent.created',
          data: {
            object: {},
          },
        };

        const payload = JSON.stringify(unhandledEvent);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when database update fails', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        // First call for finding user succeeds
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: { id: 'user-uuid-123' },
            error: null,
          })
          // Second call for update fails
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Database error' },
          });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to process webhook');
      });

      it('should return 500 when webhook secret is not configured', async () => {
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
        vi.resetModules();

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': 't=123,v1=abc',
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Webhook secret not configured');
      });

      it('should return 400 when request body is invalid JSON', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const invalidPayload = 'not valid json';
        const signature = generateStripeSignature(invalidPayload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: invalidPayload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
      });
    });

    describe('User Lookup', () => {
      it('should find user by stripe_customer_id', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123', stripe_customer_id: 'cus_test_customer_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCustomerSubscriptionUpdated);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        await POST(request);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
          'stripe_customer_id',
          'cus_test_customer_123'
        );
      });

      it('should find user by metadata user_id in checkout session', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'user-uuid-123' },
          error: null,
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCheckoutSessionCompleted);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        await POST(request);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'user-uuid-123');
      });

      it('should return 404 when user is not found', async () => {
        vi.resetModules();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' },
        });

        const { POST } = await import('@/app/api/webhooks/payments/stripe/route.js');

        const payload = JSON.stringify(mockCustomerSubscriptionUpdated);
        const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

        const request = new Request('http://localhost:3000/api/webhooks/payments/stripe', {
          method: 'POST',
          body: payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('User not found');
      });
    });
  });

  describe('HTTP Methods', () => {
    it('should only allow POST method', async () => {
      vi.resetModules();
      const routeModule = await import('@/app/api/webhooks/payments/stripe/route.js');

      // GET should not be exported
      expect(routeModule.GET).toBeUndefined();
    });
  });
});