/**
 * Intent Detector - Classifies user queries as informational or transactional
 *
 * Used by the Knowledge Base RAG system to determine whether to search
 * the knowledge base (informational queries) or skip it (transactional queries
 * like flight bookings, price queries).
 *
 * Supports both German and English queries.
 */

/**
 * Query intent classification
 * - transactional: Skip KB search (flight bookings, price queries)
 * - informational: Use KB search (travel tips, destination info)
 * - ambiguous: Intent is unclear, default to informational behavior
 */
export type QueryIntent = 'transactional' | 'informational' | 'ambiguous';

/**
 * Result of intent detection analysis
 */
export interface IntentResult {
  /** Classified intent type */
  intent: QueryIntent;
  /** Confidence score (0-1) based on pattern matches */
  confidence: number;
  /** Debug signals showing which patterns matched */
  signals: string[];
}

/**
 * Pattern definition for intent matching
 */
interface IntentPattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Human-readable description for debugging */
  description: string;
}

/**
 * Patterns indicating TRANSACTIONAL intent (skip KB search)
 *
 * These patterns suggest the user wants to perform an action:
 * - Book a flight
 * - Search for specific flights
 * - Get prices for specific routes
 */
const TRANSACTIONAL_PATTERNS: IntentPattern[] = [
  {
    pattern: /\b(fl[uü]ge?|flight|fliegen|fly)\b.*\b\d{1,2}[./]\d{1,2}/i,
    description: 'flight_with_date',
  },
  {
    pattern: /\b(buch(?:en|e)?|book(?:ing)?|reserv(?:e|ier(?:e|en)?|ation)?|bestell(?:en|e)?)\b/i,
    description: 'booking_request',
  },
  {
    pattern: /\b(preis|price|cost|kosten|kostet)\b.*\b(von|from|nach|to)\b/i,
    description: 'price_with_route',
  },
  {
    pattern: /\b(von|from)\b.*\b(nach|to)\b.*\b(preis|price|cost|kosten|kostet)\b/i,
    description: 'price_with_route',
  },
  {
    pattern: /\b(such(?:e|en)?|find|zeig(?:e|en)?|show)\b.*\b(fl[uü]ge?|flight)\b.*\b(von|from|nach|to)\b/i,
    description: 'flight_search_request',
  },
  {
    pattern: /\b(zeig|show)\b.*\b(fl[uü]ge?|flights?)\b.*\b(von|from)\b/i,
    description: 'flight_search_request',
  },
  {
    pattern: /\b(am|on|für|for)\b\s+\d{1,2}[./]\d{1,2}/i,
    description: 'date_pattern',
  },
];

/**
 * Patterns indicating INFORMATIONAL intent (use KB search)
 *
 * These patterns suggest the user wants information:
 * - Travel tips and advice
 * - Destination information
 * - General travel questions
 */
const INFORMATIONAL_PATTERNS: IntentPattern[] = [
  {
    pattern: /\b(tipps?|tips?|rat|advice|empfehl(?:ung|en)?|recommend(?:ation)?)\b/i,
    description: 'tips_advice',
  },
  {
    pattern: /\b(beste zeit|best time|wann.*reisen|when.*travel)\b/i,
    description: 'best_time_question',
  },
  {
    pattern: /\b(was.*wissen|what.*know|inform|über|about)\b/i,
    description: 'destination_info',
  },
  {
    pattern: /\b(wie|how|was muss|what should)\b/i,
    description: 'how_to_question',
  },
];

/**
 * Count pattern matches and collect signals
 *
 * @param query - The user query to analyze
 * @param patterns - Array of patterns to check
 * @param category - Category name for signal prefix
 * @returns Object with match count and signals array
 */
function countPatternMatches(
  query: string,
  patterns: IntentPattern[],
  category: 'transactional' | 'informational'
): { count: number; signals: string[] } {
  const signals: string[] = [];
  let count = 0;

  for (const { pattern, description } of patterns) {
    if (pattern.test(query)) {
      count += 1;
      signals.push(`${category}:${description}`);
    }
  }

  return { count, signals };
}

/**
 * Calculate confidence score based on pattern matches
 *
 * @param winningScore - Score of the winning category
 * @param totalScore - Sum of all category scores
 * @returns Confidence value between 0 and 1
 */
function calculateConfidence(winningScore: number, totalScore: number): number {
  if (totalScore === 0) {
    return 0;
  }
  return winningScore / totalScore;
}

/**
 * Detect the intent of a user query
 *
 * Analyzes the query against transactional and informational patterns
 * to determine whether the Knowledge Base should be searched.
 *
 * @param query - The user query to classify
 * @returns IntentResult with intent type, confidence, and debug signals
 *
 * @example
 * ```typescript
 * // Transactional query - skip KB
 * detectIntent('Buche mir einen Flug nach Bangkok am 15.12');
 * // { intent: 'transactional', confidence: 1, signals: ['transactional:booking_request', 'transactional:date_pattern'] }
 *
 * // Informational query - use KB
 * detectIntent('What is the best time to visit Bali?');
 * // { intent: 'informational', confidence: 1, signals: ['informational:best_time_question'] }
 * ```
 */
export function detectIntent(query: string): IntentResult {
  // Count matches for each category
  const transactional = countPatternMatches(query, TRANSACTIONAL_PATTERNS, 'transactional');
  const informational = countPatternMatches(query, INFORMATIONAL_PATTERNS, 'informational');

  // Combine all signals for debugging
  const signals = [...transactional.signals, ...informational.signals];
  const totalScore = transactional.count + informational.count;

  // Decision logic:
  // 1. If transactional score > informational AND >= 2 matches: TRANSACTIONAL
  // 2. If informational score > transactional OR no matches: INFORMATIONAL
  // 3. Otherwise: AMBIGUOUS

  if (transactional.count > informational.count && transactional.count >= 2) {
    return {
      intent: 'transactional',
      confidence: calculateConfidence(transactional.count, totalScore),
      signals,
    };
  }

  if (informational.count > transactional.count || totalScore === 0) {
    return {
      intent: 'informational',
      confidence: totalScore === 0 ? 0 : calculateConfidence(informational.count, totalScore),
      signals,
    };
  }

  return {
    intent: 'ambiguous',
    confidence: 0.5,
    signals,
  };
}
