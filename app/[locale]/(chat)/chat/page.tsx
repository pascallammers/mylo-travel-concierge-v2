import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface ChatPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Build the localized chat page title.
 * @param props - Promised locale route parameters.
 * @returns Metadata containing the area title.
 */
export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shell.areas' });

  return { title: t('chat') };
}

/**
 * Render the chat area placeholder.
 * @param props - Promised locale route parameters.
 * @returns A padded container with the localized area heading.
 */
export default async function ChatPage({ params }: ChatPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shell.areas' });

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('chat')}</h1>
    </div>
  );
}
