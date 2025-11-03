import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MYLO Lookout - Automatisierte Such-Überwachung',
  description:
    'Plane automatisierte Suchen und werde benachrichtigt wenn sie abgeschlossen sind. Überwache Trends, verfolge Entwicklungen und bleibe informiert.',
  keywords: 'automated search, monitoring, scheduled queries, AI lookouts, search automation, trend tracking',
  openGraph: {
    title: 'MYLO Lookout - Automatisierte Such-Überwachung',
    description:
      'Plane automatisierte Suchen und werde benachrichtigt wenn sie abgeschlossen sind. Überwache Trends, verfolge Entwicklungen und bleibe informiert.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MYLO Lookout - Automatisierte Such-Überwachung',
    description:
      'Plane automatisierte Suchen und werde benachrichtigt wenn sie abgeschlossen sind. Überwache Trends, verfolge Entwicklungen und bleibe informiert.',
  },
};

interface LookoutLayoutProps {
  children: React.ReactNode;
}

export default function LookoutLayout({ children }: LookoutLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col min-h-screen">
        <main className="flex-1" role="main" aria-label="Lookout management">
          {children}
        </main>
      </div>
    </div>
  );
}
