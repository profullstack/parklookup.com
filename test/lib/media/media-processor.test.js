/**
 * Media Processor Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    });

    it('should include common video types', () => {
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/mp4');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/quicktime');
      expect(SUPPORTED_VIDEO_TYPES).toContain('video/webm');
    });
  });
});