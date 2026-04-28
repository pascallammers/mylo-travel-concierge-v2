/**
 * Flight Intent Detector
 *
 * Pure function — no I/O. Used as a code-level safety net by `app/api/search/route.ts`
 * to deterministically force-enable flight tools (and require a tool call) when the
 * user's last message clearly signals a flight-search intent.
 *
 * Design principles:
 *   - Conservative by default: a false-positive (forcing flight tools on a non-flight
 *     query) is worse than a false-negative (letting prompt-routing handle ambiguous
 *     cases). Prefer requiring multiple weak signals over single ambiguous ones.
 *   - Bilingual (German + English) — MYLO's primary user base.
 *   - Reject factual / knowledge-only airline questions (e.g. "Was ist Star Alliance?",
 *     "Difference between Business and First Class?").
 *   - Reject figurative uses of "fly" ("time flies", "fly off the handle").
 */

/** Tools the LLM should be restricted to when flight intent is detected. */
export const FLIGHT_TOOL_NAMES = [
  'search_flights',
  'skiplagged_flight_search',
  'kiwi_flight_search',
] as const;

export type FlightToolName = (typeof FLIGHT_TOOL_NAMES)[number];

// --- Lexicon ----------------------------------------------------------------

// Strong: presence of a token here is a strong flight signal (still gated against
// the factual/knowledge guard below, so "Was ist Business Class?" is not triggered).
const STRONG_FLIGHT_TOKENS = [
  // English
  'flight',
  'flights',
  'airfare',
  'airfares',
  'plane ticket',
  'plane tickets',
  // German
  'flug',
  'flüge',
  'fluege',
  'flugticket',
  'flugtickets',
  'flugpreis',
  'flugpreise',
];

// Weak: needs corroboration (route pattern, airport code, miles/points, etc.)
const WEAK_FLIGHT_TOKENS = [
  'fly',
  'flying',
  'flown',
  'fliegen',
  'fliege',
  'fliegt',
  'geflogen',
];

// Words that indicate a factual/knowledge question rather than a search intent.
// When combined with airline / class terms but WITHOUT a strong flight token or
// route, these dampen detection.
const FACTUAL_QUESTION_MARKERS = [
  'what is',
  'what are',
  "what's",
  'difference between',
  'unterschied zwischen',
  'was ist',
  'was sind',
  'erkläre',
  'erklaere',
  'explain',
  'how does',
  'wie funktioniert',
  'star alliance',
  'oneworld',
  'skyteam',
];

// Cabin/class terms — alone they're factual; only count toward intent when paired
// with a strong flight token or route.
const CABIN_TERMS = [
  'business class',
  'first class',
  'economy class',
  'premium economy',
  'economy',
  'business',
  'first',
];

// Miles / points — count toward intent when combined with a destination / route /
// flight word.
const MILES_POINTS_TOKENS = [
  'miles',
  'meilen',
  'points',
  'punkte',
  'avios',
  'aeroplan',
];

// Idiomatic / figurative uses to suppress.
const FIGURATIVE_FLY_PHRASES = [
  'time flies',
  'time flew',
  'fly off the handle',
  'fly on the wall',
  'pigs fly',
  'pigs might fly',
  'fly under the radar',
  'die zeit fliegt',
];

// --- Helpers ----------------------------------------------------------------

/** Match an IATA airport code (3 uppercase letters as a standalone word). */
const IATA_REGEX = /\b[A-Z]{3}\b/g;

/** "from X to Y" / "von X nach Y" — route pattern. */
const ROUTE_PATTERNS = [
  /\bfrom\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\s\-']{1,40}\s+to\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\s\-']{1,40}/i,
  /\bvon\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\s\-']{1,40}\s+nach\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\s\-']{1,40}/i,
];

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function hasIataCode(text: string): boolean {
  // Use the original-case text to detect IATA codes (case-sensitive).
  const matches = text.match(IATA_REGEX);
  if (!matches) return false;
  // Filter out very common 3-letter words that happen to be uppercase
  // (e.g. "USA", "AND", "THE"). These are not airport codes.
  const NON_IATA = new Set(['USA', 'AND', 'THE', 'FOR', 'NOT', 'YOU', 'ARE']);
  return matches.some((m) => !NON_IATA.has(m));
}

function hasRoutePattern(text: string): boolean {
  return ROUTE_PATTERNS.some((p) => p.test(text));
}

function hasFigurativeFly(lower: string): boolean {
  return containsAny(lower, FIGURATIVE_FLY_PHRASES);
}

function hasCheapestFlightLikeIntent(lower: string): boolean {
  // "cheapest flight to ...", "günstigster Flug nach ...", "billiger flug"
  const cheapWord =
    '(cheapest|cheap|best|günstigster|günstigste|günstiger|billiger|billigste)';
  return (
    new RegExp(`\\b${cheapWord}\\b[^.\\n]{0,40}\\b(flight|flug)\\b`).test(lower) ||
    /\bflight\b[^.\n]{0,30}\bto\b/.test(lower) ||
    /\bflug\b[^.\n]{0,30}\bnach\b/.test(lower)
  );
}

// --- Public API -------------------------------------------------------------

/**
 * Returns true when the user message contains clear flight-search intent.
 *
 * Heuristic (in order):
 *   1. Empty / whitespace-only → false.
 *   2. Figurative "fly" idiom present and no strong flight token → false.
 *   3. Pure factual airline / cabin question (factual marker + cabin term, no
 *      strong token, no route) → false.
 *   4. Strong flight token (Flug, flight, airfare, …) present:
 *        - if also a factual marker AND no route AND no IATA AND no
 *          miles/points/cheapest signal → false (e.g. "Was ist ein Codeshare-Flug?")
 *        - otherwise → true.
 *   5. Weak flight token (fly, fliegen, …) + corroboration (route pattern, IATA,
 *      miles/points, "cheapest … to …") → true.
 *   6. Route pattern + (miles/points OR cabin term) → true.
 *   7. Miles/points + clear travel destination context (e.g. "to Bangkok",
 *      "nach Tokyo") → true.
 *   8. Otherwise → false.
 */
export function isFlightIntent(userText: string | undefined | null): boolean {
  if (!userText) return false;

  const text = userText.trim();
  if (text.length === 0) return false;

  const lower = text.toLowerCase();

  // 2. Figurative — only suppress if there's no strong flight token alongside.
  const hasStrong = containsAny(lower, STRONG_FLIGHT_TOKENS);
  if (hasFigurativeFly(lower) && !hasStrong) return false;

  const hasWeak = containsAny(lower, WEAK_FLIGHT_TOKENS);
  const hasFactualMarker = containsAny(lower, FACTUAL_QUESTION_MARKERS);
  const hasCabin = containsAny(lower, CABIN_TERMS);
  const hasMilesPoints = containsAny(lower, MILES_POINTS_TOKENS);
  const hasRoute = hasRoutePattern(text);
  const hasIata = hasIataCode(text);
  const hasCheapestFlight = hasCheapestFlightLikeIntent(lower);

  // 3. Pure factual airline / cabin question.
  if (hasFactualMarker && hasCabin && !hasStrong && !hasRoute && !hasIata) {
    return false;
  }

  // 4. Strong token — usually true, but reject pure factual definitions.
  if (hasStrong) {
    const factualOnly =
      hasFactualMarker &&
      !hasRoute &&
      !hasIata &&
      !hasMilesPoints &&
      !hasCheapestFlight &&
      // "Was ist ein Codeshare-Flug?" → no destination, no price, no route.
      !/\b(to|nach)\s+[A-Za-zÄÖÜäöüß]/i.test(text);
    if (factualOnly) return false;
    return true;
  }

  // 5. Weak token + corroboration.
  if (hasWeak && (hasRoute || hasIata || hasMilesPoints || hasCheapestFlight)) {
    return true;
  }

  // 6. Route + cabin/miles signal.
  if (hasRoute && (hasMilesPoints || hasCabin)) return true;

  // 7. Miles/points + travel-destination phrasing.
  if (
    hasMilesPoints &&
    /\b(to|nach)\s+[A-Za-zÄÖÜäöüß]{3,}/i.test(text) &&
    // Avoid pure factual loyalty Qs ("How do miles work?")
    !hasFactualMarker
  ) {
    return true;
  }

  return false;
}

/**
 * Best-effort extraction of plain text from a UI / model message's content.
 * Accepts:
 *   - string content
 *   - array of parts: each part may be `{ type: 'text', text }` (UIMessage)
 *     or `{ type: 'text', text }` / `{ type: 'image' | 'file', ... }` (ModelMessage).
 *
 * Returns the concatenated text, or "" if no text is available.
 */
export function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== 'object') return '';

  // UIMessage shape: { role, parts: [{ type: 'text', text }, ...] }
  const parts = (message as { parts?: unknown }).parts;
  if (Array.isArray(parts)) {
    return parts
      .map((p) => {
        if (p && typeof p === 'object') {
          const part = p as { type?: string; text?: unknown };
          if (part.type === 'text' && typeof part.text === 'string') return part.text;
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  // ModelMessage shape: { role, content: string | Array<...> }
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object') {
          const part = c as { type?: string; text?: unknown };
          if (part.type === 'text' && typeof part.text === 'string') return part.text;
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  return '';
}
