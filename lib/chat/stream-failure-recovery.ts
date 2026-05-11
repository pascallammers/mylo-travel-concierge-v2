import { formatKiwiResults } from '@/lib/tools/kiwi-flight-search';
import { formatSkiplaggedResults } from '@/lib/tools/skiplagged-flight-search';
import type { CachedToolResult, ToolResultsByName } from './tool-result-cache';

export type RecoveryLocale = 'de' | 'en';

export interface RenderableMessage {
  content: string;
}

export type RecoveryRenderer = (result: unknown) => string;

interface RecoverPartialOutputOptions {
  renderers?: Record<string, RecoveryRenderer>;
}

const RECOVERABLE_FINISH_REASONS = new Set(['error']);

const recoveryText = {
  header: {
    de: '## Die finale Auswertung konnte nicht generiert werden',
    en: '## The final summary could not be generated',
  },
  intro: {
    de: 'Hier sind die Rohdaten der Suche, die bereits erfolgreich geladen wurden.',
    en: 'Here are the raw search results that were already loaded successfully.',
  },
  footer: {
    de: 'Bitte versuchen Sie es erneut, falls Sie eine zusammengefasste Empfehlung möchten.',
    en: 'Please try again if you want a summarized recommendation.',
  },
} as const;

const defaultRenderers: Record<string, RecoveryRenderer> = {
  search_flights: renderMarkdownOrJson,
  kiwi_flight_search: (result) => (typeof result === 'string' ? result : formatKiwiResults(result)),
  skiplagged_flight_search: (result) =>
    typeof result === 'string' ? result : formatSkiplaggedResults(result),
};

/**
 * Builds a fallback assistant message from cached tool outputs after synthesis failure.
 *
 * @param toolResults - Stream-scoped cached tool results grouped by tool name.
 * @param finishReason - AI SDK finish reason.
 * @param locale - Locale used for the recovery header and footer.
 * @param options - Optional tool renderer overrides for tests or extensions.
 * @returns Renderable markdown message, or null when recovery is not appropriate.
 */
export function recoverPartialOutput(
  toolResults: ToolResultsByName,
  finishReason: string,
  locale: RecoveryLocale,
  options: RecoverPartialOutputOptions = {},
): RenderableMessage | null {
  if (!RECOVERABLE_FINISH_REASONS.has(finishReason)) {
    return null;
  }

  const entries = flattenToolResults(toolResults);
  if (entries.length === 0) {
    return null;
  }

  const renderers = { ...defaultRenderers, ...options.renderers };
  const sections = [
    recoveryText.header[locale],
    '',
    recoveryText.intro[locale],
    '',
  ];

  for (const entry of entries) {
    const renderer = renderers[entry.toolName] ?? renderGenericJsonBlock;
    sections.push(`### ${entry.toolName}`);
    sections.push('');
    sections.push(renderer(entry.result));
    sections.push('');
  }

  sections.push('---');
  sections.push('');
  sections.push(recoveryText.footer[locale]);

  return { content: sections.join('\n') };
}

/**
 * Detects the app locale from a request referer.
 *
 * @param referer - Optional request referer URL.
 * @returns Supported recovery locale, defaulting to English.
 */
export function resolveRecoveryLocale(referer: string | null): RecoveryLocale {
  if (!referer) return 'en';

  try {
    const path = new URL(referer).pathname;
    return path === '/de' || path.startsWith('/de/') ? 'de' : 'en';
  } catch {
    return referer.includes('/de/') ? 'de' : 'en';
  }
}

/**
 * Enables a manual synthesis-failure smoke test in local/dev contexts only.
 *
 * @param headers - Request headers.
 * @param env - Current Node environment.
 * @param envFlag - Optional environment flag override.
 * @returns True when a forced synthesis failure should be injected.
 */
export function shouldForceSynthesisFailure(
  headers: Headers,
  env: string | undefined,
  envFlag: string | undefined,
): boolean {
  if (env === 'production') {
    return false;
  }

  const headerEnabled = headers.get('x-mylo-force-synthesis-failure') === '1';
  const envEnabled = envFlag === '1' || envFlag === 'true';
  return headerEnabled || envEnabled;
}

function flattenToolResults(toolResults: ToolResultsByName): CachedToolResult[] {
  return [...toolResults.values()]
    .flat()
    .sort((a, b) => a.sequence - b.sequence);
}

function renderMarkdownOrJson(result: unknown): string {
  return typeof result === 'string' ? result : renderGenericJsonBlock(result);
}

function renderGenericJsonBlock(result: unknown): string {
  return ['```json', stringifyResult(result), '```'].join('\n');
}

function stringifyResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}
