'use client';

import { useEffect, useRef } from 'react';

interface ChatPrefillOptions {
  query: string;
  hasMessages: boolean;
  initialChatId?: string;
  prefillOnly: boolean;
  sendMessage: (message: { role: 'user'; parts: { type: 'text'; text: string }[] }) => Promise<void>;
  setInput: (input: string) => void;
}

/**
 * Apply incoming query text once, preserving auto-submit on the legacy entry route.
 * @param options - Query, current chat state and input/submission callbacks.
 * @returns Nothing; initializes a new chat's input or submits the legacy handoff.
 */
export function useChatPrefill({ query, hasMessages, initialChatId, prefillOnly, sendMessage, setInput }: ChatPrefillOptions) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !query || hasMessages || initialChatId) return;
    initialized.current = true;
    if (prefillOnly) {
      setInput(query);
    } else {
      sendMessage({ parts: [{ type: 'text', text: query }], role: 'user' });
    }
  }, [query, hasMessages, initialChatId, prefillOnly, sendMessage, setInput]);
}
