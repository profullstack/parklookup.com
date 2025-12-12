/**
 * Media Client Module
 * Client-side API wrapper for media functionality
 * All Supabase calls go through server-side API routes
 */

/**
 * Upload media (photo or video) for a park
 * @param {string} accessToken - User's access token
 * @param {Object} params - Upload parameters
 * @param {File} params.file - The file to upload
 * @param {string} params.parkCode - Park code
 * @param {string} params.title - Optional title
 * @param {string} params.description - Optional description
 * @param {Function} params.onProgress - Optional progress callback
 * @returns {Promise<Object>} Upload result
 */
export const uploadMedia = async (
  accessToken,
  { file, parkCode, title = '', description = '', onProgress }
) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parkCode', parkCode);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    const response = await fetch('/api/media', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return { media: null, error: { message: data.error } };
    }

    return { media: data.media, error: null };
  } catch (error) {
    return { media: null, error: { message: error.message } };
  }
};

/**
 * Get media for a park
 * @param {string} parkCode - Park code
 * @param {Object} options - Options
 * @param {number} options.limit - Number of items to fetch
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} Media result
 */
export const getParkMedia = async (parkCode, { limit = 20, offset = 0 } = {}) => {
  try {
    const url = new URL('/api/media', window.location.origin);
    url.searchParams.set('parkCode', parkCode);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      return { media: [], error: { message: data.error } };
    }

    return { media: data.media, error: null };
  } catch (error) {
    return { media: [], error: { message: error.message } };
  }
};

/**
 * Get media for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @param {number} options.limit - Number of items to fetch
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} Media result
 */
export const getUserMedia = async (userId, { limit = 20, offset = 0 } = {}) => {
  try {
    const url = new URL('/api/media', window.location.origin);
    url.searchParams.set('userId', userId);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      return { media: [], error: { message: data.error } };
    }

    return { media: data.media, error: null };
  } catch (error) {
    return { media: [], error: { message: error.message } };
  }
};

/**
 * Delete media
 * @param {string} accessToken - User's access token
 * @param {string} mediaId - Media ID
 * @returns {Promise<Object>} Delete result
 */
export const deleteMedia = async (accessToken, mediaId) => {
  try {
    const response = await fetch(`/api/media?id=${mediaId}`, {
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
 * Get comments for media
 * @param {string} mediaId - Media ID
 * @param {Object} options - Options
 * @param {number} options.limit - Number of items to fetch
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} Comments result
 */
export const getMediaComments = async (mediaId, { limit = 50, offset = 0 } = {}) => {
  try {
    const url = new URL(`/api/media/${mediaId}/comments`, window.location.origin);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      return { comments: [], error: { message: data.error } };
    }

    return { comments: data.comments, error: null };
  } catch (error) {
    return { comments: [], error: { message: error.message } };
  }
};

/**
 * Add comment to media
 * @param {string} accessToken - User's access token
 * @param {string} mediaId - Media ID
 * @param {Object} params - Comment parameters
 * @param {string} params.content - Comment content
 * @param {string} params.parentId - Optional parent comment ID for replies
 * @returns {Promise<Object>} Comment result
 */
export const addMediaComment = async (accessToken, mediaId, { content, parentId = null }) => {
  try {
    const response = await fetch(`/api/media/${mediaId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content, parentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { comment: null, error: { message: data.error } };
    }

    return { comment: data.comment, error: null };
  } catch (error) {
    return { comment: null, error: { message: error.message } };
  }
};

/**
 * Update a comment
 * @param {string} accessToken - User's access token
 * @param {string} mediaId - Media ID
 * @param {string} commentId - Comment ID
 * @param {string} content - New content
 * @returns {Promise<Object>} Update result
 */
export const updateMediaComment = async (accessToken, mediaId, commentId, content) => {
  try {
    const response = await fetch(`/api/media/${mediaId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { comment: null, error: { message: data.error } };
    }

    return { comment: data.comment, error: null };
  } catch (error) {
    return { comment: null, error: { message: error.message } };
  }
};

/**
 * Delete a comment
 * @param {string} accessToken - User's access token
 * @param {string} mediaId - Media ID
 * @param {string} commentId - Comment ID
 * @returns {Promise<Object>} Delete result
 */
export const deleteMediaComment = async (accessToken, mediaId, commentId) => {
  try {
    const response = await fetch(`/api/media/${mediaId}/comments/${commentId}`, {
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
 * Get likes info for media
 * @param {string} mediaId - Media ID
 * @param {string} accessToken - Optional access token
 * @returns {Promise<Object>} Likes result
 */
export const getMediaLikes = async (mediaId, accessToken = null) => {
  try {
    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api/media/${mediaId}/likes`, { headers });
    const data = await response.json();

    if (!response.ok) {
      return { likes_count: 0, user_has_liked: false, error: { message: data.error } };
    }

    return {
      likes_count: data.likes_count,
      user_has_liked: data.user_has_liked,
      error: null,
    };
  } catch (error) {
    return { likes_count: 0, user_has_liked: false, error: { message: error.message } };
  }
};

/**
 * Like media
 * @param {string} accessToken - User's access token
 * @param {string} mediaId - Media ID
 * @returns {Promise<Object>} Like result
 */
export const likeMedia = async (accessToken, mediaId) => {
  try {
    const response = await fetch(`/api/media/${mediaId}/likes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: { message: data.error } };
    }

    return {
      likes_count: data.likes_count,
      user_has_liked: data.user_has_liked,
      error: null,
    };
  } catch (error) {
    return { error: { message: error.message } };
  }
};

/**
 * Unlike media
 * @param {string} accessToken - User's access token
 * @param {string} mediaId - Media ID
 * @returns {Promise<Object>} Unlike result
 */
export const unlikeMedia = async (accessToken, mediaId) => {
  try {
    const response = await fetch(`/api/media/${mediaId}/likes`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: { message: data.error } };
    }

    return {
      likes_count: data.likes_count,
      user_has_liked: data.user_has_liked,
      error: null,
    };
  } catch (error) {
    return { error: { message: error.message } };
  }
};

/**
 * Toggle like on media
 * @param {string} accessToken - User's access token
 * @param {string} mediaId - Media ID
 * @param {boolean} currentlyLiked - Current like status
 * @returns {Promise<Object>} Toggle result
 */
export const toggleMediaLike = async (accessToken, mediaId, currentlyLiked) => {
  if (currentlyLiked) {
    return unlikeMedia(accessToken, mediaId);
  }
  return likeMedia(accessToken, mediaId);
};

/**
 * Get user feed
 * @param {string} accessToken - Optional access token
 * @param {Object} options - Options
 * @param {string} options.type - Feed type ('following' or 'discover')
 * @param {number} options.limit - Number of items to fetch
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} Feed result
 */
export const getFeed = async (accessToken = null, { type = 'following', limit = 20, offset = 0 } = {}) => {
  try {
    const url = new URL('/api/feed', window.location.origin);
    url.searchParams.set('type', type);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());

    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(url.toString(), { headers });
    const data = await response.json();

    if (!response.ok) {
      return { media: [], feed_type: type, error: { message: data.error } };
    }

    return { media: data.media, feed_type: data.feed_type, error: null };
  } catch (error) {
    return { media: [], feed_type: type, error: { message: error.message } };
  }
};

/**
 * Get user profile
 * @param {string} userId - User ID
 * @param {string} accessToken - Optional access token
 * @returns {Promise<Object>} Profile result
 */
export const getUserProfile = async (userId, accessToken = null) => {
  try {
    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api/users/${userId}`, { headers });
    const data = await response.json();

    if (!response.ok) {
      return { profile: null, stats: null, error: { message: data.error } };
    }

    return {
      profile: data.profile,
      stats: data.stats,
      is_following: data.is_following,
      is_own_profile: data.is_own_profile,
      error: null,
    };
  } catch (error) {
    return { profile: null, stats: null, error: { message: error.message } };
  }
};

/**
 * Follow a user
 * @param {string} accessToken - User's access token
 * @param {string} userId - User ID to follow
 * @returns {Promise<Object>} Follow result
 */
export const followUser = async (accessToken, userId) => {
  try {
    const response = await fetch(`/api/users/${userId}/follow`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: { message: data.error } };
    }

    return {
      is_following: data.is_following,
      followers_count: data.followers_count,
      error: null,
    };
  } catch (error) {
    return { error: { message: error.message } };
  }
};

/**
 * Unfollow a user
 * @param {string} accessToken - User's access token
 * @param {string} userId - User ID to unfollow
 * @returns {Promise<Object>} Unfollow result
 */
export const unfollowUser = async (accessToken, userId) => {
  try {
    const response = await fetch(`/api/users/${userId}/follow`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: { message: data.error } };
    }

    return {
      is_following: data.is_following,
      followers_count: data.followers_count,
      error: null,
    };
  } catch (error) {
    return { error: { message: error.message } };
  }
};

/**
 * Toggle follow on a user
 * @param {string} accessToken - User's access token
 * @param {string} userId - User ID
 * @param {boolean} currentlyFollowing - Current follow status
 * @returns {Promise<Object>} Toggle result
 */
export const toggleFollow = async (accessToken, userId, currentlyFollowing) => {
  if (currentlyFollowing) {
    return unfollowUser(accessToken, userId);
  }
  return followUser(accessToken, userId);
};

export default {
  uploadMedia,
  getParkMedia,
  getUserMedia,
  deleteMedia,
  getMediaComments,
  addMediaComment,
  updateMediaComment,
  deleteMediaComment,
  getMediaLikes,
  likeMedia,
  unlikeMedia,
  toggleMediaLike,
  getFeed,
  getUserProfile,
  followUser,
  unfollowUser,
  toggleFollow,
};