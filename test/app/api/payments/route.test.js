/**
 * Tests for Payments API endpoint
 * Using Vitest for testing (following project conventions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Stripe
const mockStripeSubscriptionsRetrieve = vi.fn();
const mockStripeInvoicesList = vi.fn();
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      subscriptions: {
        retrieve: mockStripeSubscriptionsRetrieve,
      },
      invoices: {
        list: mockStripeInvoicesList,
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

describe('Payments API Route', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: 'user-uuid-123',
    stripe_customer_id: 'cus_test_123',
    stripe_subscription_id: 'sub_test_123',
    subscription_status: 'active',
    subscription_period_end: '2024-02-15T00:00:00Z',
    is_pro: true,
  };

  const mockSubscription = {
    id: 'sub_test_123',
    status: 'active',
    current_period_start: 1704067200, // 2024-01-01
    current_period_end: 1706745600, // 2024-02-01
    cancel_at_period_end: false,
    canceled_at: null,
    items: {
      data: [
        {
          price: {
            unit_amount: 999,
            currency: 'usd',
            recurring: {
              interval: 'month',
            },
          },
        },
      ],
    },
  };

  const mockInvoices = {
    data: [
      {
        id: 'in_test_123',
        amount_paid: 999,
        currency: 'usd',
        status: 'paid',
        created: 1704067200,
        invoice_pdf: 'https://stripe.com/invoice.pdf',
        hosted_invoice_url: 'https://stripe.com/invoice',
        lines: {
          data: [{ description: 'Pro subscription' }],
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_secret_key');
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

    mockStripeSubscriptionsRetrieve.mockResolvedValue(mockSubscription);
    mockStripeInvoicesList.mockResolvedValue(mockInvoices);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('GET /api/payments', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
        });

        const response = await GET(request);
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

        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Fetching Payment Data', () => {
      it('should return subscription and payment history', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.subscription).toBeDefined();
        expect(data.payments).toBeDefined();
        expect(data.hasStripeCustomer).toBe(true);
      });

      it('should return empty data when user has no Stripe customer', async () => {
        vi.resetModules();
        mockSupabaseClient.single.mockResolvedValue({
          data: { ...mockProfile, stripe_customer_id: null },
          error: null,
        });

        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.subscription).toBeNull();
        expect(data.payments).toEqual([]);
        expect(data.hasStripeCustomer).toBe(false);
      });

      it('should format subscription data correctly', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.subscription.id).toBe('sub_test_123');
        expect(data.subscription.status).toBe('active');
        expect(data.subscription.plan.amount).toBe(999);
        expect(data.subscription.plan.currency).toBe('usd');
        expect(data.subscription.plan.interval).toBe('month');
      });

      it('should format payment history correctly', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.payments.length).toBe(1);
        expect(data.payments[0].id).toBe('in_test_123');
        expect(data.payments[0].amount).toBe(999);
        expect(data.payments[0].status).toBe('paid');
        expect(data.payments[0].invoicePdf).toBe('https://stripe.com/invoice.pdf');
      });

      it('should return cancelAtPeriodEnd when subscription is scheduled for cancellation', async () => {
        vi.resetModules();
        
        // Mock a subscription that's cancelled at period end
        const cancelledSubscription = {
          ...mockSubscription,
          cancel_at_period_end: true,
          canceled_at: 1705000000, // When the user clicked cancel
        };
        mockStripeSubscriptionsRetrieve.mockResolvedValue(cancelledSubscription);

        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.subscription.cancelAtPeriodEnd).toBe(true);
        expect(data.subscription.canceledAt).toBeDefined();
        expect(data.subscription.currentPeriodEnd).toBeDefined();
      });

      it('should return cancelAtPeriodEnd as false for active subscriptions', async () => {
        vi.resetModules();
        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.subscription.cancelAtPeriodEnd).toBe(false);
        expect(data.subscription.canceledAt).toBeNull();
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when STRIPE_SECRET_KEY is not configured', async () => {
        vi.stubEnv('STRIPE_SECRET_KEY', '');
        vi.resetModules();

        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Stripe not configured');
      });

      it('should return 500 when profile fetch fails', async () => {
        vi.resetModules();
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch profile');
      });

      it('should handle Stripe API errors gracefully', async () => {
        vi.resetModules();
        mockStripeInvoicesList.mockRejectedValue(new Error('Stripe API error'));

        const { GET } = await import('@/app/api/payments/route.js');

        const request = new Request('http://localhost:3000/api/payments', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch payment data');
      });
    });
  });
});