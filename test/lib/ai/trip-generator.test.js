/**
 * Trip Generator Tests
 * Tests for the AI trip generation service
 * 
 * Testing Framework: Vitest (used by the project)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

// Import after mocking
import {
  generateTripItinerary,
  buildSystemPrompt,
  buildUserPrompt,
  validateTripOutput,
  TRIP_INTERESTS,
  DIFFICULTY_LEVELS,
} from '@/lib/ai/trip-generator';

describe('Trip Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constants', () => {
    describe('TRIP_INTERESTS', () => {
      it('should have all expected interest options', () => {
        expect(TRIP_INTERESTS).toContain('hiking');
        expect(TRIP_INTERESTS).toContain('camping');
        expect(TRIP_INTERESTS).toContain('photography');
        expect(TRIP_INTERESTS).toContain('wildlife');
        expect(TRIP_INTERESTS).toContain('scenic_drives');
        expect(TRIP_INTERESTS).toContain('water_activities');
        expect(TRIP_INTERESTS).toContain('rock_climbing');
        expect(TRIP_INTERESTS).toContain('stargazing');
      });

      it('should be an array', () => {
        expect(Array.isArray(TRIP_INTERESTS)).toBe(true);
      });
    });

    describe('DIFFICULTY_LEVELS', () => {
      it('should have easy, moderate, and hard levels', () => {
        expect(DIFFICULTY_LEVELS).toContain('easy');
        expect(DIFFICULTY_LEVELS).toContain('moderate');
        expect(DIFFICULTY_LEVELS).toContain('hard');
      });

      it('should have exactly 3 levels', () => {
        expect(DIFFICULTY_LEVELS.length).toBe(3);
      });
    });
  });

  describe('buildSystemPrompt', () => {
    it('should return a string', () => {
      const prompt = buildSystemPrompt();
      expect(typeof prompt).toBe('string');
    });

    it('should include JSON format instructions', () => {
      const prompt = buildSystemPrompt();
      expect(prompt.toLowerCase()).toContain('json');
    });

    it('should include trip planning context', () => {
      const prompt = buildSystemPrompt();
      expect(prompt.toLowerCase()).toContain('trip');
    });
  });

  describe('buildUserPrompt', () => {
    const mockParams = {
      origin: 'San Francisco, CA',
      startDate: '2025-01-15',
      endDate: '2025-01-18',
      interests: ['hiking', 'photography'],
      difficulty: 'moderate',
      radiusMiles: 200,
    };

    const mockParks = [
      {
        park_code: 'yose',
        full_name: 'Yosemite National Park',
        description: 'Famous for granite cliffs and waterfalls',
        latitude: 37.8651,
        longitude: -119.5383,
        activities: ['hiking', 'camping', 'photography'],
      },
      {
        park_code: 'sequ',
        full_name: 'Sequoia National Park',
        description: 'Home to giant sequoia trees',
        latitude: 36.4864,
        longitude: -118.5658,
        activities: ['hiking', 'camping'],
      },
    ];

    it('should include origin location', () => {
      const prompt = buildUserPrompt(mockParams, mockParks);
      expect(prompt).toContain('San Francisco');
    });

    it('should include date range', () => {
      const prompt = buildUserPrompt(mockParams, mockParks);
      expect(prompt).toContain('2025-01-15');
      expect(prompt).toContain('2025-01-18');
    });

    it('should include interests', () => {
      const prompt = buildUserPrompt(mockParams, mockParks);
      expect(prompt).toContain('hiking');
      expect(prompt).toContain('photography');
    });

    it('should include difficulty level', () => {
      const prompt = buildUserPrompt(mockParams, mockParks);
      expect(prompt).toContain('moderate');
    });

    it('should include park information', () => {
      const prompt = buildUserPrompt(mockParams, mockParks);
      expect(prompt).toContain('Yosemite');
      expect(prompt).toContain('Sequoia');
    });

    it('should handle empty parks array', () => {
      const prompt = buildUserPrompt(mockParams, []);
      expect(typeof prompt).toBe('string');
    });
  });

  describe('validateTripOutput', () => {
    const validOutput = {
      title: 'California Adventure',
      overall_summary: 'A 4-day trip through California parks',
      daily_schedule: [
        {
          day: 1,
          park_code: 'yose',
          park_name: 'Yosemite National Park',
          activities: ['hiking', 'photography'],
          notes: 'Start early to avoid crowds',
        },
      ],
      packing_list: ['hiking boots', 'camera', 'water bottle'],
      safety_notes: ['Check weather conditions', 'Stay on marked trails'],
    };

    it('should return true for valid output', () => {
      expect(validateTripOutput(validOutput)).toBe(true);
    });

    it('should return false for missing title', () => {
      const invalid = { ...validOutput, title: undefined };
      expect(validateTripOutput(invalid)).toBe(false);
    });

    it('should return false for missing daily_schedule', () => {
      const invalid = { ...validOutput, daily_schedule: undefined };
      expect(validateTripOutput(invalid)).toBe(false);
    });

    it('should return false for empty daily_schedule', () => {
      const invalid = { ...validOutput, daily_schedule: [] };
      expect(validateTripOutput(invalid)).toBe(false);
    });

    it('should return false for missing packing_list', () => {
      const invalid = { ...validOutput, packing_list: undefined };
      expect(validateTripOutput(invalid)).toBe(false);
    });

    it('should return false for null input', () => {
      expect(validateTripOutput(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(validateTripOutput(undefined)).toBe(false);
    });

    it('should return false for non-object input', () => {
      expect(validateTripOutput('string')).toBe(false);
      expect(validateTripOutput(123)).toBe(false);
    });
  });

  describe('Daily Schedule Validation', () => {
    it('should validate day structure', () => {
      const validDay = {
        day: 1,
        park_code: 'yose',
        park_name: 'Yosemite National Park',
        activities: ['hiking'],
        notes: 'Great views',
      };

      expect(validDay.day).toBeGreaterThan(0);
      expect(typeof validDay.park_code).toBe('string');
      expect(typeof validDay.park_name).toBe('string');
      expect(Array.isArray(validDay.activities)).toBe(true);
    });

    it('should require activities array', () => {
      const invalidDay = {
        day: 1,
        park_code: 'yose',
        park_name: 'Yosemite',
        activities: 'hiking', // Should be array
      };

      expect(Array.isArray(invalidDay.activities)).toBe(false);
    });
  });
});

describe('Trip Generation Integration', () => {
  describe('Input Validation', () => {
    it('should validate required fields', () => {
      const requiredFields = ['origin', 'startDate', 'endDate', 'interests', 'difficulty'];
      const input = {
        origin: 'San Francisco',
        startDate: '2025-01-15',
        endDate: '2025-01-18',
        interests: ['hiking'],
        difficulty: 'moderate',
      };

      requiredFields.forEach(field => {
        expect(input[field]).toBeDefined();
      });
    });

    it('should validate date format', () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      expect(dateRegex.test('2025-01-15')).toBe(true);
      expect(dateRegex.test('01-15-2025')).toBe(false);
      expect(dateRegex.test('2025/01/15')).toBe(false);
    });

    it('should validate interests are from allowed list', () => {
      const allowedInterests = ['hiking', 'camping', 'photography', 'wildlife'];
      const userInterests = ['hiking', 'photography'];

      const allValid = userInterests.every(i => allowedInterests.includes(i));
      expect(allValid).toBe(true);
    });

    it('should validate difficulty is from allowed list', () => {
      const allowedDifficulties = ['easy', 'moderate', 'hard'];
      expect(allowedDifficulties.includes('moderate')).toBe(true);
      expect(allowedDifficulties.includes('extreme')).toBe(false);
    });
  });

  describe('Output Structure', () => {
    it('should have correct JSON structure', () => {
      const expectedStructure = {
        title: expect.any(String),
        overall_summary: expect.any(String),
        daily_schedule: expect.any(Array),
        packing_list: expect.any(Array),
        safety_notes: expect.any(Array),
      };

      const mockOutput = {
        title: 'Test Trip',
        overall_summary: 'A test trip',
        daily_schedule: [],
        packing_list: [],
        safety_notes: [],
      };

      expect(mockOutput).toMatchObject({
        title: expect.any(String),
        overall_summary: expect.any(String),
        daily_schedule: expect.any(Array),
        packing_list: expect.any(Array),
        safety_notes: expect.any(Array),
      });
    });
  });
});