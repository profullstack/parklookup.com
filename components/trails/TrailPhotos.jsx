'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Storage key for auth token (must match useAuth.js)
const AUTH_TOKEN_KEY = 'parklookup_auth_token';

/**
 * Supported file types - photos and videos
 */
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];
const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
  'video/3gpp',
  'video/x-m4v',
];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

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
 * Format video duration as MM:SS
 */
const formatDuration = (seconds) => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Media Card component - handles both photos and videos
 */
function MediaCard({ media, currentUserId, onDelete }) {
  const isOwner = currentUserId === media.user_id;
  const isVideo = media.media_type === 'video';

  return (
    <div className="relative group rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
      {isVideo ? (
        <div className="relative w-full h-48">
          <video
            src={media.url}
            poster={media.thumbnail_url}
            className="w-full h-full object-cover"
            controls
            preload="metadata"
          />
          {/* Video indicator overlay */}
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {media.duration && <span>{formatDuration(media.duration)}</span>}
          </div>
        </div>
      ) : (
        <img
          src={media.url}
          alt={media.caption || 'Trail photo'}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
      )}
      {media.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-white text-sm">{media.caption}</p>
        </div>
      )}
      {isOwner && (
        <button
          onClick={() => onDelete(media.id)}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          title={`Delete ${isVideo ? 'video' : 'photo'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Upload Form component - supports photos and videos
 */
function UploadForm({ onUpload, isUploading }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Unsupported file type. Please upload a photo or video.');
      return;
    }

    // Check if it's a video
    const fileIsVideo = ACCEPTED_VIDEO_TYPES.includes(selectedFile.type);
    setIsVideo(fileIsVideo);

    // Validate file size
    const maxSize = fileIsVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (selectedFile.size > maxSize) {
      const sizeMB = Math.round(maxSize / 1024 / 1024);
      setError(`File too large. Maximum size is ${sizeMB}MB.`);
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview
    if (ACCEPTED_IMAGE_TYPES.includes(selectedFile.type)) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      // For videos, create a video element to get a frame and duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
        video.currentTime = 1; // Seek to 1 second for thumbnail
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        setPreview(canvas.toDataURL('image/jpeg'));
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const event = { target: { files: [droppedFile] } };
      handleFileSelect(event);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    await onUpload(file, caption, isVideo, videoDuration);
    setFile(null);
    setPreview(null);
    setCaption('');
    setIsVideo(false);
    setVideoDuration(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setIsVideo(false);
    setVideoDuration(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 dark:hover:border-green-400 transition-colors"
        >
          <svg
            className="w-10 h-10 mx-auto text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            Drag and drop or click to upload
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Photos: up to 10MB • Videos: up to 50MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 rounded-full p-3">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            {isVideo && videoDuration && ` • ${formatDuration(videoDuration)}`}
          </p>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            maxLength={255}
          />
          <button
            type="submit"
            disabled={isUploading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading
              ? isVideo
                ? 'Uploading video...'
                : 'Uploading...'
              : isVideo
                ? 'Upload Video'
                : 'Upload Photo'}
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </form>
  );
}

/**
 * Trail Photos & Videos component
 * Displays and allows uploading photos and videos for a trail
 */
export default function TrailPhotos({ trailId }) {
  const { user, accessToken } = useAuth();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch media
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

  // Handle media upload
  const handleUpload = async (file, caption, isVideo, duration) => {
    if (!accessToken) {
      alert('Please sign in to upload media');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      // First, upload the file to get a URL
      const formData = new FormData();
      formData.append('file', file);

      // Upload to media API
      const uploadRes = await fetch('/api/media', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      clearInterval(progressInterval);

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      const uploadData = await uploadRes.json();
      const mediaUrl = uploadData.media?.url || uploadData.url;
      const thumbnailUrl = uploadData.media?.thumbnail_url || uploadData.thumbnail_url;

      if (!mediaUrl) {
        throw new Error('No URL returned from upload');
      }

      setUploadProgress(95);

      // Then create the trail media record
      const res = await fetch(`/api/trails/${trailId}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          url: mediaUrl,
          thumbnail_url: thumbnailUrl || null,
          media_type: isVideo ? 'video' : 'image',
          caption: caption || null,
          duration: isVideo ? Math.round(duration) : null,
        }),
      });

      setUploadProgress(100);

      if (res.ok) {
        const data = await res.json();
        setMedia([data.media, ...media]);
        setShowUploadForm(false);
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to save media');
      }
    } catch (err) {
      console.error('Error uploading media:', err);
      alert(err.message || 'Failed to upload media');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle media delete
  const handleDelete = async (mediaId) => {
    const mediaItem = media.find((m) => m.id === mediaId);
    const mediaType = mediaItem?.media_type === 'video' ? 'video' : 'photo';

    if (!confirm(`Are you sure you want to delete this ${mediaType}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/trails/${trailId}/media?mediaId=${mediaId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        setMedia(media.filter((m) => m.id !== mediaId));
      }
    } catch (err) {
      console.error('Error deleting media:', err);
    }
  };

  // Count photos and videos
  const photoCount = media.filter((m) => m.media_type !== 'video').length;
  const videoCount = media.filter((m) => m.media_type === 'video').length;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with upload button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Photos & Videos
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {photoCount} photo{photoCount !== 1 ? 's' : ''}
            {videoCount > 0 && ` • ${videoCount} video${videoCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        {user && !showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Media
          </button>
        )}
      </div>

      {/* Upload form */}
      {showUploadForm && user && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Upload Photo or Video</h4>
            <button
              onClick={() => setShowUploadForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Progress bar during upload */}
          {isUploading && uploadProgress > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <UploadForm onUpload={handleUpload} isUploading={isUploading} />
        </div>
      )}

      {/* Sign in prompt */}
      {!user && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Sign in to share your trail photos and videos
          </p>
          <a href="/signin" className="text-green-600 hover:text-green-700 font-medium">
            Sign In →
          </a>
        </div>
      )}

      {/* Media grid */}
      {media.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {media.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              currentUserId={user?.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No photos or videos yet. Be the first to share media from this trail!
        </p>
      )}
    </div>
  );
}
