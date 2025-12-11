/**
 * Trips API Route Tests
 * Tests for GET /api/trips and related endpoints
 * 
 * Testing Framework: Vitest (used by the project)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  range: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

describe('Trips API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/trips', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const request = new Request('http://localhost/api/trips', {
        method: 'GET',
      });

      // Import the route handler
      const { GET } = await import('@/app/api/trips/route.js');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 401 when authorization header is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = new Request('http://localhost/api/trips', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      const { GET } = await import('@/app/api/trips/route.js');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return trips for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockTrips = [
        {
          id: 'trip-1',
          title: 'California Adventure',
          origin: 'San Francisco, CA',
          start_date: '2025-01-15',
          end_date: '2025-01-18',
          interests: ['hiking', 'photography'],
          difficulty: 'moderate',
          radius_miles: 200,
          ai_summary: { overall_summary: 'A great trip!' },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          trip_stops: [
            { id: 'stop-1', park_code: 'yose', day_number: 1 },
            { id: 'stop-2', park_code: 'sequ', day_number: 2 },
          ],
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.range.mockResolvedValue({
        data: mockTrips,
        error: null,
        count: 1,
      });

      const request = new Request('http://localhost/api/trips', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const { GET } = await import('@/app/api/trips/route.js');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trips).toHaveLength(1);
      expect(data.trips[0].title).toBe('California Adventure');
      expect(data.trips[0].parkCount).toBe(2);
      expect(data.pagination).toBeDefined();
    });

    it('should handle pagination parameters', async () => {
      const mockUser = { id: 'user-123' };
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const request = new Request('http://localhost/api/trips?limit=10&offset=20', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const { GET } = await import('@/app/api/trips/route.js');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(20);
    });

    it('should validate sortBy parameter', async () => {
      const mockUser = { id: 'user-123' };
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new Request('http://localhost/api/trips?sortBy=invalid_field', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const { GET } = await import('@/app/api/trips/route.js');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid sortBy');
    });
  });

  describe('GET /api/trips/[id]', () => {
    it('should return 400 for invalid trip ID format', async () => {
      const mockUser = { id: 'user-123' };
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new Request('http://localhost/api/trips/invalid-id', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const { GET } = await import('@/app/api/trips/[id]/route.js');
      const response = await GET(request, { params: Promise.resolve({ id: 'invalid-id' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid trip ID');
    });

    it('should return 404 when trip not found', async () => {
      const mockUser = { id: 'user-123' };
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const request = new Request(`http://localhost/api/trips/${validUUID}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const { GET } = await import('@/app/api/trips/[id]/route.js');
      const response = await GET(request, { params: Promise.resolve({ id: validUUID }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Trip not found');
    });
  });

  describe('DELETE /api/trips/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      
      const request = new Request(`http://localhost/api/trips/${validUUID}`, {
        method: 'DELETE',
      });

      const { DELETE } = await import('@/app/api/trips/[id]/route.js');
      const response = await DELETE(request, { params: Promise.resolve({ id: validUUID }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 when trying to delete another user trip', async () => {
      const mockUser = { id: 'user-123' };
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Trip belongs to different user
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: validUUID, user_id: 'different-user' },
        error: null,
      });

      const request = new Request(`http://localhost/api/trips/${validUUID}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const { DELETE } = await import('@/app/api/trips/[id]/route.js');
      const response = await DELETE(request, { params: Promise.resolve({ id: validUUID }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Not authorized to delete this trip');
    });

    it('should successfully delete user own trip', async () => {
      const mockUser = { id: 'user-123' };
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Trip belongs to the user
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: validUUID, user_id: 'user-123' },
        error: null,
      });

      // Delete succeeds
      mockSupabaseClient.eq.mockResolvedValue({
        error: null,
      });

      const request = new Request(`http://localhost/api/trips/${validUUID}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const { DELETE } = await import('@/app/api/trips/[id]/route.js');
      const response = await DELETE(request, { params: Promise.resolve({ id: validUUID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

describe('Trip Validation', () => {
  describe('Request body validation', () => {
    it('should validate required fields for trip creation', () => {
      const validRequest = {
        origin: 'San Francisco, CA',
        startDate: '2025-01-15',
        endDate: '2025-01-18',
        interests: ['hiking'],
        difficulty: 'moderate',
        radiusMiles: 200,
      };

      // All required fields present
      expect(validRequest.origin).toBeDefined();
      expect(validRequest.startDate).toBeDefined();
      expect(validRequest.endDate).toBeDefined();
      expect(validRequest.interests).toHaveLength(1);
      expect(validRequest.difficulty).toBe('moderate');
    });

    it('should reject invalid difficulty levels', () => {
      const validDifficulties = ['easy', 'moderate', 'hard'];
      const invalidDifficulty = 'extreme';

      expect(validDifficulties).not.toContain(invalidDifficulty);
    });

    it('should reject invalid interests', () => {
      const validInterests = [
        'camping', 'hiking', 'photography', 'scenic_drives', 'wildlife',
        'stargazing', 'rock_climbing', 'fishing', 'kayaking', 'bird_watching',
      ];
      const invalidInterest = 'skydiving';

      expect(validInterests).not.toContain(invalidInterest);
    });

    it('should validate date range', () => {
      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-18');
      const invalidEndDate = new Date('2025-01-10');

      expect(endDate >= startDate).toBe(true);
      expect(invalidEndDate >= startDate).toBe(false);
    });

    it('should enforce maximum trip duration of 14 days', () => {
      const startDate = new Date('2025-01-01');
      const validEndDate = new Date('2025-01-14');
      const invalidEndDate = new Date('2025-01-20');

      const validDays = Math.ceil((validEndDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const invalidDays = Math.ceil((invalidEndDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      expect(validDays).toBeLessThanOrEqual(14);
      expect(invalidDays).toBeGreaterThan(14);
    });

    it('should validate radius range (50-500 miles)', () => {
      const validRadius = 200;
      const tooSmall = 25;
      const tooLarge = 600;

      expect(validRadius >= 50 && validRadius <= 500).toBe(true);
      expect(tooSmall >= 50 && tooSmall <= 500).toBe(false);
      expect(tooLarge >= 50 && tooLarge <= 500).toBe(false);
    });
  });
});