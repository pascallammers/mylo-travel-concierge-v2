import { redirect } from 'next/navigation';
import { buildNewChatRedirectUrl } from '@/lib/chat/new-chat-handoff';

interface NewPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewPage({ params, searchParams }: NewPageProps) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const normalizedSearchParams = Object.fromEntries(
    Object.entries(rawSearchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );

  redirect(buildNewChatRedirectUrl(locale, normalizedSearchParams));
}
