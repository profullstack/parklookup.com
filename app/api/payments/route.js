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

  console.log('Profile data for payments:', {
    userId: user.id,
    stripeCustomerId: profile?.stripe_customer_id,
    stripeSubscriptionId: profile?.stripe_subscription_id,
    subscriptionStatus: profile?.subscription_status,
    subscriptionTier: profile?.subscription_tier,
  });

  // If no Stripe customer ID, return empty data
  if (!profile?.stripe_customer_id) {
    console.log('No Stripe customer ID found for user:', user.id);
    return NextResponse.json({
      subscription: null,
      payments: [],
      hasStripeCustomer: false,
    });
  }

  // Initialize Stripe
  const stripe = new Stripe(stripeSecretKey);

  try {
    // Get the most recent active subscription from Stripe directly
    // This ensures we always show the current subscription, even if the DB is out of sync
    let subscription = null;
    
    // First, try to get all subscriptions for this customer and find the active one
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1,
      expand: ['data.latest_invoice', 'data.discount', 'data.discount.coupon', 'data.latest_invoice.discount', 'data.latest_invoice.total_discount_amounts'],
    });
    
    let stripeSubscription = subscriptions.data[0];
    
    console.log('Raw Stripe subscription response:', JSON.stringify(stripeSubscription, null, 2));
    
    // If no active subscription found, try to get the one from the database
    if (!stripeSubscription && profile.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
          expand: ['latest_invoice', 'discount', 'discount.coupon'],
        });
      } catch (subError) {
        console.error('Error fetching subscription from DB ID:', subError);
        // Subscription might have been deleted, continue without it
      }
    }
    
    // Process the subscription if we found one
    if (stripeSubscription) {
      // Determine if user should be pro based on subscription status
      const isActiveSub = stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing';
      
      // Update the database with the correct subscription info if anything is out of sync
      const needsUpdate =
        stripeSubscription.id !== profile.stripe_subscription_id ||
        stripeSubscription.status !== profile.subscription_status ||
        (isActiveSub && profile.subscription_tier !== 'pro');
      
      if (needsUpdate) {
        console.log(`Syncing subscription data in DB:`, {
          oldSubId: profile.stripe_subscription_id,
          newSubId: stripeSubscription.id,
          oldStatus: profile.subscription_status,
          newStatus: stripeSubscription.status,
          oldTier: profile.subscription_tier,
          newTier: isActiveSub ? 'pro' : 'free',
        });
        await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: stripeSubscription.id,
            subscription_status: stripeSubscription.status,
            subscription_tier: isActiveSub ? 'pro' : 'free',
            is_pro: isActiveSub,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }
      
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
      
      // Get base price from the subscription item
      const baseAmount = stripeSubscription.items.data[0]?.price?.unit_amount || 0;
      
      // Check if there's an active discount/coupon on the subscription
      let discount = stripeSubscription.discount;
      
      // If no discount on subscription, check the latest invoice for discount info
      const latestInvoice = stripeSubscription.latest_invoice;
      if (!discount && latestInvoice && typeof latestInvoice === 'object') {
        // Check if invoice has discount amounts
        if (latestInvoice.total_discount_amounts && latestInvoice.total_discount_amounts.length > 0) {
          const invoiceDiscount = latestInvoice.total_discount_amounts[0];
          console.log('Found discount on invoice:', invoiceDiscount);
        }
        // Check if invoice has a discount object
        if (latestInvoice.discount) {
          discount = latestInvoice.discount;
          console.log('Using discount from invoice:', discount);
        }
      }
      
      const hasDiscount = !!discount;
      const discountPercent = discount?.coupon?.percent_off || null;
      const discountAmount = discount?.coupon?.amount_off || null;
      
      // Also check if the amount paid differs from base amount (indicates a discount was applied)
      const invoiceAmountPaid = latestInvoice && typeof latestInvoice === 'object' ? latestInvoice.amount_paid : null;
      const hasImpliedDiscount = invoiceAmountPaid !== null && invoiceAmountPaid < baseAmount;
      
      console.log('Discount detection:', {
        hasDiscount,
        hasImpliedDiscount,
        baseAmount,
        invoiceAmountPaid,
        discountPercent,
        discountAmount,
        discountObject: discount,
      });
      
      // Calculate the actual amount after discount
      let actualAmountPaid = baseAmount;
      if (hasDiscount) {
        if (discountPercent) {
          actualAmountPaid = Math.round(baseAmount * (1 - discountPercent / 100));
        } else if (discountAmount) {
          actualAmountPaid = Math.max(0, baseAmount - discountAmount);
        }
      }
      
      // If we have a latest invoice with amount_paid, use that as it's the most accurate
      if (invoiceAmountPaid !== null && invoiceAmountPaid > 0) {
        actualAmountPaid = invoiceAmountPaid;
      }
      
      // If there's an implied discount (amount paid < base), calculate the discount info
      let effectiveDiscount = null;
      if (hasDiscount) {
        effectiveDiscount = {
          percentOff: discountPercent,
          amountOff: discountAmount,
          couponName: discount?.coupon?.name || discount?.coupon?.id,
          duration: discount?.coupon?.duration,
          durationInMonths: discount?.coupon?.duration_in_months,
        };
      } else if (hasImpliedDiscount) {
        // Calculate implied discount from the price difference
        const impliedDiscountAmount = baseAmount - invoiceAmountPaid;
        const impliedDiscountPercent = Math.round((impliedDiscountAmount / baseAmount) * 100);
        effectiveDiscount = {
          percentOff: impliedDiscountPercent,
          amountOff: impliedDiscountAmount,
          couponName: 'Discount Applied',
          duration: 'unknown',
          durationInMonths: null,
        };
        console.log('Using implied discount:', effectiveDiscount);
      }
      
      console.log('Stripe subscription data:', {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at,
        current_period_end: stripeSubscription.current_period_end,
        baseAmount,
        actualAmountPaid,
        hasDiscount,
        hasImpliedDiscount,
        discountPercent,
        discountAmount,
        couponName: discount?.coupon?.name || discount?.coupon?.id,
        effectiveDiscount,
      });

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
        discount: effectiveDiscount,
      };
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

    // Determine isPro based on the actual Stripe subscription status (not just DB)
    const isPro = stripeSubscription && (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing');
    
    return NextResponse.json({
      subscription,
      payments,
      hasStripeCustomer: true,
      isPro,
    });
  } catch (error) {
    console.error('Error fetching payment data:', error);
    return NextResponse.json({ error: 'Failed to fetch payment data' }, { status: 500 });
  }
}