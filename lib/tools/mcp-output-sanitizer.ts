/**
 * Sanitize values from external MCP responses before embedding them into the
 * LLM-visible prompt context.
 *
 * Currently neutralizes triple-backtick fences inside string values so a
 * malicious or compromised MCP provider cannot break out of a `\`\`\`json`
 * code block and inject markdown directives, system-prompt impersonation, or
 * fake assistant turns into the model context. Replaces fence sequences with
 * the U+02CB homoglyph, which renders visually similar but is not a Markdown
 * fence character.
 *
 * This is a pragmatic mitigation, not a complete defense. The proper fix is
 * a strict DTO per tool that whitelists known fields — see the TODOs in
 * `formatKiwiResults`, `formatTrivagoResults`, and `formatFerryhopperResults`.
 */
export function sanitizeForCodeblock(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/`{3,}/g, (m) => 'ˋ'.repeat(m.length));
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForCodeblock);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForCodeblock(v);
    }
    return out;
  }
  return value;
}
