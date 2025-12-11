-- Add Stripe Customer ID to Profiles
-- This migration adds stripe_customer_id for linking Stripe customers to users

-- ============================================
-- Add stripe_customer_id column to profiles
-- ============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create unique index for stripe_customer_id (each Stripe customer should map to one user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
ON profiles(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- ============================================
-- Add subscription-related columns
-- ============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for this user';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN profiles.subscription_status IS 'Subscription status: active, canceled, past_due, etc.';
COMMENT ON COLUMN profiles.subscription_period_end IS 'When the current subscription period ends';