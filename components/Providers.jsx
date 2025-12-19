'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { TrackingProvider } from '@/contexts/TrackingContext';
import Header from '@/components/layout/Header';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { InstallPrompt } from '@/components/ui/InstallPrompt';
import AuthRedirectHandler from '@/components/auth/AuthRedirectHandler';

/**
 * Client-side providers wrapper component
 * Wraps all client-side context providers and components
 */
export function Providers({ children }) {
  return (
    <AuthProvider>
      <TrackingProvider>
        {/* Handle auth redirects (password recovery, email confirmation, etc.) */}
        <AuthRedirectHandler />
        
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
        
        {/* PWA Components */}
        <OfflineBanner />
        <InstallPrompt />
      </TrackingProvider>
    </AuthProvider>
  );
}