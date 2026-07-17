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

  // A bare /new must always land on the empty chat screen. Deal context only
  // enters a new chat through explicit params (?prefill=/?query=/origin+destination)
  // set by the user's own click on a deal card — never injected server-side.
  redirect(buildNewChatRedirectUrl(locale, normalizedSearchParams));
}
