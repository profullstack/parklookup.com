/**
 * Favorites Module
 * Handles user favorites for parks
 */

import { createBrowserClient } from '@/lib/supabase/client';

/**
 * Get the Supabase client
 */
const getSupabase = () => createBrowserClient();

/**
 * Get all favorites for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Favorites result
 */
export const getFavorites = async (userId) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('favorites')
    .select(
      `
      id,
      user_id,
      nps_park_id,
      notes,
      visited,
      visited_at,
      created_at,
      nps_parks (
        id,
        park_code,
        full_name,
        description,
        states,
        latitude,
        longitude,
        designation,
        url,
        images
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return {
    favorites: data ?? [],
    error,
  };
};

/**
 * Add a park to favorites
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {string} params.parkId - Park ID
 * @param {string} params.notes - Optional notes
 * @returns {Promise<Object>} Add result
 */
export const addFavorite = async ({ userId, parkId, notes = null }) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('favorites')
    .insert({
      user_id: userId,
      nps_park_id: parkId,
      notes,
    })
    .select()
    .single();

  return {
    favorite: data,
    error,
  };
};

/**
 * Remove a park from favorites
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {string} params.parkId - Park ID
 * @returns {Promise<Object>} Remove result
 */
export const removeFavorite = async ({ userId, parkId }) => {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('nps_park_id', parkId);

  return { error };
};

/**
 * Remove a favorite by ID
 * @param {string} favoriteId - Favorite ID
 * @returns {Promise<Object>} Remove result
 */
export const removeFavoriteById = async (favoriteId) => {
  const supabase = getSupabase();

  const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);

  return { error };
};

/**
 * Update a favorite
 * @param {Object} params - Parameters
 * @param {string} params.favoriteId - Favorite ID
 * @param {string} params.notes - Notes
 * @param {boolean} params.visited - Visited status
 * @param {string} params.visitedAt - Visit date
 * @returns {Promise<Object>} Update result
 */
export const updateFavorite = async ({ favoriteId, notes, visited, visitedAt }) => {
  const supabase = getSupabase();

  const updates = {};
  if (notes !== undefined) updates.notes = notes;
  if (visited !== undefined) updates.visited = visited;
  if (visitedAt !== undefined) updates.visited_at = visitedAt;

  const { data, error } = await supabase
    .from('favorites')
    .update(updates)
    .eq('id', favoriteId)
    .select()
    .single();

  return {
    favorite: data,
    error,
  };
};

/**
 * Check if a park is favorited by user
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {string} params.parkId - Park ID
 * @returns {Promise<Object>} Check result
 */
export const isFavorite = async ({ userId, parkId }) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('nps_park_id', parkId)
    .single();

  if (error?.code === 'PGRST116') {
    return { isFavorite: false, error: null };
  }

  return {
    isFavorite: !!data,
    favoriteId: data?.id,
    error,
  };
};

/**
 * Get favorite count for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Count result
 */
export const getFavoriteCount = async (userId) => {
  const supabase = getSupabase();

  const { count, error } = await supabase
    .from('favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return {
    count: count ?? 0,
    error,
  };
};

/**
 * Get visited parks for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Visited parks result
 */
export const getVisitedParks = async (userId) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('favorites')
    .select(
      `
      id,
      visited,
      visited_at,
      notes,
      nps_parks (
        id,
        park_code,
        full_name,
        states,
        images
      )
    `
    )
    .eq('user_id', userId)
    .eq('visited', true)
    .order('visited_at', { ascending: false });

  return {
    parks: data ?? [],
    error,
  };
};

/**
 * Toggle favorite status for a park
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {string} params.parkId - Park ID
 * @returns {Promise<Object>} Toggle result
 */
export const toggleFavorite = async ({ userId, parkId }) => {
  const { isFavorite: isFav, favoriteId } = await isFavorite({ userId, parkId });

  if (isFav) {
    const { error } = await removeFavoriteById(favoriteId);
    return { isFavorite: false, error };
  } else {
    const { favorite, error } = await addFavorite({ userId, parkId });
    return { isFavorite: true, favorite, error };
  }
};

/**
 * Mark a favorite as visited
 * @param {string} favoriteId - Favorite ID
 * @param {string} visitedAt - Visit date (optional, defaults to now)
 * @returns {Promise<Object>} Update result
 */
export const markAsVisited = async (favoriteId, visitedAt = new Date().toISOString()) => {
  return updateFavorite({
    favoriteId,
    visited: true,
    visitedAt,
  });
};

/**
 * Mark a favorite as not visited
 * @param {string} favoriteId - Favorite ID
 * @returns {Promise<Object>} Update result
 */
export const markAsNotVisited = async (favoriteId) => {
  return updateFavorite({
    favoriteId,
    visited: false,
    visitedAt: null,
  });
};

export default {
  getFavorites,
  addFavorite,
  removeFavorite,
  removeFavoriteById,
  updateFavorite,
  isFavorite,
  getFavoriteCount,
  getVisitedParks,
  toggleFavorite,
  markAsVisited,
  markAsNotVisited,
};