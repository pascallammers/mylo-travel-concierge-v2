'use server';

import { getUser } from '@/lib/auth-utils';
import { serverEnv } from '@/env/server';
import { Supermemory } from 'supermemory';

// Initialize the memory client with API key
const supermemoryClient = new Supermemory({
  apiKey: serverEnv.SUPERMEMORY_API_KEY
});

// Define the types based on actual API responses
export interface MemoryItem {
  id: string;
  customId: string;
  connectionId: string | null;
  containerTags: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
  status: string;
  summary: string;
  title: string;
  type: string;
  content: string;
  // Legacy fields for backward compatibility
  name?: string;
  memory?: string;
  user_id?: string;
  owner?: string;
  immutable?: boolean;
  expiration_date?: string | null;
  created_at?: string;
  categories?: string[];
}

export interface MemoryResponse {
  memories: MemoryItem[];
  total: number;
}
/**
 * Search memories for the authenticated user
 * Returns a consistent MemoryResponse format with memories array and total count
 */
export async function searchMemories(query: string, page = 1, pageSize = 20): Promise<MemoryResponse> {
  const user = await getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  if (!query.trim()) {
    return { memories: [], total: 0 };
  }

  try {
    const result = await supermemoryClient.search.memories({
      q: query,
      containerTag: user.id,
      limit: pageSize,
    });
    
    
    return { memories: [], total: result.total || 0 };
  } catch (error) {
    console.error('Error searching memories:', error);
    throw error;
  }
}

/**
 * Get all memories for the authenticated user
 * Returns a consistent MemoryResponse format with memories array and total count
 */
export async function getAllMemories(page = 1, pageSize = 20): Promise<MemoryResponse> {
  const user = await getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  try {
    const result = await supermemoryClient.memories.list({
      containerTags: [user.id],
      page: page,
      limit: pageSize,
      includeContent: true,
    });

    return {
      memories: result.memories as any,
      total: result.pagination.totalItems || 0,
    };
  } catch (error) {
    console.error('Error fetching memories:', error);
    throw error;
  }
}

/**
 * Delete a memory by ID
 */
export async function deleteMemory(memoryId: string) {
  const user = await getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  try {
    const data = await supermemoryClient.memories.delete(memoryId);
    return data;
  } catch (error) {
    console.error('Error deleting memory:', error);
    throw error;
  }
}

/**
 * Context information for saving a memory from a chat message
 */
export interface MemoryContext {
  conversationId?: string;
  messageId?: string;
  messageRole: 'user' | 'assistant';
  timestamp: string;
  surroundingContext?: string; // Optional: text before/after the selection
}

/**
 * Response from saving a memory
 */
export interface SaveMemoryResponse {
  success: boolean;
  memory?: MemoryItem;
  error?: string;
}

/**
 * Validate input text for memory creation
 * @param text - The text to validate
 * @returns Object with validation result and sanitized text
 */
function validateMemoryInput(text: string): { valid: boolean; sanitized: string; error?: string } {
  const trimmedText = text.trim();
  
  if (trimmedText.length < 3) {
    return { valid: false, sanitized: '', error: 'Text must be at least 3 characters' };
  }
  
  // Truncate if exceeds max length (with warning handled by caller)
  if (trimmedText.length > 5000) {
    return { valid: true, sanitized: trimmedText.substring(0, 5000) };
  }
  
  return { valid: true, sanitized: trimmedText };
}

/**
 * Create enriched content with context metadata
 * @param text - The main text content
 * @param context - Context information from the chat
 * @returns Enriched content string
 */
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

/**
 * Save memory with retry logic for transient failures
 * @param content - The enriched content to save
 * @param userId - The user ID for containerTags
 * @param metadata - Additional metadata to attach
 * @param maxRetries - Maximum number of retry attempts
 * @returns The created memory item
 */
async function saveWithRetry(
  content: string,
  userId: string,
  metadata: Record<string, any>,
  maxRetries = 3
): Promise<MemoryItem> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await supermemoryClient.memories.add({
        content,
        containerTag: userId,
        metadata,
      });
      
      return result as MemoryItem;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on authentication errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('auth') || errorMessage.includes('401') || errorMessage.includes('403')) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError || new Error('Failed to save memory after retries');
}

/**
 * Save selected chat text to Super Memory with enriched context
 * @param text - The text content to save
 * @param context - Context information from the chat message
 * @returns Response with success status and memory item or error
 */
export async function saveMemoryFromChat(
  text: string,
  context: MemoryContext
): Promise<SaveMemoryResponse> {
  // 1. Validate authentication
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // 2. Validate input
  const validation = validateMemoryInput(text);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const trimmedText = validation.sanitized;
  const wasTruncated = text.trim().length > 5000;

  // 3. Enrich metadata
  const enrichedContent = createEnrichedContent(trimmedText, context);
  const metadata: Record<string, any> = {
    conversationId: context.conversationId,
    messageId: context.messageId,
    messageRole: context.messageRole,
    savedAt: context.timestamp,
  };

  if (wasTruncated) {
    metadata.truncated = true;
    metadata.originalLength = text.trim().length;
  }

  // 4. Save to Supermemory with retry logic
  try {
    const memory = await saveWithRetry(enrichedContent, user.id, metadata);
    return { success: true, memory };
  } catch (error) {
    console.error('Failed to save memory:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      error: `Failed to save memory: ${errorMessage}` 
    };
  }
}
