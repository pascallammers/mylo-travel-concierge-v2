import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import type { PreviewAreaSlug, RegisterAreaInterestResult } from '@/lib/shell/preview-areas';

const register = mock.fn(async (_area: PreviewAreaSlug): Promise<RegisterAreaInterestResult> => ({ ok: true }));
mock.module('@/app/area-interest-actions', { namedExports: { registerAreaInterestAction: register } });
const require = createRequire(import.meta.url);
const { NextIntlClientProvider } = require('next-intl') as typeof import('next-intl');
const { NotifyMeButton } = require('./notify-me-button.tsx') as typeof import('./notify-me-button');

let root: Root;
let browser: Window;
let container: HTMLDivElement;

async function mount(registered = false, area: PreviewAreaSlug = 'alerts', locale = 'de') {
  browser = new Window({ url: 'https://mylo.test/de/alerts' });
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: browser.document, configurable: true });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = browser.document.createElement('div') as unknown as HTMLDivElement;
  browser.document.body.appendChild(container as unknown as Parameters<typeof browser.document.body.appendChild>[0]);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(NextIntlClientProvider, {
      locale, messages: locale === 'de' ? de : en, timeZone: 'UTC',
    }, createElement(NotifyMeButton, { area, registered })));
  });
}

function button() {
  const element = container.querySelector('button');
  assert.ok(element);
  return element;
}

beforeEach(() => { register.mock.resetCalls(); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  await browser?.happyDOM.close();
});

test('saved interest starts with a inert confirmation and does not submit', async () => {
  await mount(true);
  assert.equal(button().textContent, de.shell.preview.notified);
  assert.equal(button().getAttribute('aria-disabled'), 'true');
  await act(async () => { button().click(); });
  assert.equal(register.mock.callCount(), 0);
});

test('a successful click confirms interest in the selected area and keeps focus', async () => {
  await mount(false, 'cards');
  button().focus();
  assert.ok(browser.document.activeElement === button(), 'button takes focus');
  await act(async () => { button().click(); });
  assert.ok(browser.document.activeElement === button(), 'focus stays on the button');
  assert.equal(button().textContent, de.shell.preview.notified);
  assert.equal(button().getAttribute('aria-disabled'), 'true');
  assert.deepEqual(register.mock.calls[0].arguments, ['cards']);
});

test('pending registration ignores repeat clicks until confirmation', async () => {
  let finish: (result: RegisterAreaInterestResult) => void = () => {};
  register.mock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await mount();
  await act(async () => { button().click(); });
  assert.equal(button().getAttribute('aria-disabled'), 'true');
  assert.equal(button().getAttribute('aria-busy'), 'true');
  await act(async () => { button().click(); });
  assert.equal(register.mock.callCount(), 1);
  await act(async () => { finish({ ok: true }); });
  assert.equal(button().textContent, de.shell.preview.notified);
});

test('unauthenticated visitors see the sign-in hint without confirmation', async () => {
  register.mock.mockImplementationOnce(async () => ({ ok: false, reason: 'unauthenticated' }));
  await mount();
  await act(async () => { button().click(); });
  assert.equal(container.querySelector('[role="alert"]')?.textContent, de.shell.preview.signInRequired);
  assert.equal(button().getAttribute('aria-disabled'), 'false');
  assert.equal(button().textContent, de.shell.preview.notifyMe);
});

test('a thrown error shows feedback and allows a successful retry', async () => {
  register.mock.mockImplementationOnce(async () => { throw new Error('Database unavailable'); });
  await mount();
  await act(async () => { button().click(); });
  assert.equal(container.querySelector('[role="alert"]')?.textContent, de.shell.preview.error);
  assert.equal(button().getAttribute('aria-disabled'), 'false');
  await act(async () => { button().click(); });
  assert.equal(button().textContent, de.shell.preview.notified);
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test('an unknown area result shows the generic error', async () => {
  register.mock.mockImplementationOnce(async () => ({ ok: false, reason: 'unknown_area' }));
  await mount();
  await act(async () => { button().click(); });
  assert.equal(container.querySelector('[role="alert"]')?.textContent, de.shell.preview.error);
  assert.equal(button().getAttribute('aria-disabled'), 'false');
});

test('English uses the same notification states', async () => {
  await mount(false, 'alerts', 'en');
  assert.equal(button().textContent, en.shell.preview.notifyMe);
  await act(async () => { button().click(); });
  assert.equal(button().textContent, en.shell.preview.notified);
});
