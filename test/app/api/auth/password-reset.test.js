/**
 * Tests for Password Reset API Routes
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  auth: {
    resetPasswordForEmail: vi.fn(),
    setSession: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(() => mockSupabase),
}));

describe('Password Reset API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email for valid email', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const { POST } = await import('@/app/api/auth/forgot-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('password reset link');
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/reset-password'),
        })
      );
    });

    it('should return error for missing email', async () => {
      const { POST } = await import('@/app/api/auth/forgot-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email is required');
    });

    it('should return error for invalid email format', async () => {
      const { POST } = await import('@/app/api/auth/forgot-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'invalid-email' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
    });

    it('should return success even if email does not exist (prevent enumeration)', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      });

      const { POST } = await import('@/app/api/auth/forgot-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return success to prevent email enumeration
      expect(response.status).toBe(200);
      expect(data.message).toContain('password reset link');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null,
      });
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { POST } = await import('@/app/api/auth/reset-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'newpassword123',
          accessToken: 'valid-reset-token',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Password has been reset successfully');
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });

    it('should return error for missing password', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: 'valid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password is required');
    });

    it('should return error for missing access token', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: 'newpassword123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Access token is required');
    });

    it('should return error for password too short', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: '12345',
          accessToken: 'valid-token',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password must be at least 6 characters');
    });

    it('should return error for invalid or expired token', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' },
      });

      const { POST } = await import('@/app/api/auth/reset-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'newpassword123',
          accessToken: 'invalid-token',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid or expired reset token');
    });

    it('should return error if password update fails', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null,
      });
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Password update failed' },
      });

      const { POST } = await import('@/app/api/auth/reset-password/route.js');

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'newpassword123',
          accessToken: 'valid-token',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password update failed');
    });
  });
});

describe('Password Reset Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full password reset flow', async () => {
    // Step 1: Request password reset
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });

    const { POST: forgotPasswordPOST } = await import(
      '@/app/api/auth/forgot-password/route.js'
    );

    const forgotRequest = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const forgotResponse = await forgotPasswordPOST(forgotRequest);
    expect(forgotResponse.status).toBe(200);

    // Step 2: Reset password with token
    mockSupabase.auth.setSession.mockResolvedValue({
      data: { session: { access_token: 'reset-token' } },
      error: null,
    });
    mockSupabase.auth.updateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    const { POST: resetPasswordPOST } = await import('@/app/api/auth/reset-password/route.js');

    const resetRequest = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: 'newSecurePassword123',
        accessToken: 'reset-token',
      }),
    });

    const resetResponse = await resetPasswordPOST(resetRequest);
    const resetData = await resetResponse.json();

    expect(resetResponse.status).toBe(200);
    expect(resetData.message).toContain('Password has been reset successfully');
  });
});
