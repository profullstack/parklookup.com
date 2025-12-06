/**
 * Favorites Module
 * Client-side API wrapper for favorites functionality
 * All Supabase calls go through server-side API routes
 */

/**
 * Get all favorites for the current user
 * @param {string} accessToken - User's access token
 * @param {Object} options - Options
 * @param {boolean} options.visitedOnly - Only return visited parks
 * @returns {Promise<Object>} Favorites result
 */
export const getFavorites = async (accessToken, { visitedOnly = false } = {}) => {
  try {
    const url = new URL('/api/favorites', window.location.origin);
    if (visitedOnly) {
      url.searchParams.set('visited', 'true');
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { favorites: [], error: { message: data.error } };
    }

    return { favorites: data.favorites, error: null };
  } catch (error) {
    return { favorites: [], error: { message: error.message } };
  }
};

/**
 * Add a park to favorites
 * @param {string} accessToken - User's access token
 * @param {Object} params - Parameters
 * @param {string} params.parkId - Park ID
 * @param {string} params.notes - Optional notes
 * @returns {Promise<Object>} Add result
 */
export const addFavorite = async (accessToken, { parkId, notes = null }) => {
  try {
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ parkId, notes }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { favorite: null, error: { message: data.error } };
    }

    return { favorite: data.favorite, error: null };
  } catch (error) {
    return { favorite: null, error: { message: error.message } };
  }
};

/**
 * Remove a favorite by ID
 * @param {string} accessToken - User's access token
 * @param {string} favoriteId - Favorite ID
 * @returns {Promise<Object>} Remove result
 */
export const removeFavorite = async (accessToken, favoriteId) => {
  try {
    const response = await fetch(`/api/favorites/${favoriteId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: { message: data.error } };
    }

    return { error: null };
  } catch (error) {
    return { error: { message: error.message } };
  }
};

/**
 * Update a favorite
 * @param {string} accessToken - User's access token
 * @param {string} favoriteId - Favorite ID
 * @param {Object} updates - Updates
 * @param {string} updates.notes - Notes
 * @param {boolean} updates.visited - Visited status
 * @param {string} updates.visitedAt - Visit date
 * @returns {Promise<Object>} Update result
 */
export const updateFavorite = async (accessToken, favoriteId, { notes, visited, visitedAt }) => {
  try {
    const response = await fetch(`/api/favorites/${favoriteId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes, visited, visitedAt }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { favorite: null, error: { message: data.error } };
    }

    return { favorite: data.favorite, error: null };
  } catch (error) {
    return { favorite: null, error: { message: error.message } };
  }
};

/**
 * Toggle favorite status for a park
 * @param {string} accessToken - User's access token
 * @param {string} parkId - Park ID
 * @param {string} currentFavoriteId - Current favorite ID if exists
 * @returns {Promise<Object>} Toggle result
 */
export const toggleFavorite = async (accessToken, parkId, currentFavoriteId = null) => {
  if (currentFavoriteId) {
    const { error } = await removeFavorite(accessToken, currentFavoriteId);
    return { isFavorite: false, error };
  } else {
    const { favorite, error } = await addFavorite(accessToken, { parkId });
    return { isFavorite: true, favorite, error };
  }
};

/**
 * Mark a favorite as visited
 * @param {string} accessToken - User's access token
 * @param {string} favoriteId - Favorite ID
 * @param {string} visitedAt - Visit date (optional, defaults to now)
 * @returns {Promise<Object>} Update result
 */
export const markAsVisited = async (accessToken, favoriteId, visitedAt = new Date().toISOString()) => {
  return updateFavorite(accessToken, favoriteId, {
    visited: true,
    visitedAt,
  });
};

/**
 * Mark a favorite as not visited
 * @param {string} accessToken - User's access token
 * @param {string} favoriteId - Favorite ID
 * @returns {Promise<Object>} Update result
 */
export const markAsNotVisited = async (accessToken, favoriteId) => {
  return updateFavorite(accessToken, favoriteId, {
    visited: false,
    visitedAt: null,
  });
};

export default {
  getFavorites,
  addFavorite,
  removeFavorite,
  updateFavorite,
  toggleFavorite,
  markAsVisited,
  markAsNotVisited,
};