/**
 * Stripe Webhook Handler
 * POST /api/webhooks/payments/stripe
 *
 * Handles Stripe webhook events for subscription management:
 * - checkout.session.completed: New subscription created
 * - invoice.paid: Subscription renewed
 * - invoice.payment_failed: Payment failed
 * - customer.subscription.updated: Subscription status changed
 * - customer.subscription.deleted: Subscription canceled
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Stripe signature tolerance in seconds (5 minutes)
const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verifies the Stripe webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe-Signature header value
 * @param {string} secret - Webhook signing secret
 * @returns {{ valid: boolean, error?: string }} Verification result
 */
const verifyStripeSignature = (payload, signature, secret) => {
  if (!signature) {
    return { valid: false, error: 'Missing stripe-signature header' };
  }

  // Parse signature header
  const elements = signature.split(',');
  const signatureMap = {};

  for (const element of elements) {
    const [key, value] = element.split('=');
    signatureMap[key] = value;
  }

  const timestamp = parseInt(signatureMap.t, 10);
  const expectedSignature = signatureMap.v1;

  if (!timestamp || !expectedSignature) {
    return { valid: false, error: 'Invalid signature format' };
  }

  // Check timestamp tolerance
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, error: 'Timestamp outside tolerance' };
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const computedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const computedBuffer = Buffer.from(computedSignature, 'hex');

  if (expectedBuffer.length !== computedBuffer.length) {
    return { valid: false, error: 'Invalid signature' };
  }

  if (!crypto.timingSafeEqual(expectedBuffer, computedBuffer)) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
};

/**
 * Finds a user by Stripe customer ID
 * @param {object} supabase - Supabase client
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<object|null>} User profile or null
 */
const findUserByStripeCustomerId = async (supabase, customerId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error finding user by Stripe customer ID:', error);
    throw error;
  }

  return data;
};

/**
 * Finds a user by their ID
 * @param {object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} User profile or null
 */
const findUserById = async (supabase, userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error finding user by ID:', error);
    throw error;
  }

  return data;
};

/**
 * Updates user subscription data
 * @param {object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated profile
 */
const updateUserSubscription = async (supabase, userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }

  return data;
};

/**
 * Handles checkout.session.completed event
 * @param {object} supabase - Supabase client
 * @param {object} session - Checkout session object
 */
const handleCheckoutSessionCompleted = async (supabase, session) => {
  const { customer, customer_email, subscription, metadata, mode, payment_status } = session;

  // Only process successful subscription checkouts
  if (mode !== 'subscription' || payment_status !== 'paid') {
    console.log('Skipping non-subscription or unpaid checkout session');
    return;
  }

  // Find user by metadata user_id or email
  let user = null;

  if (metadata?.user_id) {
    user = await findUserById(supabase, metadata.user_id);
  }

  if (!user && customer_email) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', customer_email)
      .single();
    user = data;
  }

  if (!user) {
    console.error('User not found for checkout session:', session.id);
    throw new Error('User not found');
  }

  // Update user with Stripe customer ID and subscription info
  await updateUserSubscription(supabase, user.id, {
    stripe_customer_id: customer,
    stripe_subscription_id: subscription,
    subscription_status: 'active',
    subscription_tier: 'pro',
  });

  console.log(`Checkout completed for user ${user.id}, subscription: ${subscription}`);
};

/**
 * Handles invoice.paid event
 * @param {object} supabase - Supabase client
 * @param {object} invoice - Invoice object
 */
const handleInvoicePaid = async (supabase, invoice) => {
  const { customer } = invoice;
  // Subscription ID can be in different places depending on the invoice type
  const subscriptionId = invoice.subscription || invoice.lines?.data?.[0]?.subscription;

  const user = await findUserByStripeCustomerId(supabase, customer);

  if (!user) {
    // This can happen when invoice.paid fires before checkout.session.completed
    // has finished processing. The checkout.session.completed handler will
    // set up the user's subscription, so we can safely skip this event.
    console.log(`User not found for invoice ${invoice.id}, skipping (will be handled by checkout.session.completed)`);
    return;
  }

  // Build update object - only include subscription_id if we have it
  const updates = {
    subscription_status: 'active',
  };
  
  if (subscriptionId) {
    updates.stripe_subscription_id = subscriptionId;
  }

  await updateUserSubscription(supabase, user.id, updates);

  console.log(`Invoice paid for user ${user.id}, subscription: ${subscriptionId || 'N/A'}`);
};

/**
 * Handles invoice.payment_failed event
 * @param {object} supabase - Supabase client
 * @param {object} invoice - Invoice object
 */
const handleInvoicePaymentFailed = async (supabase, invoice) => {
  const { customer, subscription } = invoice;

  const user = await findUserByStripeCustomerId(supabase, customer);

  if (!user) {
    console.error('User not found for failed invoice:', invoice.id);
    throw new Error('User not found');
  }

  // Mark subscription as past_due
  await updateUserSubscription(supabase, user.id, {
    subscription_status: 'past_due',
  });

  console.log(`Payment failed for user ${user.id}, subscription: ${subscription}`);
};

/**
 * Handles customer.subscription.updated event
 * @param {object} supabase - Supabase client
 * @param {object} subscription - Subscription object
 */
const handleSubscriptionUpdated = async (supabase, subscription) => {
  const { customer, status, current_period_start, current_period_end, items } = subscription;

  const user = await findUserByStripeCustomerId(supabase, customer);

  if (!user) {
    console.error('User not found for subscription update:', subscription.id);
    throw new Error('User not found');
  }

  // Determine subscription tier from price
  const priceId = items?.data?.[0]?.price?.id;
  let subscriptionTier = 'free';

  if (status === 'active' || status === 'trialing') {
    subscriptionTier = 'pro';
  }

  await updateUserSubscription(supabase, user.id, {
    subscription_status: status,
    subscription_tier: subscriptionTier,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    subscription_period_start: current_period_start
      ? new Date(current_period_start * 1000).toISOString()
      : null,
    subscription_period_end: current_period_end
      ? new Date(current_period_end * 1000).toISOString()
      : null,
  });

  console.log(`Subscription updated for user ${user.id}, status: ${status}`);
};

/**
 * Handles customer.subscription.deleted event
 * @param {object} supabase - Supabase client
 * @param {object} subscription - Subscription object
 */
const handleSubscriptionDeleted = async (supabase, subscription) => {
  const { customer } = subscription;

  const user = await findUserByStripeCustomerId(supabase, customer);

  if (!user) {
    console.error('User not found for subscription deletion:', subscription.id);
    throw new Error('User not found');
  }

  // Reset to free tier
  await updateUserSubscription(supabase, user.id, {
    subscription_status: 'canceled',
    subscription_tier: 'free',
    stripe_subscription_id: null,
    stripe_price_id: null,
    subscription_period_start: null,
    subscription_period_end: null,
  });

  console.log(`Subscription canceled for user ${user.id}`);
};

/**
 * POST /api/webhooks/payments/stripe
 * Handle Stripe webhook events
 */
export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Check webhook secret configuration
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Get signature header
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Get raw body
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // Verify signature
  const verification = verifyStripeSignature(rawBody, signature, webhookSecret);

  if (!verification.valid) {
    console.error('Signature verification failed:', verification.error);
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }

  // Parse event
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Validate event structure
  if (!event.type || !event.data?.object) {
    return NextResponse.json({ error: 'Invalid event structure' }, { status: 400 });
  }

  console.log(`Processing Stripe webhook event: ${event.type} (${event.id})`);

  // Initialize Supabase client
  const supabase = createServerClient({ useServiceRole: true });

  try {
    // Handle event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(supabase, event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Check if it's a "user not found" error
    if (error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}