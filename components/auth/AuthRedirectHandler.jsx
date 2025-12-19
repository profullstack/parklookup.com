'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * AuthRedirectHandler Component
 * Handles auth-related URL fragments (like password recovery tokens)
 * and redirects to the appropriate page.
 * 
 * This component should be included in the root layout to catch
 * auth redirects from Supabase that land on the homepage.
 */
export default function AuthRedirectHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check for hash fragment with auth tokens
    const hash = window.location.hash;
    if (!hash) return;

    // Parse the hash fragment
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const type = params.get('type');
    const refreshToken = params.get('refresh_token');

    // Handle password recovery redirect
    if (accessToken && type === 'recovery') {
      // Build the reset-password URL with the hash fragment
      const resetUrl = `/reset-password${hash}`;
      
      // Clear the hash from the current URL to prevent loops
      window.history.replaceState(null, '', pathname);
      
      // Redirect to reset-password page
      router.push(resetUrl);
      return;
    }

    // Handle email confirmation (signup verification)
    if (accessToken && type === 'signup') {
      // Store the token and redirect to home or dashboard
      // The auth hook will pick up the session
      window.history.replaceState(null, '', pathname);
      router.push('/');
      return;
    }

    // Handle magic link login
    if (accessToken && type === 'magiclink') {
      window.history.replaceState(null, '', pathname);
      router.push('/');
      return;
    }

  }, [router, pathname]);

  // This component doesn't render anything
  return null;
}
