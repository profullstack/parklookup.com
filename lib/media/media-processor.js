/**
 * Media Processor Module
 * Handles video conversion to MP4 and image processing
 * Uses sharp for images and ffmpeg for videos
 */

import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { unlink, mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

/**
 * Supported image MIME types
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * Supported video MIME types
 */
export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
  'video/3gpp',
  'video/x-m4v',
];

/**
 * Maximum file sizes
 */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Image processing options
 */
const IMAGE_OPTIONS = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 85,
  thumbnailWidth: 400,
  thumbnailHeight: 400,
};

/**
 * Video processing options
 */
const VIDEO_OPTIONS = {
  maxWidth: 1920,
  maxHeight: 1080,
  videoBitrate: '2M',
  audioBitrate: '128k',
  thumbnailTime: '00:00:01',
};

/**
 * Check if ffmpeg is available
 * @returns {Promise<boolean>}
 */
export const checkFfmpegAvailable = async () => {
  return new Promise((resolve) => {
    const process = spawn('ffmpeg', ['-version']);
    process.on('error', () => resolve(false));
    process.on('close', (code) => resolve(code === 0));
  });
};

/**
 * Get media type from MIME type
 * @param {string} mimeType - The MIME type
 * @returns {'photo' | 'video' | null}
 */
export const getMediaType = (mimeType) => {
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    return 'photo';
  }
  if (SUPPORTED_VIDEO_TYPES.includes(mimeType)) {
    return 'video';
  }
  return null;
};

/**
 * Validate media file
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateMedia = (buffer, mimeType) => {
  const mediaType = getMediaType(mimeType);

  if (!mediaType) {
    return { valid: false, error: `Unsupported media type: ${mimeType}` };
  }

  const maxSize = mediaType === 'photo' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

  if (buffer.length > maxSize) {
    const sizeMB = Math.round(maxSize / 1024 / 1024);
    return { valid: false, error: `File too large. Maximum size is ${sizeMB}MB` };
  }

  return { valid: true };
};

/**
 * Process an image - resize and optimize
 * @param {Buffer} buffer - Image buffer
 * @param {string} mimeType - Original MIME type
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, mimeType: string }>}
 */
export const processImage = async (buffer, mimeType) => {
  try {
    let image = sharp(buffer);
    const metadata = await image.metadata();

    // Resize if needed
    if (metadata.width > IMAGE_OPTIONS.maxWidth || metadata.height > IMAGE_OPTIONS.maxHeight) {
      image = image.resize(IMAGE_OPTIONS.maxWidth, IMAGE_OPTIONS.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Auto-rotate based on EXIF
    image = image.rotate();

    // Convert HEIC/HEIF to JPEG
    let outputMimeType = mimeType;
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      image = image.jpeg({ quality: IMAGE_OPTIONS.quality });
      outputMimeType = 'image/jpeg';
    } else if (mimeType === 'image/png') {
      image = image.png({ quality: IMAGE_OPTIONS.quality });
    } else if (mimeType === 'image/webp') {
      image = image.webp({ quality: IMAGE_OPTIONS.quality });
    } else {
      // Default to JPEG for other formats
      image = image.jpeg({ quality: IMAGE_OPTIONS.quality });
      outputMimeType = 'image/jpeg';
    }

    const processedBuffer = await image.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: processedMetadata.width,
      height: processedMetadata.height,
      mimeType: outputMimeType,
    };
  } catch (error) {
    throw new Error(`Failed to process image: ${error.message}`);
  }
};

/**
 * Generate thumbnail for an image
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Buffer>}
 */
export const generateImageThumbnail = async (buffer) => {
  try {
    const thumbnail = await sharp(buffer)
      .resize(IMAGE_OPTIONS.thumbnailWidth, IMAGE_OPTIONS.thumbnailHeight, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
};

/**
 * Convert video to MP4 using ffmpeg
 * @param {Buffer} buffer - Video buffer
 * @param {string} originalFilename - Original filename for extension detection
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, duration: number }>}
 */
export const convertVideoToMp4 = async (buffer, originalFilename = 'video.mp4') => {
  const tempDir = join(tmpdir(), 'parklookup-media');
  await mkdir(tempDir, { recursive: true });

  const inputPath = join(tempDir, `input-${randomUUID()}${extname(originalFilename)}`);
  const outputPath = join(tempDir, `output-${randomUUID()}.mp4`);

  try {
    // Write input buffer to temp file
    await new Promise((resolve, reject) => {
      const writeStream = createWriteStream(inputPath);
      writeStream.write(buffer);
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Get video info first
    const videoInfo = await getVideoInfo(inputPath);

    // Convert to MP4 with web-compatible settings
    await new Promise((resolve, reject) => {
      const args = [
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-profile:v',
        'main', // Better browser compatibility
        '-level',
        '4.0',
        '-pix_fmt',
        'yuv420p', // Required for browser compatibility
        '-c:a',
        'aac',
        '-b:a',
        VIDEO_OPTIONS.audioBitrate,
        '-movflags',
        '+faststart', // Enable streaming
        '-vf',
        `scale='min(${VIDEO_OPTIONS.maxWidth},iw)':'min(${VIDEO_OPTIONS.maxHeight},ih)':force_original_aspect_ratio=decrease`,
        '-y',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });
    });

    // Read output file
    const outputBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const readStream = createReadStream(outputPath);
      readStream.on('data', (chunk) => chunks.push(chunk));
      readStream.on('end', () => resolve(Buffer.concat(chunks)));
      readStream.on('error', reject);
    });

    // Get output video info
    const outputInfo = await getVideoInfo(outputPath);

    return {
      buffer: outputBuffer,
      width: outputInfo.width,
      height: outputInfo.height,
      duration: Math.round(outputInfo.duration),
    };
  } finally {
    // Cleanup temp files
    try {
      await unlink(inputPath);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
};

/**
 * Get video information using ffprobe
 * @param {string} filePath - Path to video file
 * @returns {Promise<{ width: number, height: number, duration: number }>}
 */
export const getVideoInfo = async (filePath) => {
  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const ffprobe = spawn('ffprobe', args);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('error', (error) => {
      reject(new Error(`FFprobe error: ${error.message}`));
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const info = JSON.parse(stdout);
        const videoStream = info.streams?.find((s) => s.codec_type === 'video');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          duration: parseFloat(info.format?.duration || '0'),
        });
      } catch (error) {
        reject(new Error(`Failed to parse video info: ${error.message}`));
      }
    });
  });
};

/**
 * Generate thumbnail from video
 * @param {Buffer} buffer - Video buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<Buffer>}
 */
export const generateVideoThumbnail = async (buffer, originalFilename = 'video.mp4') => {
  const tempDir = join(tmpdir(), 'parklookup-media');
  await mkdir(tempDir, { recursive: true });

  const inputPath = join(tempDir, `thumb-input-${randomUUID()}${extname(originalFilename)}`);
  const outputPath = join(tempDir, `thumb-output-${randomUUID()}.jpg`);

  try {
    // Write input buffer to temp file
    await new Promise((resolve, reject) => {
      const writeStream = createWriteStream(inputPath);
      writeStream.write(buffer);
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Extract thumbnail
    await new Promise((resolve, reject) => {
      const args = [
        '-i',
        inputPath,
        '-ss',
        VIDEO_OPTIONS.thumbnailTime,
        '-vframes',
        '1',
        '-vf',
        `scale=${IMAGE_OPTIONS.thumbnailWidth}:${IMAGE_OPTIONS.thumbnailHeight}:force_original_aspect_ratio=decrease,pad=${IMAGE_OPTIONS.thumbnailWidth}:${IMAGE_OPTIONS.thumbnailHeight}:(ow-iw)/2:(oh-ih)/2`,
        '-y',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg thumbnail error: ${error.message}`));
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg thumbnail exited with code ${code}: ${stderr}`));
        }
      });
    });

    // Read thumbnail
    const thumbnailBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const readStream = createReadStream(outputPath);
      readStream.on('data', (chunk) => chunks.push(chunk));
      readStream.on('end', () => resolve(Buffer.concat(chunks)));
      readStream.on('error', reject);
    });

    return thumbnailBuffer;
  } finally {
    // Cleanup temp files
    try {
      await unlink(inputPath);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
};

/**
 * Process media file (image or video)
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type
 * @param {string} originalFilename - Original filename
 * @returns {Promise<{
 *   processedBuffer: Buffer,
 *   thumbnailBuffer: Buffer | null,
 *   mediaType: 'photo' | 'video',
 *   width: number,
 *   height: number,
 *   duration?: number,
 *   mimeType: string
 * }>}
 */
export const processMedia = async (buffer, mimeType, originalFilename) => {
  const mediaType = getMediaType(mimeType);

  if (!mediaType) {
    throw new Error(`Unsupported media type: ${mimeType}`);
  }

  if (mediaType === 'photo') {
    const processed = await processImage(buffer, mimeType);
    const thumbnail = await generateImageThumbnail(processed.buffer);

    return {
      processedBuffer: processed.buffer,
      thumbnailBuffer: thumbnail,
      mediaType: 'photo',
      width: processed.width,
      height: processed.height,
      mimeType: processed.mimeType,
    };
  } else {
    // Check if ffmpeg is available
    const ffmpegAvailable = await checkFfmpegAvailable();

    // If the video is already MP4 and ffmpeg is not available,
    // we can still accept it without conversion
    if (!ffmpegAvailable) {
      if (mimeType === 'video/mp4') {
        // Accept MP4 videos without processing
        // We won't have a thumbnail, but the video will work
        console.warn('FFmpeg not available. Accepting MP4 video without processing.');
        return {
          processedBuffer: buffer,
          thumbnailBuffer: null, // No thumbnail without ffmpeg
          mediaType: 'video',
          width: 0, // Unknown without ffprobe
          height: 0, // Unknown without ffprobe
          duration: 0, // Unknown without ffprobe
          mimeType: 'video/mp4',
        };
      }
      throw new Error('Video processing is not available. FFmpeg is required for non-MP4 videos.');
    }

    const processed = await convertVideoToMp4(buffer, originalFilename);
    const thumbnail = await generateVideoThumbnail(processed.buffer, 'video.mp4');

    return {
      processedBuffer: processed.buffer,
      thumbnailBuffer: thumbnail,
      mediaType: 'video',
      width: processed.width,
      height: processed.height,
      duration: processed.duration,
      mimeType: 'video/mp4',
    };
  }
};

export default {
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  checkFfmpegAvailable,
  getMediaType,
  validateMedia,
  processImage,
  generateImageThumbnail,
  convertVideoToMp4,
  getVideoInfo,
  generateVideoThumbnail,
  processMedia,
};