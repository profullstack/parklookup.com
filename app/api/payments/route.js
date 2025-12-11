/**
 * Payments API Route
 * GET /api/payments - Get payment history and subscription info
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Helper to get user from authorization header
 */
async function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'No authorization token provided' };
  }

  const token = authHeader.substring(7);
  const supabase = createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user, error: null };
}

/**
 * GET /api/payments
 * Get user's payment history and subscription information
 */
export async function GET(request) {
  // Check Stripe configuration
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY not configured');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  // Get authenticated user
  const { user, error: authError } = await getUserFromToken(request);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient({ useServiceRole: true });

  // Get user profile with Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status, subscription_tier, subscription_period_end')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }

  // If no Stripe customer ID, return empty data
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({
      subscription: null,
      payments: [],
      hasStripeCustomer: false,
    });
  }

  // Initialize Stripe
  const stripe = new Stripe(stripeSecretKey);

  try {
    // Get subscription details if exists
    let subscription = null;
    if (profile.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
          expand: ['latest_invoice', 'discount'],
        });
        
        // Safely convert timestamps - they must be valid positive numbers
        const currentPeriodStart = stripeSubscription.current_period_start && stripeSubscription.current_period_start > 0
          ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
          : null;
        const currentPeriodEnd = stripeSubscription.current_period_end && stripeSubscription.current_period_end > 0
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : null;
        const canceledAt = stripeSubscription.canceled_at && stripeSubscription.canceled_at > 0
          ? new Date(stripeSubscription.canceled_at * 1000).toISOString()
          : null;
        
        // Get the actual amount paid from the latest invoice (includes discounts)
        const latestInvoice = stripeSubscription.latest_invoice;
        const actualAmountPaid = latestInvoice?.amount_paid ?? stripeSubscription.items.data[0]?.price?.unit_amount ?? 0;
        const baseAmount = stripeSubscription.items.data[0]?.price?.unit_amount || 0;
        
        // Check if there's an active discount/coupon
        const discount = stripeSubscription.discount;
        const hasDiscount = !!discount;
        const discountPercent = discount?.coupon?.percent_off || null;
        const discountAmount = discount?.coupon?.amount_off || null;
        
        subscription = {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt,
          plan: {
            amount: actualAmountPaid, // Show actual amount paid (after discount)
            baseAmount, // Original price before discount
            currency: stripeSubscription.items.data[0]?.price?.currency || 'usd',
            interval: stripeSubscription.items.data[0]?.price?.recurring?.interval || 'month',
          },
          discount: hasDiscount ? {
            percentOff: discountPercent,
            amountOff: discountAmount,
            couponName: discount?.coupon?.name || discount?.coupon?.id,
          } : null,
        };
      } catch (subError) {
        console.error('Error fetching subscription:', subError);
        // Subscription might have been deleted, continue without it
      }
    }

    // Get payment history (invoices)
    const invoices = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: 20,
    });

    const payments = invoices.data.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000).toISOString(),
      invoicePdf: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      description: invoice.lines.data[0]?.description || 'Subscription payment',
    }));

    return NextResponse.json({
      subscription,
      payments,
      hasStripeCustomer: true,
      isPro: profile.subscription_tier === 'pro' && profile.subscription_status === 'active',
    });
  } catch (error) {
    console.error('Error fetching payment data:', error);
    return NextResponse.json({ error: 'Failed to fetch payment data' }, { status: 500 });
  }
}