/**
 * Client-side Tracking Utilities
 *
 * Functions for interacting with the tracks API from the client.
 * All API calls go through Next.js API routes.
 *
 * @module lib/tracking/tracking-client
 */

const API_BASE = '/api/tracks';

/**
 * Create a new track
 * @param {string} accessToken - User's access token
 * @param {Object} trackData - Track data
 * @param {string} [trackData.title] - Track title
 * @param {string} [trackData.description] - Track description
 * @param {string} [trackData.activityType] - Activity type (walking, hiking, biking, driving)
 * @param {string} [trackData.parkId] - NPS park ID
 * @param {string} [trackData.parkCode] - NPS park code
 * @param {string} [trackData.trailId] - Trail ID
 * @param {string} [trackData.localParkId] - Local park ID
 * @returns {Promise<Object>} Created track or error
 */
export const createTrack = async (accessToken, trackData) => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(trackData),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { track: data.track, message: data.message };
  } catch (error) {
    console.error('Error creating track:', error);
    return { error: { message: 'Failed to create track' } };
  }
};

/**
 * Get user's tracks
 * @param {string} accessToken - User's access token
 * @param {Object} [options] - Query options
 * @param {number} [options.limit] - Number of tracks to fetch
 * @param {number} [options.offset] - Offset for pagination
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.activityType] - Filter by activity type
 * @param {string} [options.sortBy] - Sort field
 * @param {string} [options.sortOrder] - Sort order (asc/desc)
 * @returns {Promise<Object>} Tracks list or error
 */
export const getTracks = async (accessToken, options = {}) => {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.status) params.set('status', options.status);
    if (options.activityType) params.set('activityType', options.activityType);
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortOrder) params.set('sortOrder', options.sortOrder);

    const url = `${API_BASE}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { tracks: data.tracks, pagination: data.pagination };
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return { error: { message: 'Failed to fetch tracks' } };
  }
};

/**
 * Get a single track by ID
 * @param {string} accessToken - User's access token (optional for public tracks)
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Track details or error
 */
export const getTrack = async (accessToken, trackId) => {
  try {
    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE}/${trackId}`, { headers });
    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { track: data.track };
  } catch (error) {
    console.error('Error fetching track:', error);
    return { error: { message: 'Failed to fetch track' } };
  }
};

/**
 * Update a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.title] - New title
 * @param {string} [updates.description] - New description
 * @param {string} [updates.activityType] - New activity type
 * @param {string} [updates.status] - New status
 * @returns {Promise<Object>} Updated track or error
 */
export const updateTrack = async (accessToken, trackId, updates) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { track: data.track, message: data.message };
  } catch (error) {
    console.error('Error updating track:', error);
    return { error: { message: 'Failed to update track' } };
  }
};

/**
 * Delete a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Success message or error
 */
export const deleteTrack = async (accessToken, trackId) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { message: data.message };
  } catch (error) {
    console.error('Error deleting track:', error);
    return { error: { message: 'Failed to delete track' } };
  }
};

/**
 * Add GPS points to a track (batch)
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {Array<Object>} points - Array of GPS points
 * @param {number} points[].latitude - Latitude
 * @param {number} points[].longitude - Longitude
 * @param {number} [points[].altitudeM] - Altitude in meters
 * @param {number} [points[].accuracyM] - Accuracy in meters
 * @param {number} [points[].altitudeAccuracyM] - Altitude accuracy in meters
 * @param {number} [points[].speedMps] - Speed in meters per second
 * @param {number} [points[].heading] - Heading in degrees
 * @param {string} [points[].recordedAt] - ISO timestamp
 * @returns {Promise<Object>} Insert result or error
 */
export const addTrackPoints = async (accessToken, trackId, points) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ points }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return {
      inserted: data.inserted,
      points: data.points,
      validationErrors: data.validationErrors,
      message: data.message,
    };
  } catch (error) {
    console.error('Error adding track points:', error);
    return { error: { message: 'Failed to add track points' } };
  }
};

/**
 * Get track points
 * @param {string} accessToken - User's access token (optional for public tracks)
 * @param {string} trackId - Track ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit] - Number of points to fetch
 * @param {number} [options.offset] - Offset for pagination
 * @param {boolean} [options.simplified] - Return simplified data
 * @returns {Promise<Object>} Points list or error
 */
export const getTrackPoints = async (accessToken, trackId, options = {}) => {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.simplified) params.set('simplified', 'true');

    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const url = `${API_BASE}/${trackId}/points?${params.toString()}`;
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { points: data.points, pagination: data.pagination };
  } catch (error) {
    console.error('Error fetching track points:', error);
    return { error: { message: 'Failed to fetch track points' } };
  }
};

/**
 * Clear all points from a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Delete result or error
 */
export const clearTrackPoints = async (accessToken, trackId) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/points`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { deleted: data.deleted, message: data.message };
  } catch (error) {
    console.error('Error clearing track points:', error);
    return { error: { message: 'Failed to clear track points' } };
  }
};

/**
 * Share a track to the feed
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {Object} [options] - Share options
 * @param {string} [options.title] - Title for shared track
 * @param {string} [options.description] - Description for shared track
 * @returns {Promise<Object>} Share result or error
 */
export const shareTrack = async (accessToken, trackId, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(options),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { track: data.track, message: data.message };
  } catch (error) {
    console.error('Error sharing track:', error);
    return { error: { message: 'Failed to share track' } };
  }
};

/**
 * Unshare a track (make private)
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Unshare result or error
 */
export const unshareTrack = async (accessToken, trackId) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/share`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { track: data.track, message: data.message };
  } catch (error) {
    console.error('Error unsharing track:', error);
    return { error: { message: 'Failed to unshare track' } };
  }
};

/**
 * Like a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Like result or error
 */
export const likeTrack = async (accessToken, trackId) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/likes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { like: data.like, likesCount: data.likesCount, message: data.message };
  } catch (error) {
    console.error('Error liking track:', error);
    return { error: { message: 'Failed to like track' } };
  }
};

/**
 * Unlike a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Unlike result or error
 */
export const unlikeTrack = async (accessToken, trackId) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/likes`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { likesCount: data.likesCount, message: data.message };
  } catch (error) {
    console.error('Error unliking track:', error);
    return { error: { message: 'Failed to unlike track' } };
  }
};

/**
 * Toggle track like
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {boolean} currentlyLiked - Whether the track is currently liked
 * @returns {Promise<Object>} Toggle result or error
 */
export const toggleTrackLike = async (accessToken, trackId, currentlyLiked) => {
  if (currentlyLiked) {
    return unlikeTrack(accessToken, trackId);
  }
  return likeTrack(accessToken, trackId);
};

/**
 * Get track comments
 * @param {string} accessToken - User's access token (optional for public tracks)
 * @param {string} trackId - Track ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit] - Number of comments to fetch
 * @param {number} [options.offset] - Offset for pagination
 * @returns {Promise<Object>} Comments list or error
 */
export const getTrackComments = async (accessToken, trackId, options = {}) => {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());

    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const url = `${API_BASE}/${trackId}/comments?${params.toString()}`;
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return {
      comments: data.comments,
      commentsCount: data.commentsCount,
      pagination: data.pagination,
    };
  } catch (error) {
    console.error('Error fetching track comments:', error);
    return { error: { message: 'Failed to fetch comments' } };
  }
};

/**
 * Add a comment to a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {string} content - Comment content
 * @param {string} [parentId] - Parent comment ID for replies
 * @returns {Promise<Object>} Created comment or error
 */
export const addTrackComment = async (accessToken, trackId, content, parentId = null) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content, parentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return {
      comment: data.comment,
      commentsCount: data.commentsCount,
      message: data.message,
    };
  } catch (error) {
    console.error('Error adding track comment:', error);
    return { error: { message: 'Failed to add comment' } };
  }
};

/**
 * Update a track comment
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {string} commentId - Comment ID
 * @param {string} content - New comment content
 * @returns {Promise<Object>} Updated comment or error
 */
export const updateTrackComment = async (accessToken, trackId, commentId, content) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { comment: data.comment, message: data.message };
  } catch (error) {
    console.error('Error updating track comment:', error);
    return { error: { message: 'Failed to update comment' } };
  }
};

/**
 * Delete a track comment
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {string} commentId - Comment ID
 * @returns {Promise<Object>} Delete result or error
 */
export const deleteTrackComment = async (accessToken, trackId, commentId) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { commentsCount: data.commentsCount, message: data.message };
  } catch (error) {
    console.error('Error deleting track comment:', error);
    return { error: { message: 'Failed to delete comment' } };
  }
};

/**
 * Finalize a track (complete recording and calculate stats)
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Finalized track or error
 */
export const finalizeTrack = async (accessToken, trackId) => {
  return updateTrack(accessToken, trackId, { status: 'completed' });
};

// ============================================
// Track Media Functions
// ============================================

/**
 * Get all media attached to a track
 * @param {string} accessToken - User's access token (optional for public tracks)
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Media list or error
 */
export const getTrackMedia = async (accessToken, trackId) => {
  try {
    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE}/${trackId}/media`, { headers });
    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { media: data.media };
  } catch (error) {
    console.error('Error fetching track media:', error);
    return { error: { message: 'Failed to fetch track media' } };
  }
};

/**
 * Upload media to a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {Object} mediaData - Media data
 * @param {File} mediaData.file - File to upload
 * @param {string} [mediaData.title] - Media title
 * @param {string} [mediaData.description] - Media description
 * @param {number} [mediaData.latitude] - Latitude where media was captured
 * @param {number} [mediaData.longitude] - Longitude where media was captured
 * @param {number} [mediaData.altitude] - Altitude where media was captured
 * @param {string} [mediaData.capturedAt] - ISO timestamp when media was captured
 * @param {function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<Object>} Uploaded media or error
 */
export const uploadTrackMedia = async (accessToken, trackId, mediaData, onProgress) => {
  try {
    const formData = new FormData();
    formData.append('file', mediaData.file);
    
    if (mediaData.title) formData.append('title', mediaData.title);
    if (mediaData.description) formData.append('description', mediaData.description);
    if (mediaData.latitude !== undefined) formData.append('latitude', mediaData.latitude.toString());
    if (mediaData.longitude !== undefined) formData.append('longitude', mediaData.longitude.toString());
    if (mediaData.altitude !== undefined) formData.append('altitude', mediaData.altitude.toString());
    if (mediaData.capturedAt) formData.append('capturedAt', mediaData.capturedAt);

    // Use XMLHttpRequest for progress tracking if callback provided
    if (onProgress) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ trackMedia: data.trackMedia });
            } else {
              resolve({ error: data, status: xhr.status });
            }
          } catch {
            resolve({ error: { message: 'Failed to parse response' } });
          }
        });

        xhr.addEventListener('error', () => {
          resolve({ error: { message: 'Upload failed' } });
        });

        xhr.open('POST', `${API_BASE}/${trackId}/media`);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.send(formData);
      });
    }

    // Standard fetch for simple uploads
    const response = await fetch(`${API_BASE}/${trackId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { trackMedia: data.trackMedia };
  } catch (error) {
    console.error('Error uploading track media:', error);
    return { error: { message: 'Failed to upload media' } };
  }
};

/**
 * Link existing media to a track
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {Object} linkData - Link data
 * @param {string} linkData.mediaId - Existing media ID to link
 * @param {number} [linkData.latitude] - Latitude where media was captured
 * @param {number} [linkData.longitude] - Longitude where media was captured
 * @param {number} [linkData.altitude] - Altitude where media was captured
 * @param {string} [linkData.capturedAt] - ISO timestamp when media was captured
 * @returns {Promise<Object>} Linked media or error
 */
export const linkMediaToTrack = async (accessToken, trackId, linkData) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(linkData),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { trackMedia: data.trackMedia };
  } catch (error) {
    console.error('Error linking media to track:', error);
    return { error: { message: 'Failed to link media to track' } };
  }
};

/**
 * Remove media from a track (does not delete the media itself)
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {string} mediaId - Media ID to remove
 * @returns {Promise<Object>} Success or error
 */
export const removeTrackMedia = async (accessToken, trackId, mediaId) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/media?mediaId=${mediaId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing track media:', error);
    return { error: { message: 'Failed to remove media from track' } };
  }
};

/**
 * Update track media link (reorder, update geolocation)
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {Object} updateData - Update data
 * @param {string} [updateData.linkId] - Track media link ID
 * @param {string} [updateData.mediaId] - Media ID (alternative to linkId)
 * @param {number} [updateData.displayOrder] - New display order
 * @param {number} [updateData.latitude] - Updated latitude
 * @param {number} [updateData.longitude] - Updated longitude
 * @param {number} [updateData.altitude] - Updated altitude
 * @param {string} [updateData.capturedAt] - Updated capture time
 * @returns {Promise<Object>} Updated link or error
 */
export const updateTrackMedia = async (accessToken, trackId, updateData) => {
  try {
    const response = await fetch(`${API_BASE}/${trackId}/media`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data, status: response.status };
    }

    return { trackMedia: data.trackMedia };
  } catch (error) {
    console.error('Error updating track media:', error);
    return { error: { message: 'Failed to update track media' } };
  }
};

/**
 * Reorder track media
 * @param {string} accessToken - User's access token
 * @param {string} trackId - Track ID
 * @param {Array<{mediaId: string, displayOrder: number}>} order - New order
 * @returns {Promise<Object>} Success or error
 */
export const reorderTrackMedia = async (accessToken, trackId, order) => {
  try {
    const results = await Promise.all(
      order.map(({ mediaId, displayOrder }) =>
        updateTrackMedia(accessToken, trackId, { mediaId, displayOrder })
      )
    );

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      return { error: { message: `Failed to reorder ${errors.length} items` }, partialErrors: errors };
    }

    return { success: true };
  } catch (error) {
    console.error('Error reordering track media:', error);
    return { error: { message: 'Failed to reorder track media' } };
  }
};

export default {
  createTrack,
  getTracks,
  getTrack,
  updateTrack,
  deleteTrack,
  addTrackPoints,
  getTrackPoints,
  clearTrackPoints,
  shareTrack,
  unshareTrack,
  likeTrack,
  unlikeTrack,
  toggleTrackLike,
  getTrackComments,
  addTrackComment,
  updateTrackComment,
  deleteTrackComment,
  finalizeTrack,
  // Media functions
  getTrackMedia,
  uploadTrackMedia,
  linkMediaToTrack,
  removeTrackMedia,
  updateTrackMedia,
  reorderTrackMedia,
};
