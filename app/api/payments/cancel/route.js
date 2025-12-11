/**
 * Cancel Subscription API Route
 * POST /api/payments/cancel - Cancel the user's subscription
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
 * POST /api/payments/cancel
 * Cancel the user's subscription at period end
 */
export async function POST(request) {
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

  // Get user profile with Stripe subscription ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
  }

  // Initialize Stripe
  const stripe = new Stripe(stripeSecretKey);

  try {
    // Cancel subscription at period end (user keeps access until end of billing period)
    const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Verify the cancellation was successful before updating database
    if (!subscription.cancel_at_period_end) {
      console.error('Stripe did not confirm cancellation for subscription:', profile.stripe_subscription_id);
      return NextResponse.json({ error: 'Failed to confirm subscription cancellation' }, { status: 500 });
    }

    // Safely convert period end timestamp
    let periodEndIso = null;
    if (subscription.current_period_end && subscription.current_period_end > 0) {
      try {
        const periodEndDate = new Date(subscription.current_period_end * 1000);
        if (!isNaN(periodEndDate.getTime())) {
          periodEndIso = periodEndDate.toISOString();
        }
      } catch (dateError) {
        console.error('Error converting period end date:', dateError);
      }
    }

    // Update profile with cancellation status only after Stripe confirms
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'canceling',
        subscription_period_end: periodEndIso,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile after cancellation:', updateError);
      // Don't fail the request - Stripe cancellation succeeded
    }

    console.log(`Subscription ${subscription.id} scheduled for cancellation for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancelAt: periodEndIso,
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    
    // Provide more specific error messages
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json({
        error: 'Invalid subscription. It may have already been canceled.'
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}