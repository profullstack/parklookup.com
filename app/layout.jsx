import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'ParkLookup - Discover National Parks',
  description:
    'Discover and explore U.S. National Parks. Search, save favorites, and plan your next adventure.',
  keywords: 'national parks, state parks, hiking, camping, outdoors, nature, travel',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#16a34a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/icon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans antialiased">
        <Providers>{children}</Providers>

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