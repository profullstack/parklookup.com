/**
 * Tests for Checkout API endpoint
 * Using Vitest for testing (following project conventions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Stripe
const mockStripeCheckoutSessionCreate = vi.fn();
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutSessionCreate,
        },
      },
    })),
  };
});

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
  default: vi.fn(() => mockSupabaseClient),
}));

describe('Checkout API Route', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    stripe_customer_id: null,
  };

  const mockCheckoutSession = {
    id: 'cs_test_session_123',
    url: 'https://checkout.stripe.com/pay/cs_test_session_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_secret_key');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    // Setup mock chain
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockResolvedValue({ data: mockProfile, error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockStripeCheckoutSessionCreate.mockResolvedValue(mockCheckoutSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('POST /api/checkout', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });

      it('should return 401 when token is invalid', async () => {
        vi.resetModules();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Checkout Session Creation', () => {
      it('should create checkout session with valid request', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_1SdCHcILlMKSylYEArIqU52v' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_session_123');
        expect(data.sessionId).toBe('cs_test_session_123');
      });

      it('should use default price ID when not provided', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalled();
      });

      it('should include user_id in metadata', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        await POST(request);

        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              user_id: 'user-uuid-123',
            }),
          })
        );
      });

      it('should use existing stripe_customer_id if available', async () => {
        vi.resetModules();
        mockSupabaseClient.single.mockResolvedValue({
          data: { ...mockProfile, stripe_customer_id: 'cus_existing_123' },
          error: null,
        });

        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        await POST(request);

        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            customer: 'cus_existing_123',
          })
        );
      });

      it('should use customer_email when no stripe_customer_id exists', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        await POST(request);

        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            customer_email: 'test@example.com',
          })
        );
      });

      it('should set correct success and cancel URLs', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        await POST(request);

        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            success_url: expect.stringContaining('/settings?checkout=success'),
            cancel_url: expect.stringContaining('/settings?checkout=cancelled'),
          })
        );
      });
    });

    describe('Coupon Code Support', () => {
      it('should apply valid coupon code to checkout session', async () => {
        vi.resetModules();
        vi.stubEnv('STRIPE_COUPON_50OFF', '50OFF');
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123', couponCode: '50OFF' }),
        });

        await POST(request);

        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            discounts: [{ coupon: '50OFF' }],
          })
        );
      });

      it('should handle lowercase coupon codes', async () => {
        vi.resetModules();
        vi.stubEnv('STRIPE_COUPON_50OFF', '50OFF');
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123', couponCode: '50off' }),
        });

        await POST(request);

        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            discounts: [{ coupon: '50OFF' }],
          })
        );
      });

      it('should not apply invalid coupon code', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123', couponCode: 'INVALID' }),
        });

        await POST(request);

        // Should not include discounts for invalid coupon
        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.not.objectContaining({
            discounts: expect.anything(),
          })
        );
      });

      it('should create checkout session without coupon when not provided', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        await POST(request);

        // Should not include discounts when no coupon provided
        const callArgs = mockStripeCheckoutSessionCreate.mock.calls[0][0];
        expect(callArgs.discounts).toBeUndefined();
      });

      it('should use environment variable for coupon ID mapping', async () => {
        vi.resetModules();
        vi.stubEnv('STRIPE_COUPON_50OFF', 'custom_coupon_id_from_stripe');
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123', couponCode: '50OFF' }),
        });

        await POST(request);

        expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            discounts: [{ coupon: 'custom_coupon_id_from_stripe' }],
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when Stripe API fails', async () => {
        vi.resetModules();
        mockStripeCheckoutSessionCreate.mockRejectedValue(new Error('Stripe API error'));

        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to create checkout session');
      });

      it('should return 500 when STRIPE_SECRET_KEY is not configured', async () => {
        vi.stubEnv('STRIPE_SECRET_KEY', '');
        vi.resetModules();

        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: JSON.stringify({ priceId: 'price_123' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Stripe not configured');
      });

      it('should return 400 when request body is invalid', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/checkout/route.js');

        const request = new Request('http://localhost:3000/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid_token',
          },
          body: 'invalid json',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
      });
    });
  });

  describe('HTTP Methods', () => {
    it('should only allow POST method', async () => {
      vi.resetModules();
      const routeModule = await import('@/app/api/checkout/route.js');

      // GET should not be exported
      expect(routeModule.GET).toBeUndefined();
    });
  });
});