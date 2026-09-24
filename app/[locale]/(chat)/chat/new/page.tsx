import { redirect } from 'next/navigation';
import { ChatHome } from '@/components/chat-home';
import { resolveChatNewRequest, type NewChatParams } from '@/lib/chat/new-chat-handoff';

interface ChatNewPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<NewChatParams>;
}

/**
 * Canonicalize handoff aliases before rendering the shared chat start screen.
 * @param props - Promised locale and query parameters from Next.js.
 * @returns The chat start screen, or a redirect to its canonical prefilled URL.
 */
export default async function ChatNewPage({ params, searchParams }: ChatNewPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const request = resolveChatNewRequest(locale, query);
  if (request.kind === 'redirect') redirect(request.url);
  return <ChatHome />;
}
