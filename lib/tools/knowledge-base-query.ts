import { geminiFileSearchStore, type QueryResult } from '@/lib/gemini-file-search-store';
import { KB_CONFIG } from '@/lib/config/knowledge-base';
import { KBError, KBErrorCode } from '@/lib/errors/kb-errors';

/**
 * Query service interface for dependency injection in tests.
 */
export interface KBQueryService {
  query: (query: string) => Promise<QueryResult>;
}

/**
 * Knowledge Base query result status types.
 * - found: Answer found with sufficient confidence
 * - low_confidence: Answer found but below confidence threshold
 * - not_found: No relevant information found in KB
 * - empty: No active documents in KB
 * - error: Query operation failed
 */
export type KnowledgeBaseQueryStatus =
  | 'found'
  | 'low_confidence'
  | 'not_found'
  | 'empty'
  | 'error';

/**
 * Reason codes explaining why KB query returned non-found status.
 */
export type KnowledgeBaseQueryReason =
  | 'no_files'
  | 'no_active_files'
  | 'not_found'
  | 'low_confidence'
  | 'error';

/**
 * Signal constants for KB fallback handling in chat system.
 * These signals tell the chat system how to proceed.
 */
export const KB_SIGNALS = {
  /** KB search found no relevant answer */
  NOT_FOUND: '__KB_NOT_FOUND__',
  /** KB answer confidence is below threshold */
  LOW_CONFIDENCE: '__KB_LOW_CONFIDENCE__',
  /** KB query encountered an error */
  ERROR: '__KB_ERROR__',
} as const;

/**
 * Result of a Knowledge Base query operation.
 */
export interface KnowledgeBaseQueryResult {
  /** Status indicating query outcome */
  status: KnowledgeBaseQueryStatus;
  /** Answer text when found */
  answer?: string;
  /** Reason for non-found status */
  reason?: KnowledgeBaseQueryReason;
  /** Confidence score (0-1) when answer is found */
  confidence?: number;
  /** Number of documents searched */
  documentsSearched?: number;
  /** Signal for chat system fallback handling */
  signal?: string;
}

/**
 * Options for configuring Knowledge Base queries.
 */
export interface KnowledgeBaseQueryOptions {
  /**
   * Confidence threshold (0-1) for accepting answers.
   * Answers below this threshold return 'low_confidence' status.
   * @default KB_CONFIG.confidenceThreshold (0.70)
   */
  confidenceThreshold?: number;
  /**
   * Timeout in milliseconds for the query operation.
   * @default KB_CONFIG.queryTimeoutMs (10000)
   */
  timeoutMs?: number;
  /**
   * Optional query service for dependency injection in tests.
   * @internal
   */
  _testService?: KBQueryService;
}

/**
 * Runs a Gemini File Search Store backed knowledge-base query.
 * Uses the managed RAG system with automatic document indexing and retrieval.
 *
 * @param query - User question to answer from KB documents
 * @param options - Query configuration options
 * @returns Knowledge base lookup result with confidence metrics
 *
 * @example
 * ```typescript
 * const result = await queryKnowledgeBase('What is the baggage policy?', {
 *   confidenceThreshold: 0.70,
 * });
 *
 * if (result.status === 'found') {
 *   return result.answer;
 * } else if (result.signal === KB_SIGNALS.LOW_CONFIDENCE) {
 *   // Fallback to web search
 * }
 * ```
 */
export async function queryKnowledgeBase(
  query: string,
  options: KnowledgeBaseQueryOptions = {},
): Promise<KnowledgeBaseQueryResult> {
  const confidenceThreshold = options.confidenceThreshold ?? KB_CONFIG.confidenceThreshold;
  const timeoutMs = options.timeoutMs ?? KB_CONFIG.queryTimeoutMs;
  const service = options._testService ?? geminiFileSearchStore;

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new KBError(KBErrorCode.QUERY_TIMEOUT, `KB query timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Execute query with timeout using File Search Store
    const queryPromise = executeKBQuery(query, confidenceThreshold, service);
    
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error) {
    console.error('[KB Query] Failed:', error);
    
    return {
      status: 'error',
      reason: 'error',
      signal: KB_SIGNALS.ERROR,
    };
  }
}

/**
 * Internal function to execute the KB query logic using File Search Store.
 */
async function executeKBQuery(
  query: string,
  confidenceThreshold: number,
  service: KBQueryService,
): Promise<KnowledgeBaseQueryResult> {
  // Query the File Search Store
  const result = await service.query(query);
  const documentsSearched = result.sources.length;

  // Handle error status
  if (result.status === 'error') {
    return {
      status: 'error',
      reason: 'error',
      signal: KB_SIGNALS.ERROR,
    };
  }

  // Handle not found (no sources returned)
  if (result.status === 'not_found' || documentsSearched === 0) {
    return {
      status: 'not_found',
      reason: 'not_found',
      documentsSearched,
      signal: KB_SIGNALS.NOT_FOUND,
    };
  }

  // Check if confidence meets threshold
  if (result.confidence < confidenceThreshold) {
    return {
      status: 'low_confidence',
      reason: 'low_confidence',
      answer: result.answer,
      confidence: result.confidence,
      documentsSearched,
      signal: KB_SIGNALS.LOW_CONFIDENCE,
    };
  }

  // Return successful result
  return {
    status: 'found',
    answer: result.answer,
    confidence: result.confidence,
    documentsSearched,
  };
}
