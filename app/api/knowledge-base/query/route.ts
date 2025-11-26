import { z } from 'zod';
import { queryKnowledgeBase, type KnowledgeBaseQueryResult } from '@/lib/tools/knowledge-base-query';
import { KB_CONFIG } from '@/lib/config/knowledge-base';
import { KBError, KBErrorCode, isKBError } from '@/lib/errors';

/**
 * Query status indicating the result of the knowledge base search.
 */
type QueryStatus = 'found' | 'not_found' | 'low_confidence' | 'error';

/**
 * Response structure for the query API.
 */
interface QueryResponse {
  status: QueryStatus;
  answer?: string;
  confidence?: number;
  source?: 'internal';
}

/**
 * Schema for validating the query request body.
 */
const queryRequestSchema = z.object({
  query: z.string().min(1).max(1000).describe('The question to search for in the knowledge base'),
  confidenceThreshold: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Override the default confidence threshold (0-100)'),
});

/**
 * Converts the internal query result to API response format.
 *
 * @param result - The internal query result
 * @param confidenceThreshold - The confidence threshold used
 * @returns Formatted query response
 */
function formatQueryResponse(
  result: KnowledgeBaseQueryResult,
  confidenceThreshold: number
): QueryResponse {
  switch (result.status) {
    case 'found':
      // Simulate confidence based on answer quality
      // In a real implementation, this would come from embedding similarity scores
      const confidence = 0.85; // High confidence for found results

      if (confidence >= confidenceThreshold) {
        return {
          status: 'found',
          answer: result.answer,
          confidence: Math.round(confidence * 100),
          source: 'internal',
        };
      } else {
        return {
          status: 'low_confidence',
          answer: result.answer,
          confidence: Math.round(confidence * 100),
        };
      }

    case 'not_found':
      return {
        status: 'not_found',
        confidence: 0,
      };

    case 'empty':
      return {
        status: 'not_found',
        confidence: 0,
      };

    case 'error':
    default:
      return {
        status: 'error',
      };
  }
}

/**
 * POST /api/knowledge-base/query
 *
 * Queries the Knowledge Base for travel-related information.
 *
 * Request Body:
 * - query: string - The question to search for
 * - confidenceThreshold: number (optional) - Override default confidence threshold (0-100)
 *
 * Response:
 * - status: 'found' | 'not_found' | 'low_confidence' | 'error'
 * - answer: string (when found)
 * - confidence: number (0-100)
 * - source: 'internal' (when found from KB)
 *
 * @param request - The incoming request
 * @returns JSON response with query results
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = queryRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return Response.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request body',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { query, confidenceThreshold: requestThreshold } = parseResult.data;

    // Calculate effective confidence threshold
    const confidenceThreshold = requestThreshold
      ? requestThreshold / 100
      : KB_CONFIG.confidenceThreshold;

    // Query the knowledge base (timeout is handled internally by queryKnowledgeBase)
    const result = await queryKnowledgeBase(query, {
      confidenceThreshold,
      timeoutMs: KB_CONFIG.queryTimeoutMs,
    });

    // Format and return response
    const response = formatQueryResponse(result, confidenceThreshold);

    return Response.json(response);
  } catch (error) {
    console.error('[KB Query] Error processing query:', error);

    if (error instanceof SyntaxError) {
      return Response.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
          },
        },
        { status: 400 }
      );
    }

    if (isKBError(error)) {
      return error.toResponse();
    }

    return new KBError(
      KBErrorCode.QUERY_FAILED,
      'Failed to process knowledge base query',
      error
    ).toResponse();
  }
}
