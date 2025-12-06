'use client';

import { AuthProvider } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { InstallPrompt } from '@/components/ui/InstallPrompt';

/**
 * Client-side providers wrapper component
 * Wraps all client-side context providers and components
 */
export function Providers({ children }) {
  return (
    <AuthProvider>
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
      
      {/* PWA Components */}
      <OfflineBanner />
      <InstallPrompt />
    </AuthProvider>
  );
}