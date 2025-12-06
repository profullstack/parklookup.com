/**
 * Auth Sign Out API Route
 * POST /api/auth/signout - Sign out current user
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * POST handler for signing out
 */
export async function POST(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      // No token, already signed out
      return NextResponse.json({ success: true });
    }

    const supabase = createServerClient();

    // Sign out the user (this invalidates the token on Supabase side)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      // Still return success - client should clear local state
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}