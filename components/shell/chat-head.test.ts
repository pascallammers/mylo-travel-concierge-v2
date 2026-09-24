import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';
import { createElement, type ReactNode, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import de from '@/messages/de.json';
import type { Navbar as NavbarType } from '@/components/navbar';

const require = createRequire(import.meta.url);
const { NextIntlClientProvider } = require('next-intl') as typeof import('next-intl');
type HeaderProps = ComponentProps<typeof NavbarType>;
let sidebar = { open: true, isMobile: false };
let settingsProps: Record<string, unknown> | null = null;
let shareProps: Record<string, unknown> | null = null;
const stub = (name: string) => function Stub() { return createElement('span', { 'data-control': name }); };
const passthrough = ({ children }: { children: ReactNode }) => children;

mock.module('@/components/settings-dialog', { namedExports: {
  SettingsDialog: (props: Record<string, unknown>) => { settingsProps = props; return null; },
} });
mock.module('@/components/ui/sidebar', { namedExports: {
  useSidebarOptional: () => sidebar,
  SidebarTrigger: stub('sidebar-trigger'),
} });
mock.module('@/components/user-profile', { namedExports: {
  UserProfile: stub('profile'), NavigationMenu: stub('navigation'),
} });
mock.module('@/components/awardwallet', { namedExports: {
  LoyaltyHeaderBanner: stub('loyalty-banner'), LoyaltyHeaderWidget: stub('loyalty-widget'),
} });
mock.module('@/components/language-switcher', { namedExports: { LanguageSwitcher: stub('language') } });
mock.module('@/components/ui/tooltip', { namedExports: {
  Tooltip: passthrough, TooltipTrigger: passthrough, TooltipContent: passthrough,
} });
mock.module('@/i18n/navigation', { namedExports: {
  Link: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children),
} });
mock.module('next/navigation', { namedExports: {
  useRouter: () => ({ push: () => {} }), usePathname: () => '/search/chat-1',
} });
mock.module('@/components/share/share-button', { namedExports: {
  ShareButton: (props: Record<string, unknown>) => { shareProps = props; return stub('share')(); },
} });
// Avoid loading the unrelated share-dialog barrel while keeping the extracted action real.
const { ChatShareAction } = require('../share/chat-share-action.tsx') as typeof import('../share/chat-share-action');
mock.module('@/components/share', { namedExports: { ChatShareAction, ShareButton: stub('share') } });

const { ChatHead } = require('./chat-head.tsx') as typeof import('./chat-head');
const { Navbar } = require('../navbar.tsx') as typeof import('../navbar');
const user = { id: 'owner' } as NonNullable<HeaderProps['user']>;
const props: HeaderProps = {
  isDialogOpen: false, chatId: null, selectedVisibilityType: 'private',
  onVisibilityChange: async () => {}, status: 'ready', user, isOwner: true,
};

function render(component: typeof ChatHead | typeof Navbar, overrides: Partial<HeaderProps> = {}) {
  return renderToStaticMarkup(createElement(NextIntlClientProvider, {
    locale: 'de', messages: de, timeZone: 'UTC',
  }, createElement(component, { ...props, ...overrides })));
}

beforeEach(() => {
  sidebar = { open: true, isMobile: false };
  settingsProps = null;
  shareProps = null;
});

test('desktop shell header links to the list and new chat without global navbar controls', () => {
  const html = render(ChatHead);
  assert.match(html, /href="\/chat"/);
  assert.match(html, /Alle Chats/);
  assert.match(html, /href="\/chat\/new"/);
  assert.match(html, /Neuer Chat/);
  assert.match(html, /md:left-\[var\(--sidebar-width\)\]/);
  assert.doesNotMatch(html, /data-control=/);
});

test('the header reaches the left edge when the offcanvas rail is collapsed', () => {
  sidebar.open = false;
  const html = render(ChatHead);
  assert.match(html, /md:left-0/);
  assert.doesNotMatch(html, /md:left-\[var\(--sidebar-width\)\]/);
});

test('mobile retains the rail trigger', () => {
  sidebar.isMobile = true;
  assert.match(render(ChatHead), /data-control="sidebar-trigger"/);
});

test('the shell forwards all existing controlled settings data', () => {
  const subscriptionData = { hasSubscription: true };
  const setSettingsOpen = () => {};
  const setIsCustomInstructionsEnabled = () => {};
  render(ChatHead, {
    settingsOpen: true, setSettingsOpen, settingsInitialTab: 'loyalty', subscriptionData,
    isProUser: true, isProStatusLoading: false, isCustomInstructionsEnabled: true, setIsCustomInstructionsEnabled,
  });
  assert.deepEqual(settingsProps, {
    open: true, onOpenChange: setSettingsOpen, user, subscriptionData,
    isProUser: true, isProStatusLoading: false, isCustomInstructionsEnabled: true,
    setIsCustomInstructionsEnabled, initialTab: 'loyalty',
  });
});

test('only an authenticated owner gets the share action and visibility callback', async () => {
  const changes: string[] = [];
  render(ChatHead, { chatId: 'chat-1', onVisibilityChange: (value) => { changes.push(value); } });
  assert.equal(shareProps?.chatId, 'chat-1');
  assert.equal(shareProps?.user, user);
  assert.deepEqual(shareProps?.labels, {
    share: 'Teilen', shared: 'Geteilt', sharedPage: 'Dieser Chat wurde geteilt',
    sharedByOther: 'Dieser Chat wurde von jemand anderem geteilt',
  });
  const onChange = shareProps?.onVisibilityChange as (value: 'public') => Promise<void>;
  await onChange('public');
  assert.deepEqual(changes, ['public']);
});

test('public visitors see the localized shared indicator without an owner action', () => {
  const html = render(ChatHead, { chatId: 'chat-1', user: null, isOwner: false, selectedVisibilityType: 'public' });
  assert.match(html, /Geteilt/);
  assert.match(html, /Dieser Chat wurde geteilt/);
  assert.equal(shareProps, null);
});

test('private non-owner chats and empty chats have no share action', () => {
  assert.doesNotMatch(render(ChatHead, { chatId: 'chat-1', isOwner: false }), /Geteilt|data-control="share"/);
  assert.doesNotMatch(render(ChatHead), /Geteilt|data-control="share"/);
  assert.equal(shareProps, null);
});

test('the legacy navbar keeps its original route, labels and global controls', () => {
  const html = render(Navbar, { chatId: 'chat-1', isOwner: false, selectedVisibilityType: 'public' });
  assert.match(html, /href="\/new"/);
  assert.match(html, /Shared/);
  assert.match(html, /This is someone else&#x27;s shared page/);
  for (const name of ['profile', 'language', 'navigation', 'loyalty-banner']) {
    assert.match(html, new RegExp(`data-control="${name}"`));
  }
  assert.doesNotMatch(html, /Alle Chats|sidebar-trigger/);
});

test('the shell header preserves the navbar background behavior', () => {
  for (const status of ['streaming', 'ready', 'submitted']) {
    const html = render(ChatHead, { status });
    assert.equal(html.includes('backdrop-blur-sm'), status !== 'submitted');
  }
  assert.match(render(ChatHead, { isDialogOpen: true }), /bg-transparent pointer-events-none/);
});
