export const PREVIEW_AREA_SLUGS = ['alerts', 'cards'] as const;

export type PreviewAreaSlug = (typeof PREVIEW_AREA_SLUGS)[number];

export type RegisterAreaInterestResult =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'unknown_area' };

/**
 * Validate untrusted input against the preview areas.
 * @param value - Untrusted area slug.
 * @returns A known preview slug, or null for invalid input.
 */
export function parsePreviewAreaSlug(value: unknown): PreviewAreaSlug | null {
  return PREVIEW_AREA_SLUGS.find((slug) => slug === value) ?? null;
}

/**
 * Fill missing preview areas in grouped interest counts.
 * @param rows - Counts grouped by preview area.
 * @returns Counts for every preview area, defaulting to zero.
 */
export function toAreaInterestCounts(
  rows: readonly { areaSlug: PreviewAreaSlug; count: number }[],
): Record<PreviewAreaSlug, number> {
  const counts: Record<PreviewAreaSlug, number> = { alerts: 0, cards: 0 };
  for (const row of rows) counts[row.areaSlug] = row.count;
  return counts;
}
