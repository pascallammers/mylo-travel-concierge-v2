import { BedDouble, Bell, CreditCard, MessageSquare, Plane, Tag, type LucideIcon } from 'lucide-react';

export type AreaSlug = 'flights' | 'deals' | 'hotels' | 'alerts' | 'cards' | 'chat';
export type AreaState = 'live' | 'beta' | 'preview';
export type AreaGroup = 'categories' | 'assistant';

export interface ShellArea {
  slug: AreaSlug;
  titleKey: `shell.areas.${AreaSlug}`;
  icon: LucideIcon;
  state: AreaState;
  group: AreaGroup;
  href: `/${string}`;
  activePrefixes: readonly `/${string}`[];
  counter?: string;
}

export const SHELL_AREAS: readonly ShellArea[] = [
  {
    slug: 'flights',
    titleKey: 'shell.areas.flights',
    icon: Plane,
    state: 'live',
    group: 'categories',
    href: '/flights',
    activePrefixes: ['/flights'],
  },
  {
    slug: 'deals',
    titleKey: 'shell.areas.deals',
    icon: Tag,
    state: 'live',
    group: 'categories',
    href: '/deals',
    activePrefixes: ['/deals'],
  },
  {
    slug: 'hotels',
    titleKey: 'shell.areas.hotels',
    icon: BedDouble,
    state: 'beta',
    group: 'categories',
    href: '/chat/new',
    activePrefixes: [],
  },
  {
    slug: 'alerts',
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
    titleKey: 'shell.areas.cards',
    icon: CreditCard,
    state: 'preview',
    group: 'categories',
    href: '/cards',
    activePrefixes: ['/cards'],
  },
  {
    slug: 'chat',
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
