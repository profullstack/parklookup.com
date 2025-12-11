/**
 * Stripe Checkout API Route
 * POST /api/checkout - Create a Stripe checkout session for subscription
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Default price ID for Pro tier - can be overridden via environment variable
const DEFAULT_PRICE_ID =
  process.env.STRIPE_PRO_PRICE_ID || 'price_1SdCHcILlMKSylYEArIqU52v';

/**
 * POST /api/checkout
 * Create a Stripe checkout session for subscription upgrade
 */
export async function POST(request) {
  // Check Stripe configuration
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY not configured');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  // Get auth token from request headers
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const supabase = createServerClient({ useServiceRole: true });

  // Get authenticated user using the token
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error('Auth error:', authError?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { priceId = DEFAULT_PRICE_ID } = body;

  // Get user profile to check for existing Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  // Initialize Stripe
  const stripe = new Stripe(stripeSecretKey);

  // Build checkout session parameters
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const sessionParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/settings?checkout=success`,
    cancel_url: `${appUrl}/settings?checkout=cancelled`,
    metadata: {
      user_id: user.id,
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
      },
    },
  };

  // Use existing customer or create new one
  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  try {
    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Checkout session created for user ${user.id}: ${session.id}`);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}