'use client';

import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>ParkLookup - Discover National Parks</title>
        <meta
          name="description"
          content="Discover and explore U.S. National Parks. Search, save favorites, and plan your next adventure."
        />
        <meta
          name="keywords"
          content="national parks, state parks, hiking, camping, outdoors, nature, travel"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#16a34a" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/icon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
        </AuthProvider>

        {/* Datafast Analytics */}
        <Script
          defer
          data-website-id="dfid_jJ7c5wg2xj1mHLaEFvESv"
          data-domain="parklookup.com"
          src="https://datafa.st/js/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}