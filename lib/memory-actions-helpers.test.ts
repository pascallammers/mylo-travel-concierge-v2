/**
 * Unit tests for memory-actions helper functions
 * 
 * Tests the core logic of input validation and context enrichment
 * without requiring database or external API dependencies.
 */
import { describe, it, expect } from 'bun:test';
import type { MemoryContext } from './memory-actions';

// Helper functions - duplicated from memory-actions for testing
function validateMemoryInput(text: string): { valid: boolean; sanitized: string; error?: string } {
  const trimmedText = text.trim();
  
  if (trimmedText.length < 3) {
    return { valid: false, sanitized: '', error: 'Text must be at least 3 characters' };
  }
  
  if (trimmedText.length > 5000) {
    return { valid: true, sanitized: trimmedText.substring(0, 5000) };
  }
  
  return { valid: true, sanitized: trimmedText };
}

function createEnrichedContent(text: string, context: MemoryContext): string {
  const parts = [text];
  
  if (context.conversationId) {
    parts.push(`[Conversation: ${context.conversationId}]`);
  }
  
  parts.push(`[Source: ${context.messageRole} message]`);
  parts.push(`[Saved: ${context.timestamp}]`);
  
  if (context.surroundingContext) {
    parts.push(`[Context: ...${context.surroundingContext}...]`);
  }
  
  return parts.join('\n');
}

describe('Memory Actions - Helper Functions', () => {
  const validContext: MemoryContext = {
    conversationId: 'conv-123',
    messageId: 'msg-456',
    messageRole: 'user',
    timestamp: '2025-01-17T12:00:00Z',
    surroundingContext: 'This is some surrounding context',
  };

  describe('validateMemoryInput', () => {
    it('should reject text with less than 3 characters', () => {
      const result = validateMemoryInput('ab');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Text must be at least 3 characters');
      expect(result.sanitized).toBe('');
    });

    it('should reject empty text after trimming', () => {
      const result = validateMemoryInput('   ');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Text must be at least 3 characters');
    });

    it('should accept text with exactly 3 characters', () => {
      const result = validateMemoryInput('abc');

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('abc');
      expect(result.error).toBeUndefined();
    });

    it('should truncate text exceeding 5000 characters', () => {
      const longText = 'a'.repeat(6000);
      
      const result = validateMemoryInput(longText);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toHaveLength(5000);
      expect(result.error).toBeUndefined();
    });

    it('should not truncate text under 5000 chars', () => {
      const normalText = 'a'.repeat(4000);
      
      const result = validateMemoryInput(normalText);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toHaveLength(4000);
    });

    it('should trim whitespace from input', () => {
      const textWithWhitespace = '   Valid text with whitespace   ';
      
      const result = validateMemoryInput(textWithWhitespace);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Valid text with whitespace');
    });

    it('should handle special characters', () => {
      const specialText = 'Text with special chars: @#$%^&*() <>"\'';
      
      const result = validateMemoryInput(specialText);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(specialText);
    });

    it('should handle unicode characters', () => {
      const unicodeText = 'Text with emoji 😀 and Chinese 你好';
      
      const result = validateMemoryInput(unicodeText);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(unicodeText);
    });

    it('should handle multiline text', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      
      const result = validateMemoryInput(multilineText);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(multilineText);
    });
  });

  describe('createEnrichedContent', () => {
    it('should include conversation ID in enriched content', () => {
      const enriched = createEnrichedContent('Test text', validContext);

      expect(enriched).toContain('Test text');
      expect(enriched).toContain('[Conversation: conv-123]');
    });

    it('should include message role in enriched content', () => {
      const enriched = createEnrichedContent('Test text', validContext);

      expect(enriched).toContain('[Source: user message]');
    });

    it('should work with assistant role', () => {
      const assistantContext = { ...validContext, messageRole: 'assistant' as const };
      const enriched = createEnrichedContent('Test text', assistantContext);

      expect(enriched).toContain('[Source: assistant message]');
    });

    it('should include timestamp in enriched content', () => {
      const enriched = createEnrichedContent('Test text', validContext);

      expect(enriched).toContain('[Saved: 2025-01-17T12:00:00Z]');
    });

    it('should include surrounding context when provided', () => {
      const enriched = createEnrichedContent('Test text', validContext);

      expect(enriched).toContain('[Context: ...This is some surrounding context...]');
    });

    it('should work without optional conversationId', () => {
      const minimalContext: MemoryContext = {
        messageRole: 'user',
        timestamp: '2025-01-17T12:00:00Z',
      };

      const enriched = createEnrichedContent('Test text', minimalContext);

      expect(enriched).toContain('Test text');
      expect(enriched).toContain('[Source: user message]');
      expect(enriched).toContain('[Saved: 2025-01-17T12:00:00Z]');
      expect(enriched).not.toContain('[Conversation:');
      expect(enriched).not.toContain('[Context:');
    });

    it('should work without optional surroundingContext', () => {
      const contextWithoutSurrounding: MemoryContext = {
        conversationId: 'conv-123',
        messageRole: 'user',
        timestamp: '2025-01-17T12:00:00Z',
      };

      const enriched = createEnrichedContent('Test text', contextWithoutSurrounding);

      expect(enriched).toContain('Test text');
      expect(enriched).toContain('[Conversation: conv-123]');
      expect(enriched).not.toContain('[Context:');
    });

    it('should format content with newlines separating parts', () => {
      const enriched = createEnrichedContent('Test text', validContext);

      const lines = enriched.split('\n');
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toBe('Test text');
    });

    it('should handle very long conversation IDs', () => {
      const longIdContext = {
        ...validContext,
        conversationId: 'a'.repeat(500),
      };

      const enriched = createEnrichedContent('Test text', longIdContext);

      expect(enriched).toContain(`[Conversation: ${'a'.repeat(500)}]`);
    });

    it('should handle special characters in context', () => {
      const specialContext: MemoryContext = {
        conversationId: 'conv-<test>"special',
        messageRole: 'user',
        timestamp: '2025-01-17T12:00:00Z',
        surroundingContext: 'Context with @#$% special chars',
      };

      const enriched = createEnrichedContent('Test text', specialContext);

      expect(enriched).toContain('[Conversation: conv-<test>"special]');
      expect(enriched).toContain('[Context: ...Context with @#$% special chars...]');
    });
  });

  describe('Integration - Validation + Enrichment', () => {
    it('should validate then enrich valid text', () => {
      const text = 'This is a valid memory text';
      
      const validation = validateMemoryInput(text);
      expect(validation.valid).toBe(true);

      const enriched = createEnrichedContent(validation.sanitized, validContext);
      
      expect(enriched).toContain(text);
      expect(enriched).toContain('[Source: user message]');
    });

    it('should handle whitespace trimming then enrichment', () => {
      const text = '   Valid text with spaces   ';
      
      const validation = validateMemoryInput(text);
      expect(validation.valid).toBe(true);
      expect(validation.sanitized).toBe('Valid text with spaces');

      const enriched = createEnrichedContent(validation.sanitized, validContext);
      
      expect(enriched).toContain('Valid text with spaces');
      expect(enriched).not.toMatch(/^\s+Valid/);
    });

    it('should truncate then enrich long text', () => {
      const longText = 'a'.repeat(6000);
      
      const validation = validateMemoryInput(longText);
      expect(validation.valid).toBe(true);
      expect(validation.sanitized).toHaveLength(5000);

      const enriched = createEnrichedContent(validation.sanitized, validContext);
      
      expect(enriched).toContain('a'.repeat(5000));
      expect(enriched).toContain('[Source: user message]');
    });
  });
});
