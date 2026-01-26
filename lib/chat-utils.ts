/**
 * Chat utility functions for categorization, formatting, and search operations.
 * @module lib/chat-utils
 */

import {
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  subWeeks,
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
} from 'date-fns';

/**
 * Chat entity interface representing a conversation.
 */
export interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  userId: string;
  visibility: 'public' | 'private';
}

/**
 * Search modes for filtering chat history.
 */
export type SearchMode = 'all' | 'title' | 'date' | 'visibility';

/**
 * Categorized chats grouped by time period.
 */
export interface CategorizedChats {
  today: Chat[];
  yesterday: Chat[];
  thisWeek: Chat[];
  lastWeek: Chat[];
  thisMonth: Chat[];
  older: Chat[];
}

/**
 * Validates that a chat ID has the correct format.
 * @param id - The chat ID to validate
 * @returns True if the ID is valid, false otherwise
 */
export function isValidChatId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0;
}

/**
 * Categorizes chats into time-based groups (today, yesterday, this week, etc.).
 * @param chats - Array of chats to categorize
 * @returns Object containing categorized chat arrays
 */
export function categorizeChatsByDate(chats: Chat[]): CategorizedChats {
  const today: Chat[] = [];
  const yesterday: Chat[] = [];
  const thisWeek: Chat[] = [];
  const lastWeek: Chat[] = [];
  const thisMonth: Chat[] = [];
  const older: Chat[] = [];

  const oneWeekAgo = subWeeks(new Date(), 1);

  chats.forEach((chat) => {
    const chatDate = new Date(chat.createdAt);

    if (isToday(chatDate)) {
      today.push(chat);
    } else if (isYesterday(chatDate)) {
      yesterday.push(chat);
    } else if (isThisWeek(chatDate)) {
      thisWeek.push(chat);
    } else if (chatDate >= oneWeekAgo && !isThisWeek(chatDate)) {
      lastWeek.push(chat);
    } else if (isThisMonth(chatDate)) {
      thisMonth.push(chat);
    } else {
      older.push(chat);
    }
  });

  return { today, yesterday, thisWeek, lastWeek, thisMonth, older };
}

// Cache for formatCompactTime
const timeFormatCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds cache duration
const MAX_CACHE_SIZE = 1000;

/**
 * Formats a date as a compact relative time string (e.g., "vor 5m", "vor 2h").
 * Uses an internal cache for performance optimization.
 * @param date - The date to format
 * @returns Formatted relative time string in German
 */
export function formatCompactTime(date: Date): string {
  const now = new Date();
  const dateKey = date.getTime().toString();
  const cached = timeFormatCache.get(dateKey);

  // Check if cache is valid (less than 30 seconds old)
  if (cached && now.getTime() - cached.timestamp < CACHE_DURATION) {
    return cached.result;
  }

  const seconds = differenceInSeconds(now, date);

  let result: string;
  if (seconds < 60) {
    result = `vor ${seconds}s`;
  } else {
    const minutes = differenceInMinutes(now, date);
    if (minutes < 60) {
      result = `vor ${minutes}m`;
    } else {
      const hours = differenceInHours(now, date);
      if (hours < 24) {
        result = `vor ${hours}h`;
      } else {
        const days = differenceInDays(now, date);
        if (days < 7) {
          result = `vor ${days}T`;
        } else {
          const weeks = differenceInWeeks(now, date);
          if (weeks < 4) {
            result = `vor ${weeks}W`;
          } else {
            const months = differenceInMonths(now, date);
            if (months < 12) {
              result = `vor ${months}Mo`;
            } else {
              const years = differenceInYears(now, date);
              result = `vor ${years}J`;
            }
          }
        }
      }
    }
  }

  // Keep cache size reasonable
  if (timeFormatCache.size > MAX_CACHE_SIZE) {
    timeFormatCache.clear();
  }

  timeFormatCache.set(dateKey, { result, timestamp: now.getTime() });
  return result;
}

/**
 * Clears the time format cache. Useful for testing.
 */
export function clearTimeFormatCache(): void {
  timeFormatCache.clear();
}

/**
 * Performs a fuzzy search to check if a query matches text.
 * Supports exact substring matching and character-order matching.
 * @param query - The search query
 * @param text - The text to search in
 * @returns True if the query matches the text
 */
export function fuzzySearch(query: string, text: string): boolean {
  if (!query) return true;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest priority
  if (textLower.includes(queryLower)) return true;

  // Fuzzy matching - check if all characters in query appear in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length;
}

/**
 * Parses a date string in DD/MM/YY format.
 * @param dateStr - The date string to parse
 * @returns Parsed Date object or null if invalid
 */
export function parseDateQuery(dateStr: string): Date | null {
  // Check if the string matches DD/MM/YY format
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
  const match = dateStr.match(dateRegex);

  if (!match) return null;

  const [, dayStr, monthStr, yearStr] = match;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10) - 1; // Month is 0-indexed in Date
  const year = 2000 + parseInt(yearStr, 10); // Convert YY to YYYY (assuming 20XX)

  // Validate the date components
  if (day < 1 || day > 31 || month < 0 || month > 11) {
    return null;
  }

  const date = new Date(year, month, day);

  // Check if the date is valid (handles cases like 31/02/25)
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
    return null;
  }

  return date;
}

/**
 * Checks if two dates are on the same calendar day.
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Performs an advanced search on a chat with support for special prefixes.
 * Supported prefixes: public:, private:, today:, week:, month:, date:DD/MM/YY
 * @param chat - The chat to search
 * @param query - The search query (may include prefixes)
 * @param mode - The search mode
 * @returns True if the chat matches the search criteria
 */
export function advancedSearch(chat: Chat, query: string, mode: SearchMode): boolean {
  if (!query) return true;

  // Handle special search prefixes
  if (query.startsWith('public:')) {
    return chat.visibility === 'public' && fuzzySearch(query.slice(7), chat.title);
  }

  if (query.startsWith('private:')) {
    return chat.visibility === 'private' && fuzzySearch(query.slice(8), chat.title);
  }

  if (query.startsWith('today:')) {
    return isToday(new Date(chat.createdAt)) && fuzzySearch(query.slice(6), chat.title);
  }

  if (query.startsWith('week:')) {
    return isThisWeek(new Date(chat.createdAt)) && fuzzySearch(query.slice(5), chat.title);
  }

  if (query.startsWith('month:')) {
    return isThisMonth(new Date(chat.createdAt)) && fuzzySearch(query.slice(6), chat.title);
  }

  // Handle date: prefix with DD/MM/YY format
  if (query.startsWith('date:')) {
    const dateQuery = query.slice(5).trim();
    const parsedDate = parseDateQuery(dateQuery);
    if (parsedDate) {
      return isSameDay(new Date(chat.createdAt), parsedDate);
    }
    // If not a valid DD/MM/YY format, fall back to fuzzy search on the date query
    return fuzzySearch(dateQuery, new Date(chat.createdAt).toLocaleDateString());
  }

  // Regular search based on mode
  switch (mode) {
    case 'title':
      return fuzzySearch(query, chat.title);
    case 'date': {
      // In date mode, first try to parse as DD/MM/YY format
      const parsedDate = parseDateQuery(query.trim());
      if (parsedDate) {
        return isSameDay(new Date(chat.createdAt), parsedDate);
      }
      // If not DD/MM/YY format, fall back to fuzzy search on date string
      const dateStr = new Date(chat.createdAt).toLocaleDateString();
      return fuzzySearch(query, dateStr);
    }
    case 'visibility':
      return fuzzySearch(query, chat.visibility);
    case 'all':
    default:
      return (
        fuzzySearch(query, chat.title) ||
        fuzzySearch(query, chat.visibility) ||
        fuzzySearch(query, new Date(chat.createdAt).toLocaleDateString())
      );
  }
}

/**
 * Returns icon and label information for a search mode.
 * @param mode - The search mode
 * @returns Object with label string for the mode
 */
export function getSearchModeLabel(mode: SearchMode): string {
  switch (mode) {
    case 'title':
      return 'Titel';
    case 'date':
      return 'Datum';
    case 'visibility':
      return 'Sichtbarkeit';
    case 'all':
    default:
      return 'Alle';
  }
}

/**
 * Array of all available search modes in cycle order.
 */
export const SEARCH_MODES: SearchMode[] = ['all', 'title', 'date', 'visibility'];

/**
 * Returns the next search mode in the cycle.
 * @param currentMode - The current search mode
 * @returns The next search mode
 */
export function getNextSearchMode(currentMode: SearchMode): SearchMode {
  const currentIndex = SEARCH_MODES.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % SEARCH_MODES.length;
  return SEARCH_MODES[nextIndex];
}
