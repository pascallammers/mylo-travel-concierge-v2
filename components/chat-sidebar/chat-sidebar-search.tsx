/**
 * ChatSidebarSearch component with search field and mode switcher.
 * @module components/chat-sidebar/chat-sidebar-search
 */

'use client';

import { Search, Hash, Calendar, Globe } from 'lucide-react';
import { SidebarGroup, SidebarInput } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SearchMode, getSearchModeLabel } from '@/lib/chat-utils';

/**
 * Props for the ChatSidebarSearch component.
 */
export interface ChatSidebarSearchProps {
  /** Current search query */
  searchQuery: string;
  /** Callback to update search query */
  onSearchChange: (query: string) => void;
  /** Current search mode */
  searchMode: SearchMode;
  /** Callback to cycle through search modes */
  onCycleMode: () => void;
  /** Optional placeholder override */
  placeholder?: string;
}

/**
 * Returns the icon component for a given search mode.
 * @param mode - The search mode
 * @returns Icon component
 */
function getSearchModeIcon(mode: SearchMode) {
  switch (mode) {
    case 'title':
      return Hash;
    case 'date':
      return Calendar;
    case 'visibility':
      return Globe;
    case 'all':
    default:
      return Search;
  }
}

/**
 * Search component for filtering chat history with mode switching support.
 * @param props - Component props
 * @returns Search input with mode switcher
 */
export function ChatSidebarSearch({
  searchQuery,
  onSearchChange,
  searchMode,
  onCycleMode,
  placeholder,
}: ChatSidebarSearchProps) {
  const IconComponent = getSearchModeIcon(searchMode);
  const modeLabel = getSearchModeLabel(searchMode);
  const defaultPlaceholder = `Suche ${modeLabel}...`;

  return (
    <SidebarGroup className="py-2 px-2 border-b border-sidebar-border">
      <div className="relative">
        <IconComponent className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <SidebarInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              onCycleMode();
            }
          }}
          placeholder={placeholder ?? defaultPlaceholder}
          className="pl-8 pr-16"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onCycleMode}
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2',
            'h-6 px-2 text-xs',
            'bg-muted hover:bg-muted/80',
          )}
        >
          {modeLabel}
        </Button>
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground/70 px-1">
        <span className="hidden group-data-[collapsible=icon]:hidden sm:inline">
          <kbd className="rounded border px-1 py-0.5 bg-muted text-[9px]">Tab</kbd> Modus wechseln
        </span>
      </div>
    </SidebarGroup>
  );
}
