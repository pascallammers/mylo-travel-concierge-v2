// lib/chat/__evals__/parts.ts
//
// Pure helpers for working with AI SDK 5.x `message.parts` arrays.
// Extracted from extract-real-chats.ts so they can be unit-tested without
// pulling in DB clients or Drizzle imports.

/**
 * Extract and concatenate all text content from an AI SDK 5.x `parts` array.
 *
 * AI SDK messages can contain multiple `text` chunks interleaved with tool
 * calls and other part types. The previous first-only implementation silently
 * dropped context and locked the wrong baseline into eval fixtures whenever a
 * production message had more than one text part.
 *
 * @param parts - Unknown value, expected to be a JSONB array from message.parts.
 * @returns All text-part contents joined with newlines and trimmed, or an
 *   empty string if `parts` is not an array or contains no text parts.
 */
export function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  const texts: string[] = [];
  for (const p of parts) {
    if (
      p &&
      typeof p === 'object' &&
      'type' in p &&
      (p as { type: string }).type === 'text'
    ) {
      const text = 'text' in p ? (p as { text: unknown }).text : '';
      texts.push(String(text ?? ''));
    }
  }
  return texts.join('\n').trim();
}
