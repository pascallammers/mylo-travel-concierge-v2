'use client';

import { useEffect, useRef } from 'react';

interface InitialQueryOptions {
  query: string;
  hasMessages: boolean;
  initialChatId?: string;
  sendMessage: (message: { role: 'user'; parts: { type: 'text'; text: string }[] }) => Promise<void>;
}

/**
 * Send the handoff query of a new chat exactly once, on `/` and `/chat/new` alike.
 * @param options - Query, current chat state and the submission callback.
 * @returns Nothing; submits the query as the first user message.
 */
export function useInitialQuery({ query, hasMessages, initialChatId, sendMessage }: InitialQueryOptions) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !query || hasMessages || initialChatId) return;
    initialized.current = true;
    sendMessage({ parts: [{ type: 'text', text: query }], role: 'user' });
  }, [query, hasMessages, initialChatId, sendMessage]);
}
