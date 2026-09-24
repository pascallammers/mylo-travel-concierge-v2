import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { useChatSettings } from './use-chat-settings';

let root: Root;
let browser: Window;
let state: ReturnType<typeof useChatSettings>;

async function mount(url: string) {
  browser = new Window({ url });
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: browser.document, configurable: true });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  root = createRoot(browser.document.createElement('div') as unknown as HTMLDivElement);
  function Probe() {
    const value = useChatSettings();
    useEffect(() => { state = value; }, [value]);
    return null;
  }
  await act(async () => { root.render(createElement(Probe)); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  await browser?.happyDOM.close();
});

test('opens the loyalty tab from the AwardWallet return URL', async () => {
  await mount('https://mylo.test/de?tab=loyalty#settings');
  assert.equal(state.settingsOpen, true);
  assert.equal(state.settingsInitialTab, 'loyalty');
  assert.equal(browser.location.hash, '#settings');
});

test('opens the profile tab for an unknown URL tab', async () => {
  await mount('https://mylo.test/de?tab=unknown#settings');
  assert.equal(state.settingsOpen, true);
  assert.equal(state.settingsInitialTab, 'profile');
});

test('form callbacks open a selected tab and closing preserves the route and query', async () => {
  await mount('https://mylo.test/de/chat/new?query=Tokio');
  assert.equal(state.settingsOpen, false);
  await act(async () => { state.handleOpenSettings('loyalty'); });
  assert.equal(state.settingsOpen, true);
  assert.equal(state.settingsInitialTab, 'loyalty');
  assert.equal(browser.location.hash, '#settings');
  await act(async () => { state.setSettingsOpen(false); });
  assert.equal(browser.location.href, 'https://mylo.test/de/chat/new?query=Tokio');
});

test('hash changes after mount also open settings', async () => {
  await mount('https://mylo.test/de/chat/new');
  await act(async () => {
    browser.history.replaceState(null, '', '?tab=memories#settings');
    browser.dispatchEvent(new browser.HashChangeEvent('hashchange'));
  });
  assert.equal(state.settingsOpen, true);
  assert.equal(state.settingsInitialTab, 'memories');
});

test('the default settings callback selects the profile tab', async () => {
  await mount('https://mylo.test/de/chat/new');
  await act(async () => { state.handleOpenSettings(); });
  assert.equal(state.settingsInitialTab, 'profile');
  assert.equal(state.settingsOpen, true);
});
