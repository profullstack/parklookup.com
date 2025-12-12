-- Migration: Storage Buckets for User Media
-- Creates storage buckets for user-uploaded photos and videos

-- ============================================
-- Create Storage Buckets
-- ============================================

-- Insert the user-media bucket for photos and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media',
  true, -- Public bucket for serving media
  52428800, -- 50MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
    'video/3gpp',
    'video/x-m4v'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Insert the thumbnails bucket for video thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media-thumbnails',
  'media-thumbnails',
  true, -- Public bucket for serving thumbnails
  5242880, -- 5MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- Storage Policies for user-media bucket
-- ============================================

-- Allow anyone to view files in user-media bucket
CREATE POLICY "Public read access for user-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-media');

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Authenticated users can upload to user-media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-media' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own files in user-media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-media' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files in user-media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-media' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role full access
CREATE POLICY "Service role has full access to user-media"
ON storage.objects FOR ALL
USING (
  bucket_id = 'user-media' 
  AND auth.role() = 'service_role'
);

-- ============================================
-- Storage Policies for media-thumbnails bucket
-- ============================================

-- Allow anyone to view thumbnails
CREATE POLICY "Public read access for media-thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-thumbnails');

-- Allow authenticated users to upload thumbnails to their own folder
CREATE POLICY "Authenticated users can upload to media-thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media-thumbnails' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own thumbnails
CREATE POLICY "Users can update their own files in media-thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'media-thumbnails' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own thumbnails
CREATE POLICY "Users can delete their own files in media-thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'media-thumbnails' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role full access to thumbnails
CREATE POLICY "Service role has full access to media-thumbnails"
ON storage.objects FOR ALL
USING (
  bucket_id = 'media-thumbnails' 
  AND auth.role() = 'service_role'
);

-- Note: Storage buckets created:
-- - user-media: User uploaded photos and videos (50MB limit)
-- - media-thumbnails: Video thumbnails (5MB limit)