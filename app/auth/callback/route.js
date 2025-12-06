/**
 * Auth Callback Route
 * Handles OAuth callback from Supabase Auth
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to home page with error
  return NextResponse.redirect(`${origin}/auth/error`);
}