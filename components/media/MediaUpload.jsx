'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { uploadMedia } from '@/lib/media/media-client';

/**
 * Supported file types
 */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska', 'video/3gpp', 'video/x-m4v'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Media Upload Component
 * Allows users to upload photos and videos for a park
 */
export default function MediaUpload({ parkCode, onUploadComplete, onCancel }) {
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Unsupported file type. Please upload a photo or video.');
      return;
    }

    // Validate file size
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(selectedFile.type);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
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
      // For videos, create a video element to get a frame
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Seek to 1 second
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

  const handleUpload = async () => {
    if (!file || !accessToken) return;

    setUploading(true);
    setError(null);
    setProgress(10);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const { media, error: uploadError } = await uploadMedia(accessToken, {
        file,
        parkCode,
        title,
        description,
      });

      clearInterval(progressInterval);

      if (uploadError) {
        setError(uploadError.message);
        setProgress(0);
        return;
      }

      setProgress(100);
      
      // Reset form
      setTimeout(() => {
        setFile(null);
        setPreview(null);
        setTitle('');
        setDescription('');
        setProgress(0);
        onUploadComplete?.(media);
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to upload media');
      setProgress(0);
    } finally {
      setUploading(false);
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

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Sign in to share your photos and videos</p>
        <a href="/signin" className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Share Your Experience
      </h3>

      {/* File Drop Zone */}
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 dark:hover:border-green-400 transition-colors"
        >
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Drag and drop your photo or video here
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            or click to browse
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
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
      )}

      {/* Preview */}
      {file && preview && (
        <div className="relative mb-4">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            {ACCEPTED_VIDEO_TYPES.includes(file.type) && (
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
            onClick={clearFile}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            disabled={uploading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        </div>
      )}

      {/* Title and Description */}
      {file && (
        <div className="space-y-4 mb-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your photo a title"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={uploading}
              maxLength={255}
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share your experience..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              disabled={uploading}
              maxLength={1000}
            />
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {ACCEPTED_VIDEO_TYPES.includes(file?.type) && progress < 90 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Converting video to MP4... This may take a moment.
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      {file && (
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            onClick={() => {
              clearFile();
              onCancel?.();
            }}
            disabled={uploading}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}