/**
 * Auth Callback Route
 * Handles OAuth callback from Supabase Auth
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const resolveRedirectUrl = (next, origin) => {
  const fallback = new URL('/', origin);

  try {
    const target = new URL(next || '/', fallback);
    return target.origin === fallback.origin ? target : fallback;
  } catch {
    return fallback;
  }
};

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(resolveRedirectUrl(next, origin));
    }
  }

  // Return to home page with error
  return NextResponse.redirect(`${origin}/auth/error`);
}
