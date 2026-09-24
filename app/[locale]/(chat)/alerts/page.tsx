import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PreviewAreaView } from '@/components/shell/preview-area-view';
import { getUser } from '@/lib/auth-utils';
import { hasAreaInterest } from '@/lib/db/queries/area-interest';

interface AlertsPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Build the localized alerts page title.
 * @param props - Promised locale route parameters.
 * @returns Metadata containing the area title.
 */
export async function generateMetadata({ params }: AlertsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shell.areas' });

  return { title: t('alerts') };
}

/**
 * Load the current user's interest and explain the coming alerts feature.
 * @returns The alerts preview with its saved registration state.
 */
export default async function AlertsPage() {
  const user = await getUser();
  const registered = user ? await hasAreaInterest(user.id, 'alerts') : false;

  return <PreviewAreaView area="alerts" registered={registered} />;
}
