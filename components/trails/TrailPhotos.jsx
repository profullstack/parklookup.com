'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

// Storage key for auth token (must match useAuth.js)
const AUTH_TOKEN_KEY = 'parklookup_auth_token';

/**
 * Get stored token from localStorage
 */
const getStoredToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * Get authorization headers for API requests
 */
const getAuthHeaders = () => {
  const token = getStoredToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

/**
 * Media Upload Form Component
 */
function MediaUploadForm({ trailId, onUploadComplete, onCancel }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Create preview URL
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caption', caption);
      formData.append('trail_id', trailId);

      const res = await fetch('/api/media', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload');
      }

      const data = await res.json();
      onUploadComplete(data.media);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Photo or Video
        </label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="w-full text-sm text-gray-500 dark:text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-green-50 file:text-green-700
            dark:file:bg-green-900/30 dark:file:text-green-400
            hover:file:bg-green-100 dark:hover:file:bg-green-900/50"
        />
      </div>

      {preview && (
        <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
          {file?.type.startsWith('video/') ? (
            <video src={preview} controls className="w-full h-full object-contain" />
          ) : (
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-contain"
            />
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Caption (optional)
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption to your photo..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
          rows={2}
        />
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={uploading || !file}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Media Grid Component
 */
function MediaGrid({ media, onMediaClick }) {
  if (media.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-600 dark:text-gray-400">
          No photos yet. Be the first to share your trail experience!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {media.map((item) => (
        <button
          key={item.id}
          onClick={() => onMediaClick(item)}
          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 hover:opacity-90 transition-opacity"
        >
          {item.media_type === 'video' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <video
                src={item.url}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          ) : (
            <Image
              src={item.url}
              alt={item.caption || 'Trail photo'}
              fill
              className="object-cover"
            />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Media Modal Component
 */
function MediaModal({ media, onClose }) {
  if (!media) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          {media.media_type === 'video' ? (
            <video
              src={media.url}
              controls
              autoPlay
              className="w-full max-h-[70vh] object-contain"
            />
          ) : (
            <div className="relative aspect-video">
              <Image
                src={media.url}
                alt={media.caption || 'Trail photo'}
                fill
                className="object-contain"
              />
            </div>
          )}
          
          {media.caption && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300">{media.caption}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {new Date(media.created_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Trail Photos Component
 * Displays user-contributed photos and videos for a trail with upload functionality
 *
 * @param {Object} props
 * @param {string} props.trailId - Trail ID for fetching and uploading media
 */
export default function TrailPhotos({ trailId }) {
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);

  // Fetch media for this trail
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/trails/${trailId}/media`);
        if (res.ok) {
          const data = await res.json();
          setMedia(data.media || []);
        }
      } catch (err) {
        console.error('Error fetching trail media:', err);
      } finally {
        setLoading(false);
      }
    };

    if (trailId) {
      fetchMedia();
    }
  }, [trailId]);

  const handleUploadComplete = (newMedia) => {
    setMedia([newMedia, ...media]);
    setShowUpload(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Trail Photos & Videos
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Photos and videos shared by hikers
          </p>
        </div>
        {user ? (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Share Photo
          </button>
        ) : (
          <Link
            href="/signin"
            className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Sign in to share
          </Link>
        )}
      </div>

      {/* Upload Form */}
      {showUpload && (
        <MediaUploadForm
          trailId={trailId}
          onUploadComplete={handleUploadComplete}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {/* Media Grid */}
      <MediaGrid media={media} onMediaClick={setSelectedMedia} />

      {/* Media Modal */}
      {selectedMedia && (
        <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
      )}
    </div>
  );
}
