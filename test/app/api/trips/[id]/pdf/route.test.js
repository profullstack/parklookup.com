/**
 * Trip PDF Export API Route Tests
 * Tests for GET /api/trips/[id]/pdf endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          eq: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/pdf/trip-pdf-generator.js', () => ({
  generateTripPdf: vi.fn(),
}));

// Import after mocking
const { createServerClient } = await import('@/lib/supabase/client');
const { generateTripPdf } = await import('@/lib/pdf/trip-pdf-generator.js');
const { GET } = await import('@/app/api/trips/[id]/pdf/route.js');

describe('GET /api/trips/[id]/pdf', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockProProfile = {
    id: 'user-123',
    email: 'test@example.com',
    is_pro: true,
  };

  const mockFreeProfile = {
    id: 'user-123',
    email: 'test@example.com',
    is_pro: false,
  };

  const mockTrip = {
    id: 'trip-123',
    user_id: 'user-123',
    title: 'Test Trip',
    origin: 'Los Angeles, CA',
    start_date: '2024-06-15',
    end_date: '2024-06-18',
    interests: ['hiking'],
    difficulty: 'moderate',
    radius_miles: 200,
    ai_summary: {
      overall_summary: 'A great trip',
      packing_list: { essentials: ['Water'] },
      safety_notes: ['Stay safe'],
    },
    trip_stops: [
      {
        id: 'stop-1',
        park_code: 'yose',
        day_number: 1,
        activities: ['hiking'],
        morning_plan: 'Hike',
        afternoon_plan: 'Explore',
        evening_plan: 'Rest',
      },
    ],
  };

  const mockPdfResult = {
    buffer: Buffer.from('mock pdf content'),
    filename: 'test-trip-trip-plan.pdf',
  };

  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(),
    };

    createServerClient.mockReturnValue(mockSupabase);
    generateTripPdf.mockResolvedValue(mockPdfResult);
  });

  const createMockRequest = (token = 'valid-token') => ({
    headers: {
      get: vi.fn((name) => {
        if (name === 'authorization') {
          return token ? `Bearer ${token}` : null;
        }
        return null;
      }),
    },
  });

  it('should return 401 if no authorization token provided', async () => {
    const request = createMockRequest(null);
    const params = { id: 'trip-123' };

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 401 if token is invalid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const request = createMockRequest('invalid-token');
    const params = { id: 'trip-123' };

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 400 if trip ID is invalid', async () => {
    const request = createMockRequest();
    const params = { id: 'invalid-id' };

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid trip ID');
  });

  it('should return 403 if user is not a pro user', async () => {
    // Mock profile query to return free user
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockFreeProfile, error: null }),
    };

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profileQuery;
      }
      return {};
    });

    const request = createMockRequest();
    const params = { id: '123e4567-e89b-12d3-a456-426614174000' };

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('PDF export is a Pro feature');
  });

  it('should return 404 if trip not found', async () => {
    // Mock profile query to return pro user
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProProfile, error: null }),
    };

    // Mock trip query to return not found
    const tripQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }),
    };

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profileQuery;
      }
      if (table === 'trips') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = createMockRequest();
    const params = { id: '123e4567-e89b-12d3-a456-426614174000' };

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Trip not found');
  });

  it('should return PDF for pro user with valid trip', async () => {
    // Mock profile query to return pro user
    const profileSingle = vi.fn().mockResolvedValue({ data: mockProProfile, error: null });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

    // Mock trip query to return trip
    const tripSingle = vi.fn().mockResolvedValue({ data: mockTrip, error: null });
    const tripEq2 = vi.fn().mockReturnValue({ single: tripSingle });
    const tripEq1 = vi.fn().mockReturnValue({ eq: tripEq2 });
    const tripSelect = vi.fn().mockReturnValue({ eq: tripEq1 });

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return { select: profileSelect };
      }
      if (table === 'trips') {
        return { select: tripSelect };
      }
      return {};
    });

    const request = createMockRequest();
    const params = { id: '123e4567-e89b-12d3-a456-426614174000' };

    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('.pdf');
  });

  it('should return 500 if PDF generation fails', async () => {
    // Mock profile query to return pro user
    const profileSingle = vi.fn().mockResolvedValue({ data: mockProProfile, error: null });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

    // Mock trip query to return trip
    const tripSingle = vi.fn().mockResolvedValue({ data: mockTrip, error: null });
    const tripEq2 = vi.fn().mockReturnValue({ single: tripSingle });
    const tripEq1 = vi.fn().mockReturnValue({ eq: tripEq2 });
    const tripSelect = vi.fn().mockReturnValue({ eq: tripEq1 });

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return { select: profileSelect };
      }
      if (table === 'trips') {
        return { select: tripSelect };
      }
      return {};
    });

    // Mock PDF generation to fail
    generateTripPdf.mockRejectedValue(new Error('PDF generation failed'));

    const request = createMockRequest();
    const params = { id: '123e4567-e89b-12d3-a456-426614174000' };

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate PDF');
  });
});