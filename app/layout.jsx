import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'ParkLookup - Discover State and National Parks',
  description:
    'Discover and explore U.S. National and State Parks. Search, save favorites, and plan your next adventure.',
  keywords: 'national parks, state parks, hiking, camping, outdoors, nature, travel',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ParkLookup',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#ffffff',
    'msapplication-config': '/browserconfig.xml',
    'msapplication-TileImage': '/icons/apple-touch-icon-144x144.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />

        {/* Apple Touch Icons (iOS) */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/apple-touch-icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/icons/apple-touch-icon-114x114.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/icons/apple-touch-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/icons/apple-touch-icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/icons/apple-touch-icon-60x60.png" />
        <link rel="apple-touch-icon" sizes="57x57" href="/icons/apple-touch-icon-57x57.png" />

        {/* Web App Manifest (PWA) */}
        <link rel="manifest" href="/manifest.json" />

        {/* Font preconnects */}
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

        {/* Ahrefs Analytics */}
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="yCYcncFawMOkZgZd1aIz8A"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}