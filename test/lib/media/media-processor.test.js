/**
 * Media Processor Tests
 * Using Vitest (project's testing framework)
 * Extensive tests for video upload functionality
 */

import { describe, it, expect } from 'vitest';
import {
  getMediaType,
  validateMedia,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
} from '../../../lib/media/media-processor.js';

describe('Media Processor', () => {
  describe('getMediaType', () => {
    it('should return "photo" for supported image MIME types', () => {
      SUPPORTED_IMAGE_TYPES.forEach((mimeType) => {
        expect(getMediaType(mimeType)).toBe('photo');
      });
    });

    it('should return "video" for supported video MIME types', () => {
      SUPPORTED_VIDEO_TYPES.forEach((mimeType) => {
        expect(getMediaType(mimeType)).toBe('video');
      });
    });

    it('should return null for unsupported MIME types', () => {
      expect(getMediaType('application/pdf')).toBeNull();
      expect(getMediaType('text/plain')).toBeNull();
      expect(getMediaType('audio/mp3')).toBeNull();
      expect(getMediaType('')).toBeNull();
      expect(getMediaType('invalid')).toBeNull();
    });

    it('should handle edge cases', () => {
      expect(getMediaType(null)).toBeNull();
      expect(getMediaType(undefined)).toBeNull();
    });
  });

  describe('validateMedia', () => {
    it('should validate supported image types', () => {
      const buffer = Buffer.alloc(1024); // 1KB
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate supported video types', () => {
      const buffer = Buffer.alloc(1024); // 1KB
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject unsupported MIME types', () => {
      const buffer = Buffer.alloc(1024);
      const result = validateMedia(buffer, 'application/pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported media type');
    });

    it('should reject images larger than MAX_IMAGE_SIZE', () => {
      const buffer = Buffer.alloc(MAX_IMAGE_SIZE + 1);
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should reject videos larger than MAX_VIDEO_SIZE', () => {
      const buffer = Buffer.alloc(MAX_VIDEO_SIZE + 1);
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should accept images at exactly MAX_IMAGE_SIZE', () => {
      const buffer = Buffer.alloc(MAX_IMAGE_SIZE);
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('should accept videos at exactly MAX_VIDEO_SIZE', () => {
      const buffer = Buffer.alloc(MAX_VIDEO_SIZE);
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(true);
    });

    it('should validate all supported image types', () => {
      const buffer = Buffer.alloc(1024);
      SUPPORTED_IMAGE_TYPES.forEach((mimeType) => {
        const result = validateMedia(buffer, mimeType);
        expect(result.valid).toBe(true);
      });
    });

    it('should validate all supported video types', () => {
      const buffer = Buffer.alloc(1024);
      SUPPORTED_VIDEO_TYPES.forEach((mimeType) => {
        const result = validateMedia(buffer, mimeType);
        expect(result.valid).toBe(true);
      });
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have correct MAX_IMAGE_SIZE (10MB)', () => {
      expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('should have correct MAX_VIDEO_SIZE (50MB)', () => {
      expect(MAX_VIDEO_SIZE).toBe(50 * 1024 * 1024);
    });

    it('should include common image types', () => {
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/png');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/gif');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/webp');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/heic');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/heif');
    });

    it('should include common video types', () => {
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/mp4');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/quicktime');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/webm');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/x-msvideo');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/x-matroska');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/3gpp');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/x-m4v');
    });

    it('should have 6 supported image types', () => {
      expect(SUPPORTED_IMAGE_TYPES).toHaveLength(6);
    });

    it('should have 7 supported video types', () => {
      expect(SUPPORTED_VIDEO_TYPES).toHaveLength(7);
    });
  });

  describe('Video Format Support', () => {
    it('should support MP4 format', () => {
      expect(getMediaType('video/mp4')).toBe('video');
    });

    it('should support QuickTime format', () => {
      expect(getMediaType('video/quicktime')).toBe('video');
    });

    it('should support AVI format', () => {
      expect(getMediaType('video/x-msvideo')).toBe('video');
    });

    it('should support WebM format', () => {
      expect(getMediaType('video/webm')).toBe('video');
    });

    it('should support Matroska format', () => {
      expect(getMediaType('video/x-matroska')).toBe('video');
    });

    it('should support 3GPP format', () => {
      expect(getMediaType('video/3gpp')).toBe('video');
    });

    it('should support M4V format', () => {
      expect(getMediaType('video/x-m4v')).toBe('video');
    });
  });

  describe('Video Size Validation', () => {
    it('should accept small videos', () => {
      const buffer = Buffer.alloc(1024); // 1KB
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(true);
    });

    it('should accept medium videos', () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(true);
    });

    it('should accept videos up to 50MB', () => {
      const buffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(true);
    });

    it('should reject videos over 50MB', () => {
      const buffer = Buffer.alloc(50 * 1024 * 1024 + 1); // 50MB + 1 byte
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('50MB');
    });

    it('should reject very large videos', () => {
      const buffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.valid).toBe(false);
    });
  });

  describe('Image Size Validation', () => {
    it('should accept small images', () => {
      const buffer = Buffer.alloc(1024); // 1KB
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('should accept medium images', () => {
      const buffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('should accept images up to 10MB', () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('should reject images over 10MB', () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024 + 1); // 10MB + 1 byte
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });
  });

  describe('MIME Type Edge Cases', () => {
    it('should handle case-sensitive MIME types', () => {
      // MIME types should be lowercase
      expect(getMediaType('IMAGE/JPEG')).toBeNull();
      expect(getMediaType('Video/MP4')).toBeNull();
    });

    it('should reject MIME types with extra parameters', () => {
      expect(getMediaType('image/jpeg; charset=utf-8')).toBeNull();
      expect(getMediaType('video/mp4; codecs="avc1.42E01E"')).toBeNull();
    });

    it('should reject partial MIME types', () => {
      expect(getMediaType('image')).toBeNull();
      expect(getMediaType('video')).toBeNull();
      expect(getMediaType('jpeg')).toBeNull();
      expect(getMediaType('mp4')).toBeNull();
    });
  });

  describe('Image Format Support', () => {
    it('should support JPEG format', () => {
      expect(getMediaType('image/jpeg')).toBe('photo');
    });

    it('should support PNG format', () => {
      expect(getMediaType('image/png')).toBe('photo');
    });

    it('should support GIF format', () => {
      expect(getMediaType('image/gif')).toBe('photo');
    });

    it('should support WebP format', () => {
      expect(getMediaType('image/webp')).toBe('photo');
    });

    it('should support HEIC format', () => {
      expect(getMediaType('image/heic')).toBe('photo');
    });

    it('should support HEIF format', () => {
      expect(getMediaType('image/heif')).toBe('photo');
    });
  });

  describe('Unsupported Formats', () => {
    it('should not support audio formats', () => {
      expect(getMediaType('audio/mp3')).toBeNull();
      expect(getMediaType('audio/wav')).toBeNull();
      expect(getMediaType('audio/ogg')).toBeNull();
      expect(getMediaType('audio/aac')).toBeNull();
    });

    it('should not support document formats', () => {
      expect(getMediaType('application/pdf')).toBeNull();
      expect(getMediaType('application/msword')).toBeNull();
      expect(getMediaType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeNull();
    });

    it('should not support archive formats', () => {
      expect(getMediaType('application/zip')).toBeNull();
      expect(getMediaType('application/x-rar-compressed')).toBeNull();
      expect(getMediaType('application/x-tar')).toBeNull();
    });

    it('should not support text formats', () => {
      expect(getMediaType('text/plain')).toBeNull();
      expect(getMediaType('text/html')).toBeNull();
      expect(getMediaType('text/css')).toBeNull();
      expect(getMediaType('text/javascript')).toBeNull();
    });
  });

  describe('Validation Error Messages', () => {
    it('should include MIME type in unsupported error message', () => {
      const buffer = Buffer.alloc(1024);
      const result = validateMedia(buffer, 'application/pdf');
      expect(result.error).toContain('application/pdf');
    });

    it('should include size limit in too large error message for images', () => {
      const buffer = Buffer.alloc(MAX_IMAGE_SIZE + 1);
      const result = validateMedia(buffer, 'image/jpeg');
      expect(result.error).toContain('10MB');
    });

    it('should include size limit in too large error message for videos', () => {
      const buffer = Buffer.alloc(MAX_VIDEO_SIZE + 1);
      const result = validateMedia(buffer, 'video/mp4');
      expect(result.error).toContain('50MB');
    });
  });

  describe('Buffer Size Edge Cases', () => {
    it('should handle 1 byte buffer', () => {
      const buffer = Buffer.alloc(1);
      expect(validateMedia(buffer, 'image/jpeg').valid).toBe(true);
      expect(validateMedia(buffer, 'video/mp4').valid).toBe(true);
    });

    it('should handle buffer at image size boundary minus 1', () => {
      const buffer = Buffer.alloc(MAX_IMAGE_SIZE - 1);
      expect(validateMedia(buffer, 'image/jpeg').valid).toBe(true);
    });

    it('should handle buffer at video size boundary minus 1', () => {
      const buffer = Buffer.alloc(MAX_VIDEO_SIZE - 1);
      expect(validateMedia(buffer, 'video/mp4').valid).toBe(true);
    });
  });

  describe('All Supported Types Validation', () => {
    it('should validate all image types with small buffer', () => {
      const buffer = Buffer.alloc(1024);
      const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
      
      imageTypes.forEach((mimeType) => {
        const result = validateMedia(buffer, mimeType);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should validate all video types with small buffer', () => {
      const buffer = Buffer.alloc(1024);
      const videoTypes = [
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
        'video/x-matroska',
        'video/3gpp',
        'video/x-m4v',
      ];
      
      videoTypes.forEach((mimeType) => {
        const result = validateMedia(buffer, mimeType);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('Size Limits', () => {
    it('should have image size limit of 10MB', () => {
      expect(MAX_IMAGE_SIZE).toBe(10485760); // 10 * 1024 * 1024
    });

    it('should have video size limit of 50MB', () => {
      expect(MAX_VIDEO_SIZE).toBe(52428800); // 50 * 1024 * 1024
    });

    it('should have video size limit 5x larger than image size limit', () => {
      expect(MAX_VIDEO_SIZE).toBe(MAX_IMAGE_SIZE * 5);
    });
  });

  describe('Type Detection Consistency', () => {
    it('should consistently return photo for all image types', () => {
      const results = SUPPORTED_IMAGE_TYPES.map(getMediaType);
      expect(results.every((r) => r === 'photo')).toBe(true);
    });

    it('should consistently return video for all video types', () => {
      const results = SUPPORTED_VIDEO_TYPES.map(getMediaType);
      expect(results.every((r) => r === 'video')).toBe(true);
    });

    it('should consistently return null for unsupported types', () => {
      const unsupportedTypes = ['audio/mp3', 'application/pdf', 'text/plain', '', null, undefined];
      const results = unsupportedTypes.map(getMediaType);
      expect(results.every((r) => r === null)).toBe(true);
    });
  });
});