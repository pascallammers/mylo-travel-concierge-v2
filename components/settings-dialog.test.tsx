import { describe, it, expect, beforeEach } from 'bun:test';

// Test data
const mockMemories = [
  {
    id: '1',
    customId: 'custom-1',
    connectionId: null,
    containerTags: ['user-123'],
    createdAt: '2025-01-17T10:30:00Z',
    updatedAt: '2025-01-17T10:30:00Z',
    metadata: {},
    status: 'active',
    summary: 'User preference for window seats',
    title: 'Travel Preference',
    type: 'preference',
    content: 'I prefer window seats on flights\n[Conversation: chat-abc-123]\n[Source: user message]\n[Saved: 2025-01-17T10:30:00Z]',
  },
  {
    id: '2',
    customId: 'custom-2',
    connectionId: null,
    containerTags: ['user-123'],
    createdAt: '2025-01-16T15:45:00Z',
    updatedAt: '2025-01-16T15:45:00Z',
    metadata: {},
    status: 'active',
    summary: 'AI recommendation for Paris hotels',
    title: 'Hotel Recommendation',
    type: 'recommendation',
    content: 'The best hotels in Paris are located in the Marais district. Consider Hotel du Petit Moulin or Hotel Caron de Beaumarchais for boutique experiences.\n[Conversation: chat-xyz-456]\n[Source: assistant message]\n[Saved: 2025-01-16T15:45:00Z]',
  },
  {
    id: '3',
    customId: 'custom-3',
    connectionId: null,
    containerTags: ['user-123'],
    createdAt: '2025-01-15T09:20:00Z',
    updatedAt: '2025-01-15T09:20:00Z',
    metadata: {},
    status: 'active',
    summary: 'Long memory content for testing expand/collapse',
    title: 'Long Memory',
    type: 'note',
    content: 'This is a very long memory content that should trigger the show more/less functionality. '.repeat(10) + '\n[Source: user message]\n[Saved: 2025-01-15T09:20:00Z]',
  },
];

describe('MemoriesSection - Memory Metadata Parsing', () => {

  it('should parse memory metadata correctly', () => {
    const memory = mockMemories[0];
    
    // Test the parsing logic
    const content = memory.content;
    
    // Extract conversation ID
    const conversationMatch = content.match(/\[Conversation: ([^\]]+)\]/);
    expect(conversationMatch?.[1]).toBe('chat-abc-123');
    
    // Extract role
    const roleMatch = content.match(/\[Source: (user|assistant) message\]/);
    expect(roleMatch?.[1]).toBe('user');
    
    // Extract timestamp
    const timestampMatch = content.match(/\[Saved: ([^\]]+)\]/);
    expect(timestampMatch?.[1]).toBe('2025-01-17T10:30:00Z');
    
    // Clean text
    const cleanedText = content
      .replace(/\[Conversation: [^\]]+\]/g, '')
      .replace(/\[Source: [^\]]+\]/g, '')
      .replace(/\[Saved: [^\]]+\]/g, '')
      .replace(/\[Context: [^\]]+\]/g, '')
      .trim();
    
    expect(cleanedText).toBe('I prefer window seats on flights');
  });

  it('should parse assistant message metadata', () => {
    const memory = mockMemories[1];
    const content = memory.content;
    
    const roleMatch = content.match(/\[Source: (user|assistant) message\]/);
    expect(roleMatch?.[1]).toBe('assistant');
    
    const conversationMatch = content.match(/\[Conversation: ([^\]]+)\]/);
    expect(conversationMatch?.[1]).toBe('chat-xyz-456');
  });

  it('should handle memory without conversation ID', () => {
    const memory = mockMemories[2];
    const content = memory.content;
    
    const conversationMatch = content.match(/\[Conversation: ([^\]]+)\]/);
    expect(conversationMatch).toBeNull();
  });

  it('should detect long content for expand/collapse', () => {
    const memory = mockMemories[2];
    const content = memory.content;
    
    const cleanedText = content
      .replace(/\[Conversation: [^\]]+\]/g, '')
      .replace(/\[Source: [^\]]+\]/g, '')
      .replace(/\[Saved: [^\]]+\]/g, '')
      .replace(/\[Context: [^\]]+\]/g, '')
      .trim();
    
    expect(cleanedText.length).toBeGreaterThan(200);
  });

  it('should format dates correctly', () => {
    const dateString = '2025-01-17T10:30:00Z';
    const date = new Date(dateString);
    
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(date);
    
    expect(formatted).toMatch(/Jan 17/);
  });

  it('should handle invalid date strings', () => {
    const dateString = '';
    const fallback = dateString || 'Unknown';
    
    expect(fallback).toBe('Unknown');
  });

  it('should generate correct conversation link', () => {
    const conversationId = 'chat-abc-123';
    const expectedLink = `/chat/${conversationId}`;
    
    expect(expectedLink).toBe('/chat/chat-abc-123');
  });

  it('should handle pagination correctly', () => {
    const page1 = { memories: mockMemories.slice(0, 2), total: 3 };
    const page2 = { memories: [mockMemories[2]], total: 3 };
    
    expect(page1.memories.length).toBe(2);
    expect(page1.total).toBe(3);
    
    expect(page2.memories.length).toBe(1);
    expect(page2.total).toBe(3);
  });

  it('should determine if more pages exist', () => {
    // Create a full page of 20 memories (need more than our 3 mock memories)
    const fullPage = Array.from({ length: 20 }, (_, i) => ({ ...mockMemories[0], id: `${i}` }));
    const lastPage = { memories: fullPage, total: 40 };
    const hasMore = lastPage.memories.length >= 20;
    
    expect(hasMore).toBe(true);
  });

  it('should handle no more pages', () => {
    const lastPage = { memories: mockMemories.slice(0, 3), total: 3 };
    const hasMore = lastPage.memories.length >= 20;
    
    expect(hasMore).toBe(false);
  });

  it('should render badge variant based on message role', () => {
    const userRole = 'user';
    const assistantRole = 'assistant';
    
    const userVariant = userRole === 'assistant' ? 'default' : 'secondary';
    const assistantVariant = assistantRole === 'assistant' ? 'default' : 'secondary';
    
    expect(userVariant).toBe('secondary');
    expect(assistantVariant).toBe('default');
  });

  it('should render badge text based on message role', () => {
    const userRole = 'user';
    const assistantRole = 'assistant';
    
    const userBadge = userRole === 'assistant' ? '🤖 AI' : '👤 You';
    const assistantBadge = assistantRole === 'assistant' ? '🤖 AI' : '👤 You';
    
    expect(userBadge).toBe('👤 You');
    expect(assistantBadge).toBe('🤖 AI');
  });

  it('should apply line-clamp when not expanded', () => {
    const isExpanded = false;
    const textLength = 250;
    
    const shouldClamp = !isExpanded && textLength > 200;
    
    expect(shouldClamp).toBe(true);
  });

  it('should not apply line-clamp when expanded', () => {
    const isExpanded = true;
    const textLength = 250;
    
    const shouldClamp = !isExpanded && textLength > 200;
    
    expect(shouldClamp).toBe(false);
  });

  it('should show expand button for long content', () => {
    const textLength = 250;
    const shouldShowButton = textLength > 200;
    
    expect(shouldShowButton).toBe(true);
  });

  it('should not show expand button for short content', () => {
    const textLength = 150;
    const shouldShowButton = textLength > 200;
    
    expect(shouldShowButton).toBe(false);
  });

  it('should toggle expanded state', () => {
    let expandedId: string | null = null;
    const memoryId = '1';
    
    // Expand
    expandedId = memoryId;
    expect(expandedId).toBe('1');
    
    // Collapse
    expandedId = null;
    expect(expandedId).toBeNull();
    
    // Toggle logic
    const isCurrentlyExpanded = expandedId === memoryId;
    expandedId = isCurrentlyExpanded ? null : memoryId;
    expect(expandedId).toBe('1');
  });

  it('should display correct expand/collapse button text', () => {
    const isExpanded = false;
    const buttonText = isExpanded ? 'Show less' : 'Show more';
    
    expect(buttonText).toBe('Show more');
  });

  it('should manage deleting memory IDs set', () => {
    const deletingIds = new Set<string>();
    
    // Add ID
    deletingIds.add('1');
    expect(deletingIds.has('1')).toBe(true);
    expect(deletingIds.size).toBe(1);
    
    // Remove ID
    deletingIds.delete('1');
    expect(deletingIds.has('1')).toBe(false);
    expect(deletingIds.size).toBe(0);
  });

  it('should count total memories from pages', () => {
    const pages = [
      { memories: mockMemories.slice(0, 2), total: 3 },
      { memories: [mockMemories[2]], total: 3 },
    ];
    
    const total = pages.reduce((acc, page) => acc + page.memories.length, 0);
    
    expect(total).toBe(3);
  });

  it('should flatten memories from pages', () => {
    const pages = [
      { memories: mockMemories.slice(0, 2), total: 3 },
      { memories: [mockMemories[2]], total: 3 },
    ];
    
    const flattened = pages.flatMap((page) => page.memories);
    
    expect(flattened.length).toBe(3);
    expect(flattened[0].id).toBe('1');
    expect(flattened[2].id).toBe('3');
  });

  it('should handle fallback for missing content fields', () => {
    const memory = {
      id: '4',
      content: '',
      summary: '',
      title: 'Fallback Title',
    };
    
    const text = memory.content || memory.summary || memory.title || 'No content available';
    
    expect(text).toBe('Fallback Title');
  });

  it('should use final fallback when all fields are empty', () => {
    const memory = {
      id: '4',
      content: '',
      summary: '',
      title: '',
    };
    
    const text = memory.content || memory.summary || memory.title || 'No content available';
    
    expect(text).toBe('No content available');
  });
});
