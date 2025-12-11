/**
 * Tests for Cancel Subscription API endpoint
 * Using Vitest for testing (following project conventions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Stripe
const mockStripeSubscriptionsUpdate = vi.fn();
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      subscriptions: {
        update: mockStripeSubscriptionsUpdate,
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
  update: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
  default: vi.fn(() => mockSupabaseClient),
}));

describe('Cancel Subscription API Route', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: 'user-uuid-123',
    stripe_subscription_id: 'sub_test_123',
  };

  const mockCanceledSubscription = {
    id: 'sub_test_123',
    status: 'active',
    cancel_at_period_end: true,
    current_period_end: 1706745600, // 2024-02-01
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
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockResolvedValue({ data: mockProfile, error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockStripeSubscriptionsUpdate.mockResolvedValue(mockCanceledSubscription);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('POST /api/payments/cancel', () => {
    describe('Authentication', () => {
      it('should return 401 when authorization header is missing', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
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

        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer invalid_token',
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Canceling Subscription', () => {
      it('should cancel subscription successfully', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain('canceled at the end of the billing period');
        expect(data.cancelAt).toBeDefined();
      });

      it('should call Stripe with cancel_at_period_end: true', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        await POST(request);

        expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith('sub_test_123', {
          cancel_at_period_end: true,
        });
      });

      it('should update profile subscription status to canceling', async () => {
        vi.resetModules();
        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        await POST(request);

        expect(mockSupabaseClient.update).toHaveBeenCalledWith({
          subscription_status: 'canceling',
        });
      });

      it('should return 400 when user has no subscription', async () => {
        vi.resetModules();
        mockSupabaseClient.single.mockResolvedValue({
          data: { ...mockProfile, stripe_subscription_id: null },
          error: null,
        });

        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('No active subscription found');
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when STRIPE_SECRET_KEY is not configured', async () => {
        vi.stubEnv('STRIPE_SECRET_KEY', '');
        vi.resetModules();

        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await POST(request);
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

        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch profile');
      });

      it('should return 500 when Stripe API fails', async () => {
        vi.resetModules();
        mockStripeSubscriptionsUpdate.mockRejectedValue(new Error('Stripe API error'));

        const { POST } = await import('@/app/api/payments/cancel/route.js');

        const request = new Request('http://localhost:3000/api/payments/cancel', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token',
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to cancel subscription');
      });
    });
  });
});