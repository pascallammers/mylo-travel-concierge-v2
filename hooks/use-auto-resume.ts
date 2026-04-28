'use client';

import { useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from '@/components/data-stream-provider';

export interface UseAutoResumeParams {
  autoResume: boolean;
  initialMessages: ChatMessage[];
  resumeStream: UseChatHelpers<ChatMessage>['resumeStream'];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}

export function useAutoResume({ autoResume, initialMessages, resumeStream, setMessages }: UseAutoResumeParams) {
  const { dataStream } = useDataStream();
  const hasAttemptedResumeRef = useRef(false);

  useEffect(() => {
    if (!autoResume) return;
    if (hasAttemptedResumeRef.current) return;

    const mostRecentMessage = initialMessages.at(-1);

    if (mostRecentMessage?.role === 'user') {
      hasAttemptedResumeRef.current = true;
      void resumeStream().catch((error) => {
        console.error('Failed to resume chat stream:', error);
      });
    }

    // we intentionally run this once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dataStream) return;
    if (dataStream.length === 0) return;

    const dataPart = dataStream[0];

    if (dataPart.type === 'data-appendMessage') {
      const message = JSON.parse(dataPart.data);
      setMessages([...initialMessages, message]);
    }
  }, [dataStream, initialMessages, setMessages]);
}
