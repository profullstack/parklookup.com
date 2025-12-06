/**
 * Auth Session API Route
 * GET /api/auth/session - Get current session
 *
 * Note: Since we're not using cookies for session management,
 * the client needs to pass the access token in the Authorization header.
 * For initial implementation, we'll use a simple token-based approach.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * GET handler for fetching current session
 */
export async function GET(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ session: null, user: null });
    }

    const token = authHeader.substring(7);
    const supabase = createServerClient();

    // Verify the token and get user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ session: null, user: null });
    }

    return NextResponse.json({
      user,
      session: { access_token: token },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ session: null, user: null });
  }
}