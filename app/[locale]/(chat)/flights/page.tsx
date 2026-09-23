import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface FlightsPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Build the localized flights page title.
 * @param props - Promised locale route parameters.
 * @returns Metadata containing the area title.
 */
export async function generateMetadata({ params }: FlightsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shell.areas' });

  return { title: t('flights') };
}

/**
 * Render the flights area placeholder.
 * @param props - Promised locale route parameters.
 * @returns A padded container with the localized area heading.
 */
export default async function FlightsPage({ params }: FlightsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shell.areas' });

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('flights')}</h1>
    </div>
  );
}
