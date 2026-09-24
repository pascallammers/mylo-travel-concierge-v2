import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, afterEach, beforeEach, mock, test } from 'node:test';
import { act, cloneElement, createContext, createElement, useContext, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import type { RailWertzahl } from '@/lib/valuation/wertzahl-loader';
import type { UserProfile } from '@/components/user-profile';

const browser = new Window({ url: 'https://mylo.test/de/flights' });
const mediaListeners = new Set<() => void>();
Object.defineProperty(browser, 'matchMedia', { value: (query: string) => ({
  matches: browser.innerWidth < 768,
  media: query,
  addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
  removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
}) });

function setViewport(width: number) {
  Object.defineProperty(browser, 'innerWidth', { value: width, configurable: true });
  for (const listener of [...mediaListeners]) listener();
}
for (const key of [
  'window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter',
  'MutationObserver', 'CustomEvent', 'Event', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
] as const) {
  Object.defineProperty(globalThis, key, {
    value: key === 'window' ? browser : browser[key], configurable: true,
  });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const require = createRequire(import.meta.url);
let pathname = '/flights';
const account = { user: { id: 'admin' }, subscriptionData: { hasSubscription: true }, isProUser: true, isLoading: false };
let settingsProps: Record<string, unknown> = {};
let profileProps: ComponentProps<typeof UserProfile> = {};
const setInstructions = () => {};
const stub = (name: string) => function Stub() { return createElement('span', { 'data-control': name }); };

mock.module('@/contexts/user-context', { namedExports: { useUser: () => account } });
mock.module('@/hooks/use-local-storage', { namedExports: { useLocalStorage: () => [true, setInstructions] } });
mock.module('@/components/settings-dialog', { namedExports: {
  SettingsDialog: (props: Record<string, unknown>) => {
    settingsProps = props;
    return props.open ? createElement('div', { 'data-settings-dialog': true },
      createElement('button', { onClick: () => (props.onOpenChange as (open: boolean) => void)(false) }, 'Close settings'),
    ) : null;
  },
} });
mock.module('@/components/user-profile', { namedExports: {
  UserProfile: (props: ComponentProps<typeof UserProfile>) => {
    profileProps = props;
    return createElement('button', { 'data-profile': true, onClick: () => props.setSettingsOpen?.(true) }, 'Settings');
  },
  NavigationMenu: stub('navigation'),
} });
mock.module('@/components/language-switcher', { namedExports: { LanguageSwitcher: stub('language') } });
mock.module('@/components/theme-switcher', { namedExports: { ThemeSwitcher: stub('theme') } });
mock.module('@/components/awardwallet/connect-button', { namedExports: {
  LoyaltyConnectButton: ({ children }: { children: ReactNode }) => createElement('button', { 'data-connect': true }, children),
} });
mock.module('@/i18n/navigation', { namedExports: {
  usePathname: () => pathname,
  Link: (props: ComponentProps<'a'>) => createElement('a', { ...props, onClick: (event) => {
    event.preventDefault();
    props.onClick?.(event);
    pathname = String(props.href);
  } }),
} });
// Test navigation state here; modal focus and CSS layout need a real browser.
const SheetContext = createContext({ open: false, onOpenChange: (_open: boolean) => {} });
mock.module('@/components/ui/sheet', { namedExports: {
  Sheet: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) =>
    createElement(SheetContext.Provider, { value: { open, onOpenChange } }, children),
  SheetTrigger: ({ children }: { children: ReactElement<ComponentProps<'button'>> }) => {
    const sheet = useContext(SheetContext);
    return cloneElement(children, { onClick: () => sheet.onOpenChange(true) });
  },
  SheetClose: ({ children }: { children: ReactElement<ComponentProps<'button'>> }) => {
    const sheet = useContext(SheetContext);
    return cloneElement(children, { onClick: () => sheet.onOpenChange(false) });
  },
  SheetContent: ({ children, className }: { children: ReactNode; className: string }) => {
    const sheet = useContext(SheetContext);
    return sheet.open ? createPortal(createElement('div', { 'data-slot': 'sheet-content', 'data-state': 'open', className }, children), document.body) : null;
  },
  SheetHeader: ({ children }: { children: ReactNode }) => createElement('header', null, children),
  SheetTitle: ({ children }: { children: ReactNode }) => createElement('h2', null, children),
  SheetDescription: ({ children }: { children: ReactNode }) => createElement('p', null, children),
} });

const { NextIntlClientProvider } = require('next-intl') as typeof import('next-intl');
const { ShellLayout } = require('./shell-layout.tsx') as typeof import('./shell-layout');
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  pathname = '/flights';
  settingsProps = {};
  profileProps = {};
  setViewport(375);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});
after(async () => { await browser.happyDOM.close(); });

async function render(wertzahl: Promise<RailWertzahl> = Promise.resolve({ kind: 'unavailable' }), locale = 'de', children?: ReactNode) {
  const shellProps: ComponentProps<typeof ShellLayout> = {
    defaultOpen: true, wertzahl, children: children ?? createElement('div', null, 'Area content'),
  };
  await act(async () => {
    root.render(createElement(NextIntlClientProvider, {
      locale, messages: locale === 'de' ? de : en, timeZone: 'UTC',
    }, createElement(ShellLayout, shellProps)));
  });
}

function buttonWithText(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent === text);
  assert.ok(button, `Expected button: ${text}`);
  return button;
}

async function click(element: HTMLElement) {
  await act(async () => { element.click(); });
}

test('mobile bar uses the registered order and highlights the current destination', async () => {
  await render();
  const nav = container.querySelector('nav');
  assert.ok(nav);
  assert.equal(nav.getAttribute('aria-label'), 'Bereiche');
  assert.deepEqual(Array.from(nav.querySelectorAll('a')).map((link) => link.textContent), ['Flüge', 'Deals', 'Hey Mylo']);
  assert.equal(nav.querySelector('[aria-current="page"]')?.getAttribute('href'), '/flights');
  assert.ok(buttonWithText('Mehr'));
  assert.equal(container.querySelector('[data-slot="sidebar"]'), null);
  assert.equal(container.querySelector('header')?.textContent, 'Flüge');
});

test('More is active on secondary areas and its rows retain badges and close when navigating', async () => {
  pathname = '/alerts';
  await render();
  assert.equal(buttonWithText('Mehr').getAttribute('aria-current'), 'page');
  await click(buttonWithText('Mehr'));
  const sheet = document.querySelector('[data-slot="sheet-content"]');
  assert.ok(sheet);
  assert.equal(sheet.getAttribute('data-state'), 'open');
  assert.ok(sheet.classList.contains('h-dvh'));
  assert.match(sheet.textContent ?? '', /Weitere Bereiche.*HotelsBeta.*AlertsGesperrt0\/5.*KreditkartenGesperrt/);
  assert.equal(sheet.querySelectorAll('.lucide-lock').length, 2);
  assert.equal(sheet.querySelector('[aria-current="page"]')?.getAttribute('href'), '/alerts');
  const hotels = sheet.querySelector<HTMLAnchorElement>('a[href="/chat/new"]');
  assert.ok(hotels);
  await click(hotels);
  assert.equal(pathname, '/chat/new');
  assert.equal(document.querySelector('[data-slot="sheet-content"][data-state="open"]'), null);
});

test('settings opened from More outlive the sheet and receive shared account data', async () => {
  await render();
  await click(buttonWithText('Mehr'));
  await click(buttonWithText('Settings'));
  assert.equal(document.querySelector('[data-slot="sheet-content"][data-state="open"]'), null);
  assert.equal(document.querySelectorAll('[data-settings-dialog]').length, 1);
  assert.equal(settingsProps.initialTab, 'profile');
  assert.equal(settingsProps.user, account.user);
  assert.equal(settingsProps.subscriptionData, account.subscriptionData);
  assert.equal(settingsProps.isProUser, true);
  assert.equal(settingsProps.isProStatusLoading, false);
  assert.equal(settingsProps.isCustomInstructionsEnabled, true);
  assert.equal(settingsProps.setIsCustomInstructionsEnabled, setInstructions);
  assert.equal(profileProps.settingsOpen, undefined);
  assert.equal(profileProps.settingsInitialTab, undefined);
});

test('known mobile value opens loyalty and closing settings resets the initial tab', async () => {
  await render(Promise.resolve({
    kind: 'value', travelEur: 1234, noPlan: null, ratedAccounts: 1, totalAccounts: 1, unreadableCount: 0, programs: [],
  }));
  await click(buttonWithText('~1.234\u00a0€'));
  assert.equal(settingsProps.initialTab, 'loyalty');
  assert.equal(settingsProps.open, true);
  await click(buttonWithText('Close settings'));
  assert.equal(settingsProps.initialTab, 'profile');
  await click(buttonWithText('Mehr'));
  await click(buttonWithText('Settings'));
  assert.equal(settingsProps.initialTab, 'profile');
});

test('an unrateable account shows a breakdown action without inventing a value', async () => {
  await render(Promise.resolve({ kind: 'no_rateable_account', totalAccounts: 1, unreadableCount: 0 }));
  assert.doesNotMatch(container.querySelector('header')?.textContent ?? '', /€|\d/);
  await click(buttonWithText('Aufschlüsselung'));
  assert.equal(settingsProps.initialTab, 'loyalty');
});

test('disconnected accounts offer the short localized connect action', async () => {
  await render(Promise.resolve({ kind: 'not_connected' }));
  assert.equal(container.querySelector('[data-connect]')?.textContent, 'Verbinden');
  assert.doesNotMatch(container.querySelector('header')?.textContent ?? '', /€|\d/);
  await render(Promise.resolve({ kind: 'not_connected' }), 'en');
  assert.equal(container.querySelector('[data-connect]')?.textContent, 'Connect');
  assert.ok(buttonWithText('More'));
});

test('unavailable values stay empty and pending values show a compact skeleton', async () => {
  pathname = '/unknown';
  await render();
  assert.equal(container.querySelector('header')?.textContent, 'FlyMylo');
  await render(new Promise(() => {}));
  assert.equal(container.querySelector('header [role="status"]')?.getAttribute('aria-label'), de.shell.wertzahl.loading);
  assert.doesNotMatch(container.querySelector('header')?.textContent ?? '', /€|\d/);
});

test('conversations render no mobile chrome while the chat list retains both surfaces', async () => {
  for (const route of ['/search/abc', '/chat/new', '/new', '/']) {
    pathname = route;
    await render();
    assert.equal(container.querySelector('header'), null, route);
    assert.equal(container.querySelector('nav'), null, route);
    assert.doesNotMatch(container.innerHTML, /max-md:\[--shell-bar-h:/);
  }
  pathname = '/chat';
  await render();
  assert.equal(container.querySelector('header')?.textContent, 'Hey Mylo');
  assert.equal(container.querySelector('nav [aria-current="page"]')?.getAttribute('href'), '/chat');
  assert.match(container.innerHTML, /max-md:\[--shell-bar-h:/);
});

test('resizing to desktop closes More and preserves the six-area desktop rail', async () => {
  await render();
  await click(buttonWithText('Mehr'));
  await act(async () => { setViewport(1024); });
  assert.equal(document.querySelector('[data-slot="sheet-content"][data-state="open"]'), null);
  const rail = container.querySelector('[data-slot="sidebar"]');
  assert.ok(rail);
  assert.deepEqual(Array.from(rail.querySelectorAll('nav a')).map((link) => link.getAttribute('href')),
    ['/flights', '/deals', '/chat/new', '/alerts', '/cards', '/chat']);
  assert.ok(rail.querySelector('[data-control="theme"]'));
});

test('the sidebar keyboard shortcut cannot open a mobile drawer', async () => {
  await render();
  await act(async () => {
    browser.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
  });
  assert.equal(document.querySelector('[data-mobile="true"]'), null);
  assert.equal(document.querySelector('[data-slot="sheet-content"]'), null);
});
