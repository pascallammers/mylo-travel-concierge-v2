import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useChatListController } from './use-chat-list-controller';
import type { Chat } from '@/hooks/use-chat-history';

const chat: Chat = { id: 'chat-1', title: 'Tokio', createdAt: new Date(), userId: 'user-1', visibility: 'private' };

function controller({ currentChatId = null, failDelete = false }: {
  currentChatId?: string | null; failDelete?: boolean;
} = {}) {
  const events: string[] = [];
  let handlers!: ReturnType<typeof useChatListController>;
  function Probe() {
    // eslint-disable-next-line react-hooks/globals -- The SSR test probe exposes its handlers for assertions.
    handlers = useChatListController({
      allChats: [chat], currentChatId,
      deleteChat: async (id) => {
        events.push(`delete:${id}`);
        if (failDelete) throw new Error('Delete failed');
      },
    }, {
      push: (href) => { events.push(`push:${href}`); },
      notify: (message) => { events.push(`notify:${message}`); },
      invalidate: () => { events.push('invalidate'); },
      translate: (key, values) => key === 'untitledChat' ? 'Unbenannt' : `Öffne ${values?.title}`,
    });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return { events, ...handlers };
}

test('selection notifies, invalidates and opens the existing chat route in order', () => {
  const result = controller();
  result.handleSelectChat('chat-1');
  assert.deepEqual(result.events, ['notify:Öffne Tokio', 'invalidate', 'push:/search/chat-1']);
});

test('selection uses the translated fallback title for an unknown chat', () => {
  const result = controller();
  result.handleSelectChat('missing');
  assert.equal(result.events[0], 'notify:Öffne Unbenannt');
});

test('deleting another chat keeps the current route', async () => {
  const result = controller({ currentChatId: 'other' });
  await result.handleDeleteChat('chat-1');
  assert.deepEqual(result.events, ['delete:chat-1']);
});

test('deleting the active chat returns home', async () => {
  const result = controller({ currentChatId: 'chat-1' });
  await result.handleDeleteChat('chat-1');
  assert.deepEqual(result.events, ['delete:chat-1', 'push:/']);
});

test('failed deletion does not navigate away', async () => {
  const result = controller({ currentChatId: 'chat-1', failDelete: true });
  await assert.rejects(result.handleDeleteChat('chat-1'), /Delete failed/);
  assert.deepEqual(result.events, ['delete:chat-1']);
});
