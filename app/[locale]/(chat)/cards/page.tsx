import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PreviewAreaView } from '@/components/shell/preview-area-view';
import { getUser } from '@/lib/auth-utils';
import { hasAreaInterest } from '@/lib/db/queries/area-interest';

interface CardsPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Build the localized cards page title.
 * @param props - Promised locale route parameters.
 * @returns Metadata containing the area title.
 */
export async function generateMetadata({ params }: CardsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shell.areas' });

  return { title: t('cards') };
}

/**
 * Load the current user's interest and explain the coming cards feature.
 * @returns The cards preview with its saved registration state.
 */
export default async function CardsPage() {
  const user = await getUser();
  const registered = user ? await hasAreaInterest(user.id, 'cards') : false;

  return <PreviewAreaView area="cards" registered={registered} />;
}
