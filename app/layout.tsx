import './globals.css';
import 'katex/dist/katex.min.css';
import 'leaflet/dist/leaflet.css';

import { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Inter, Baumans, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';
// import { Databuddy } from '@databuddy/sdk';

import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://chat.never-economy-again.com'),
  title: {
    default: 'MYLO - Dein Travel-Concierge',
    template: '%s | MYLO',
    absolute: 'MYLO - Dein Travel-Concierge',
  },
  description: 'MYLO ist dein KI-gestützter Reiseassistent für optimale Flugsuche, Miles & Points Beratung und Premium-Cabin Upgrades.',
  openGraph: {
    url: 'https://chat.never-economy-again.com',
    siteName: 'MYLO - Dein Travel-Concierge',
  },
  keywords: [
    'MYLO',
    'MYLO Travel Concierge',
    'MYLO Travel Concierge AI',
    'MYLO Travel Concierge AI Assistant',
    'MYLO Travel Concierge AI Assistant',
    'Travel Concierge',
    'Travel Concierge AI',
    'Travel Concierge AI Assistant',
    'Travel Concierge AI Assistant',
    'Lovelifepassport',
    'never-economy-again',
    'never economy again',
    'never economy again chat',
    'never economy again chat ai',
    'never economy again chat ai assistant',
    'never economy again chat ai assistant',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F9F9' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  preload: true,
  weight: 'variable',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin'],
  variable: '--font-be-vietnam-pro',
  preload: true,
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

const baumans = Baumans({
  subsets: ['latin'],
  variable: '--font-baumans',
  preload: true,
  display: 'swap',
  weight: ['400'],
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
  preload: true,
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  preload: true,
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${beVietnamPro.variable} ${baumans.variable} ${playfairDisplay.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NuqsAdapter>
          <Providers>
            <Toaster position="top-center" />
            {children}
          </Providers>
        </NuqsAdapter>
        {/* <Databuddy clientId={process.env.DATABUDDY_CLIENT_ID!} enableBatching={true} trackSessions={true} /> */}
        <Analytics />
        <SpeedInsights />
        <Script
          src="https://datafa.st/js/script.js"
          data-website-id="dfid_0zKpWPCq4DwzZy53Jegjs"
          data-domain="chat.never-economy-again.com"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
