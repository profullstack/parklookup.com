/**
 * Authentication Module
 * Handles user authentication with Supabase Auth
 */

import { createBrowserClient } from '@/lib/supabase/client';

/**
 * Get the Supabase client for auth operations
 */
const getSupabase = () => createBrowserClient();

/**
 * Sign up a new user with email and password
 * @param {Object} credentials - User credentials
 * @param {string} credentials.email - User email
 * @param {string} credentials.password - User password
 * @returns {Promise<Object>} Sign up result
 */
export const signUp = async ({ email, password }) => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { user: null, session: null, error };
  }

  // Create user profile after successful signup
  if (data.user) {
    await createUserProfile(data.user);
  }

  return {
    user: data.user,
    session: data.session,
    error: null,
  };
};

/**
 * Sign in with email and password
 * @param {Object} credentials - User credentials
 * @param {string} credentials.email - User email
 * @param {string} credentials.password - User password
 * @returns {Promise<Object>} Sign in result
 */
export const signIn = async ({ email, password }) => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    error,
  };
};

/**
 * Sign in with OAuth provider
 * @param {Object} options - OAuth options
 * @param {string} options.provider - OAuth provider (google, github, etc.)
 * @returns {Promise<Object>} OAuth result
 */
export const signInWithOAuth = async ({ provider }) => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  return { data, error };
};

/**
 * Sign out the current user
 * @returns {Promise<Object>} Sign out result
 */
export const signOut = async () => {
  const supabase = getSupabase();

  const { error } = await supabase.auth.signOut();

  return { error };
};

/**
 * Get the current session
 * @returns {Promise<Object>} Session result
 */
export const getSession = async () => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.getSession();

  return {
    session: data?.session ?? null,
    error,
  };
};

/**
 * Get the current user
 * @returns {Promise<Object>} User result
 */
export const getUser = async () => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.getUser();

  return {
    user: data?.user ?? null,
    error,
  };
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<Object>} Reset result
 */
export const resetPassword = async (email) => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  return { data, error };
};

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Update result
 */
export const updatePassword = async (newPassword) => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { data, error };
};

/**
 * Update user profile
 * @param {Object} profile - Profile data
 * @param {string} profile.displayName - Display name
 * @param {string} profile.avatarUrl - Avatar URL
 * @returns {Promise<Object>} Update result
 */
export const updateProfile = async ({ displayName, avatarUrl }) => {
  const supabase = getSupabase();

  // Update auth user metadata
  const { data: userData, error: userError } = await supabase.auth.updateUser({
    data: {
      display_name: displayName,
      avatar_url: avatarUrl,
    },
  });

  if (userError) {
    return { data: null, error: userError };
  }

  // Update profile in database
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      avatar_url: avatarUrl,
    })
    .eq('id', userData.user.id);

  return {
    data: userData,
    error: profileError,
  };
};

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Callback function
 * @returns {Object} Subscription with unsubscribe method
 */
export const onAuthStateChange = (callback) => {
  const supabase = getSupabase();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
};

/**
 * Create user profile after signup
 * @param {Object} user - User object
 * @returns {Promise<Object>} Profile creation result
 */
const createUserProfile = async (user) => {
  const supabase = getSupabase();

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
  });

  return { error };
};

/**
 * Get user profile from database
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Profile result
 */
export const getUserProfile = async (userId) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return { profile: data, error };
};

export default {
  signUp,
  signIn,
  signInWithOAuth,
  signOut,
  getSession,
  getUser,
  resetPassword,
  updatePassword,
  updateProfile,
  onAuthStateChange,
  getUserProfile,
};