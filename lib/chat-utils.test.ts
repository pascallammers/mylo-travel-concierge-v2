import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidChatId,
  categorizeChatsByDate,
  formatCompactTime,
  clearTimeFormatCache,
  fuzzySearch,
  parseDateQuery,
  isSameDay,
  advancedSearch,
  getSearchModeLabel,
  getNextSearchMode,
  SEARCH_MODES,
  Chat,
  SearchMode,
} from './chat-utils';

// Helper to create a chat with a specific date
function createChat(id: string, daysAgo: number, visibility: 'public' | 'private' = 'private'): Chat {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    title: `Chat ${id}`,
    createdAt: date,
    userId: 'user-1',
    visibility,
  };
}

describe('isValidChatId', () => {
  it('accepts alphanumeric IDs', () => {
    assert.equal(isValidChatId('abc123'), true);
    assert.equal(isValidChatId('ABC123'), true);
  });

  it('accepts IDs with underscores and hyphens', () => {
    assert.equal(isValidChatId('chat_123'), true);
    assert.equal(isValidChatId('chat-123'), true);
    assert.equal(isValidChatId('a-b_c'), true);
  });

  it('rejects empty strings', () => {
    assert.equal(isValidChatId(''), false);
  });

  it('rejects IDs with special characters', () => {
    assert.equal(isValidChatId('chat@123'), false);
    assert.equal(isValidChatId('chat 123'), false);
    assert.equal(isValidChatId('chat.123'), false);
  });
});

describe('categorizeChatsByDate', () => {
  it('categorizes today\'s chats correctly', () => {
    const chats = [createChat('1', 0)];
    const result = categorizeChatsByDate(chats);
    assert.equal(result.today.length, 1);
    assert.equal(result.yesterday.length, 0);
  });

  it('categorizes yesterday\'s chats correctly', () => {
    const chats = [createChat('1', 1)];
    const result = categorizeChatsByDate(chats);
    assert.equal(result.today.length, 0);
    assert.equal(result.yesterday.length, 1);
  });

  it('categorizes older chats correctly', () => {
    const chats = [createChat('1', 60)];
    const result = categorizeChatsByDate(chats);
    assert.equal(result.older.length, 1);
  });

  it('handles empty array', () => {
    const result = categorizeChatsByDate([]);
    assert.equal(result.today.length, 0);
    assert.equal(result.yesterday.length, 0);
    assert.equal(result.thisWeek.length, 0);
    assert.equal(result.lastWeek.length, 0);
    assert.equal(result.thisMonth.length, 0);
    assert.equal(result.older.length, 0);
  });
});

describe('formatCompactTime', () => {
  beforeEach(() => {
    clearTimeFormatCache();
  });

  it('formats seconds ago', () => {
    const date = new Date();
    date.setSeconds(date.getSeconds() - 30);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+s/);
  });

  it('formats minutes ago', () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - 5);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+m/);
  });

  it('formats hours ago', () => {
    const date = new Date();
    date.setHours(date.getHours() - 3);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+h/);
  });

  it('formats days ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 3);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+T/);
  });

  it('formats weeks ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+W/);
  });

  it('formats months ago', () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+Mo/);
  });

  it('formats years ago', () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    const result = formatCompactTime(date);
    assert.match(result, /vor \d+J/);
  });

  it('uses cache for repeated calls', () => {
    const date = new Date();
    const result1 = formatCompactTime(date);
    const result2 = formatCompactTime(date);
    assert.equal(result1, result2);
  });
});

describe('fuzzySearch', () => {
  it('returns true for empty query', () => {
    assert.equal(fuzzySearch('', 'any text'), true);
  });

  it('finds exact substring matches', () => {
    assert.equal(fuzzySearch('test', 'this is a test'), true);
    assert.equal(fuzzySearch('TEST', 'this is a test'), true);
  });

  it('performs case-insensitive matching', () => {
    assert.equal(fuzzySearch('Test', 'testing'), true);
    assert.equal(fuzzySearch('HELLO', 'hello world'), true);
  });

  it('finds fuzzy matches with characters in order', () => {
    assert.equal(fuzzySearch('tst', 'test'), true);
    assert.equal(fuzzySearch('hw', 'hello world'), true);
  });

  it('rejects non-matching queries', () => {
    assert.equal(fuzzySearch('xyz', 'hello'), false);
    assert.equal(fuzzySearch('zyx', 'xyz'), false); // wrong order
  });
});

describe('parseDateQuery', () => {
  it('parses valid DD/MM/YY format', () => {
    const result = parseDateQuery('22/05/25');
    assert.ok(result instanceof Date);
    assert.equal(result?.getDate(), 22);
    assert.equal(result?.getMonth(), 4); // May is 0-indexed
    assert.equal(result?.getFullYear(), 2025);
  });

  it('parses single digit day and month', () => {
    const result = parseDateQuery('1/1/25');
    assert.ok(result instanceof Date);
    assert.equal(result?.getDate(), 1);
    assert.equal(result?.getMonth(), 0);
  });

  it('returns null for invalid format', () => {
    assert.equal(parseDateQuery('2025-05-22'), null);
    assert.equal(parseDateQuery('22-05-25'), null);
    assert.equal(parseDateQuery('invalid'), null);
  });

  it('returns null for invalid dates', () => {
    assert.equal(parseDateQuery('31/02/25'), null); // Feb 31 doesn't exist
    assert.equal(parseDateQuery('00/05/25'), null);
    assert.equal(parseDateQuery('22/13/25'), null); // Month 13 doesn't exist
  });
});

describe('isSameDay', () => {
  it('returns true for same day', () => {
    const date1 = new Date(2025, 4, 22, 10, 0);
    const date2 = new Date(2025, 4, 22, 18, 30);
    assert.equal(isSameDay(date1, date2), true);
  });

  it('returns false for different days', () => {
    const date1 = new Date(2025, 4, 22);
    const date2 = new Date(2025, 4, 23);
    assert.equal(isSameDay(date1, date2), false);
  });

  it('returns false for different months', () => {
    const date1 = new Date(2025, 4, 22);
    const date2 = new Date(2025, 5, 22);
    assert.equal(isSameDay(date1, date2), false);
  });

  it('returns false for different years', () => {
    const date1 = new Date(2025, 4, 22);
    const date2 = new Date(2024, 4, 22);
    assert.equal(isSameDay(date1, date2), false);
  });
});

describe('advancedSearch', () => {
  const chat: Chat = {
    id: '1',
    title: 'My Test Chat',
    createdAt: new Date(),
    userId: 'user-1',
    visibility: 'public',
  };

  it('returns true for empty query', () => {
    assert.equal(advancedSearch(chat, '', 'all'), true);
  });

  it('handles public: prefix', () => {
    assert.equal(advancedSearch(chat, 'public:Test', 'all'), true);
    assert.equal(advancedSearch({ ...chat, visibility: 'private' }, 'public:Test', 'all'), false);
  });

  it('handles private: prefix', () => {
    assert.equal(advancedSearch({ ...chat, visibility: 'private' }, 'private:Test', 'all'), true);
    assert.equal(advancedSearch(chat, 'private:Test', 'all'), false);
  });

  it('handles today: prefix', () => {
    assert.equal(advancedSearch(chat, 'today:Test', 'all'), true);
    const oldChat = { ...chat, createdAt: new Date(2020, 0, 1) };
    assert.equal(advancedSearch(oldChat, 'today:', 'all'), false);
  });

  it('handles date: prefix with DD/MM/YY format', () => {
    const specificDate = new Date(2025, 4, 22);
    const chatOnDate = { ...chat, createdAt: specificDate };
    assert.equal(advancedSearch(chatOnDate, 'date:22/05/25', 'all'), true);
    assert.equal(advancedSearch(chatOnDate, 'date:23/05/25', 'all'), false);
  });

  it('searches by title in title mode', () => {
    assert.equal(advancedSearch(chat, 'Test', 'title'), true);
    assert.equal(advancedSearch(chat, 'xyz', 'title'), false);
  });

  it('searches by visibility in visibility mode', () => {
    assert.equal(advancedSearch(chat, 'public', 'visibility'), true);
    assert.equal(advancedSearch(chat, 'private', 'visibility'), false);
  });

  it('searches all fields in all mode', () => {
    assert.equal(advancedSearch(chat, 'Test', 'all'), true);
    assert.equal(advancedSearch(chat, 'public', 'all'), true);
  });
});

describe('getSearchModeLabel', () => {
  it('returns correct labels for each mode', () => {
    assert.equal(getSearchModeLabel('all'), 'Alle');
    assert.equal(getSearchModeLabel('title'), 'Titel');
    assert.equal(getSearchModeLabel('date'), 'Datum');
    assert.equal(getSearchModeLabel('visibility'), 'Sichtbarkeit');
  });
});

describe('getNextSearchMode', () => {
  it('cycles through modes correctly', () => {
    assert.equal(getNextSearchMode('all'), 'title');
    assert.equal(getNextSearchMode('title'), 'date');
    assert.equal(getNextSearchMode('date'), 'visibility');
    assert.equal(getNextSearchMode('visibility'), 'all');
  });
});

describe('SEARCH_MODES', () => {
  it('contains all expected modes', () => {
    assert.deepEqual(SEARCH_MODES, ['all', 'title', 'date', 'visibility']);
  });
});
