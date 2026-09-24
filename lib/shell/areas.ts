import { BedDouble, Bell, CreditCard, MessageSquare, Plane, Tag, type LucideIcon } from 'lucide-react';

export type AreaSlug = 'flights' | 'deals' | 'hotels' | 'alerts' | 'cards' | 'chat';
export type AreaState = 'live' | 'beta' | 'preview';
export type AreaGroup = 'categories' | 'assistant';
export type MobileSlot = 'bar' | 'more';

export interface ShellArea {
  slug: AreaSlug;
  titleKey: `shell.areas.${AreaSlug}`;
  icon: LucideIcon;
  state: AreaState;
  group: AreaGroup;
  mobile: MobileSlot;
  href: `/${string}`;
  activePrefixes: readonly `/${string}`[];
  counter?: string;
}

export const SHELL_AREAS: readonly ShellArea[] = [
  {
    slug: 'flights',
    mobile: 'bar',
    titleKey: 'shell.areas.flights',
    icon: Plane,
    state: 'live',
    group: 'categories',
    href: '/flights',
    activePrefixes: ['/flights'],
  },
  {
    slug: 'deals',
    mobile: 'bar',
    titleKey: 'shell.areas.deals',
    icon: Tag,
    state: 'live',
    group: 'categories',
    href: '/deals',
    activePrefixes: ['/deals'],
  },
  {
    slug: 'hotels',
    mobile: 'more',
    titleKey: 'shell.areas.hotels',
    icon: BedDouble,
    state: 'beta',
    group: 'categories',
    href: '/chat/new',
    activePrefixes: [],
  },
  {
    slug: 'alerts',
    mobile: 'more',
    titleKey: 'shell.areas.alerts',
    icon: Bell,
    state: 'preview',
    group: 'categories',
    href: '/alerts',
    activePrefixes: ['/alerts'],
    counter: '0/5',
  },
  {
    slug: 'cards',
    mobile: 'more',
    titleKey: 'shell.areas.cards',
    icon: CreditCard,
    state: 'preview',
    group: 'categories',
    href: '/cards',
    activePrefixes: ['/cards'],
  },
  {
    slug: 'chat',
    mobile: 'bar',
    titleKey: 'shell.areas.chat',
    icon: MessageSquare,
    state: 'live',
    group: 'assistant',
    href: '/chat',
    activePrefixes: ['/chat', '/search', '/new'],
  },
];

export const DEFAULT_AREA_SLUG: AreaSlug = 'flights';

/**
 * Find the active area without matching partial path segments.
 * @param pathname - Current pathname without a locale prefix.
 * @returns The matching area, or null for routes outside the shell areas.
 */
export function findActiveArea(pathname: string): ShellArea | null {
  return (
    SHELL_AREAS.find(
      (area) =>
        (pathname === '/' && area.slug === 'chat') ||
        area.activePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
    ) ?? null
  );
}

/**
 * Read the primary mobile destinations in registry order.
 * @param - No arguments; the shell registry is the source of truth.
 * @returns The areas displayed in the bottom bar.
 */
export function mobileBarAreas(): readonly ShellArea[] {
  return SHELL_AREAS.filter((area) => area.mobile === 'bar');
}

/**
 * Read the remaining mobile destinations in registry order.
 * @param - No arguments; the shell registry is the source of truth.
 * @returns The areas displayed in the More sheet.
 */
export function mobileMoreAreas(): readonly ShellArea[] {
  return SHELL_AREAS.filter((area) => area.mobile === 'more');
}

/**
 * Identify conversations whose own header and input replace mobile shell chrome.
 * @param pathname - Current pathname without a locale prefix.
 * @returns Whether the chat area is active outside the exact chat-list route.
 */
export function isConversationPath(pathname: string): boolean {
  return findActiveArea(pathname)?.slug === 'chat' && pathname !== '/chat';
}
