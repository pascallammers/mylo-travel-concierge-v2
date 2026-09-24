import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { useChatPrefill } from './use-chat-prefill';

let root: Root;
let browser: Window;

async function mount(overrides: Partial<Parameters<typeof useChatPrefill>[0]> = {}) {
  browser = new Window({ url: 'https://mylo.test/de/chat/new' });
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: browser.document, configurable: true });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  root = createRoot(browser.document.createElement('div') as unknown as HTMLDivElement);
  const inputs: string[] = [];
  const submissions: unknown[] = [];
  function Probe({ query = 'Flüge nach Tokio' }: { query?: string }) {
    useChatPrefill({
      query, hasMessages: false, prefillOnly: true,
      setInput: (value) => { inputs.push(value); },
      sendMessage: async (message) => { submissions.push(message); },
      ...overrides,
    });
    return null;
  }
  const render = async (query?: string) => {
    await act(async () => { root.render(createElement(StrictMode, null, createElement(Probe, { query }))); });
  };
  await render();
  return { inputs, submissions, render };
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  await browser?.happyDOM.close();
});

test('new chat prefills once without sending, including Strict Mode and rerenders', async () => {
  const result = await mount();
  await result.render('Paris');
  assert.deepEqual(result.inputs, ['Flüge nach Tokio']);
  assert.deepEqual(result.submissions, []);
});

test('the legacy entry still submits the query once without prefilling', async () => {
  const result = await mount({ prefillOnly: false });
  await result.render();
  assert.deepEqual(result.inputs, []);
  assert.deepEqual(result.submissions, [{ role: 'user', parts: [{ type: 'text', text: 'Flüge nach Tokio' }] }]);
});

for (const overrides of [{ query: '' }, { hasMessages: true }, { initialChatId: 'existing' }]) {
  test(`does not initialize a query with ${JSON.stringify(overrides)}`, async () => {
    const result = await mount(overrides);
    assert.deepEqual(result.inputs, []);
    assert.deepEqual(result.submissions, []);
  });
}
