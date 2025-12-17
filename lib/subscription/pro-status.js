/**
 * Pro Status Utility
 * Centralized logic for determining if a user has pro subscription
 *
 * This module provides consistent pro status checking across the application,
 * both on the client-side (with profile objects) and server-side (with Supabase).
 */

/**
 * Check if a profile object indicates pro status
 * User is considered pro if:
 * - is_pro flag is true, OR
 * - subscription_status is 'active' AND subscription_tier is 'pro'
 *
 * @param {Object|null} profile - User profile object
 * @param {boolean} [profile.is_pro] - Direct pro flag
 * @param {string} [profile.subscription_status] - Subscription status ('active', 'past_due', 'canceled', etc.)
 * @param {string} [profile.subscription_tier] - Subscription tier ('free', 'pro')
 * @returns {boolean} True if user has pro access
 *
 * @example
 * // Client-side usage
 * import { isProUser } from '@/lib/subscription/pro-status';
 * const isPro = isProUser(profile);
 *
 * @example
 * // With partial profile data
 * const isPro = isProUser({ is_pro: true });
 * const isPro = isProUser({ subscription_status: 'active', subscription_tier: 'pro' });
 */
export const isProUser = (profile) => {
  if (!profile) {
    return false;
  }

  // Check direct is_pro flag
  if (profile.is_pro === true) {
    return true;
  }

  // Check subscription status and tier (fallback for inconsistent state)
  if (profile.subscription_status === 'active' && profile.subscription_tier === 'pro') {
    return true;
  }

  return false;
};

/**
 * Check if a user has pro status by querying the database
 * Server-side only - requires Supabase client
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user has pro access
 *
 * @example
 * // Server-side usage in API routes
 * import { isUserProFromDb } from '@/lib/subscription/pro-status';
 * const isPro = await isUserProFromDb(supabase, user.id);
 */
export const isUserProFromDb = async (supabase, userId) => {
  if (!supabase || !userId) {
    return false;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_pro, subscription_status, subscription_tier')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return false;
    }

    return isProUser(profile);
  } catch {
    return false;
  }
};

/**
 * Get the required profile fields for pro status checking
 * Use this when selecting profile data to ensure all necessary fields are included
 *
 * @returns {string} Comma-separated list of field names for Supabase select
 *
 * @example
 * const { data } = await supabase
 *   .from('profiles')
 *   .select(getProStatusFields())
 *   .eq('id', userId)
 *   .single();
 */
export const getProStatusFields = () => 'is_pro, subscription_status, subscription_tier';

export default {
  isProUser,
  isUserProFromDb,
  getProStatusFields,
};