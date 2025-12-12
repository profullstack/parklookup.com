'use client';

import { useState } from 'react';
import MediaUpload from '@/components/media/MediaUpload';
import MediaGrid from '@/components/media/MediaGrid';

/**
 * User Photos Component
 * Displays user-contributed photos and videos for a park with upload functionality
 */
export default function UserPhotos({ parkCode }) {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = (media) => {
    setShowUpload(false);
    // Trigger refresh of media grid
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Community Photos & Videos
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Photos and videos shared by visitors like you
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Share Photo
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <MediaUpload
          parkCode={parkCode}
          onUploadComplete={handleUploadComplete}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {/* Media Grid */}
      <MediaGrid key={refreshKey} parkCode={parkCode} showUploadPrompt={!showUpload} />
    </div>
  );
}