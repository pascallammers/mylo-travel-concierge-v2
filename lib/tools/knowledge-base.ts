import { tool } from 'ai';
import { z } from 'zod';
import { queryKnowledgeBase, KB_SIGNALS } from './knowledge-base-query';
import { detectIntent } from '@/lib/utils/intent-detector';
import { KB_CONFIG } from '@/lib/config/knowledge-base';

/**
 * Knowledge Base search tool for the AI chat system.
 *
 * This tool searches internal documents, policies, and FAQs to answer
 * informational travel queries. It automatically detects transactional
 * queries (flight bookings, price queries) and skips the search.
 *
 * @example
 * // Good queries for KB:
 * // - "What's the best time to visit Bali?"
 * // - "What is the baggage policy?"
 * // - "Travel tips for Thailand"
 *
 * // Queries that skip KB (transactional):
 * // - "Book a flight to Bangkok on 15.12"
 * // - "How much does a flight to London cost?"
 * // - "Search flights from Berlin to Paris"
 */
export const knowledgeBaseTool = tool({
  description: `Search the internal Knowledge Base for travel-related information.

USE THIS TOOL FOR:
- General travel tips and advice
- Destination information and recommendations
- Travel policies and guidelines
- FAQs about travel services
- Best time to visit queries
- Packing tips, visa info, cultural advice

DO NOT USE THIS TOOL FOR:
- Flight searches with specific dates/destinations
- Booking requests or reservations
- Price queries for specific routes
- Any transactional queries with dates
- Explicit flight search requests

This tool searches internal documents first. If no relevant information
is found or confidence is low, the system will automatically fall back
to web search. The answer is integrated seamlessly without explicit
source citations.`,

  inputSchema: z.object({
    query: z.string().min(1).describe('The travel-related question to search for'),
  }),

  execute: async ({ query }: { query: string }) => {
    try {
      // Detect query intent to skip KB for transactional queries
      const intentResult = detectIntent(query);

      if (intentResult.intent === 'transactional' && intentResult.confidence >= 0.6) {
        console.log('[KB Tool] Skipping KB search for transactional query:', {
          query: query.substring(0, 50),
          signals: intentResult.signals,
        });
        // Return NOT_FOUND signal to let chat system use other tools
        return KB_SIGNALS.NOT_FOUND;
      }

      // Query the File Search Store
      const kbResult = await queryKnowledgeBase(query, {
        confidenceThreshold: KB_CONFIG.confidenceThreshold,
        timeoutMs: KB_CONFIG.queryTimeoutMs,
      });

      // Handle empty KB / not found
      if (kbResult.status === 'empty' || kbResult.status === 'not_found') {
        console.log('[KB Tool] Information not found in KB:', kbResult.reason);
        return KB_SIGNALS.NOT_FOUND;
      }

      // Handle low confidence - signal for fallback
      if (kbResult.status === 'low_confidence') {
        console.log('[KB Tool] Low confidence result:', {
          confidence: kbResult.confidence,
          threshold: KB_CONFIG.confidenceThreshold,
        });
        return KB_SIGNALS.LOW_CONFIDENCE;
      }

      // Handle error
      if (kbResult.status === 'error') {
        console.error('[KB Tool] Query error');
        return KB_SIGNALS.ERROR;
      }

      // Return answer directly without prefix for seamless integration
      if (kbResult.status === 'found' && kbResult.answer) {
        console.log('[KB Tool] Found answer with confidence:', kbResult.confidence);
        return kbResult.answer;
      }

      return KB_SIGNALS.ERROR;
    } catch (error) {
      console.error('[KB Tool] Search error:', error);
      return KB_SIGNALS.ERROR;
    }
  },
});
