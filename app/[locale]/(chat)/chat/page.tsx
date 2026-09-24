import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth-utils';
import { ChatListView } from '@/components/shell';

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
 * Load the user for the full-page chat history.
 * @returns The chat list with only the user ID passed to the client.
 */
export default async function ChatPage() {
  const user = await getUser();
  return <ChatListView user={user ? { id: user.id } : null} />;
}
