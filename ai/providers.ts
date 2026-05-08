import { gateway } from '@ai-sdk/gateway';

export type AIModelDefinition = {
  value: string;
  label: string;
  description: string;
  category: string;
  vision: boolean;
  reasoning: boolean;
  pdf: boolean;
  maxOutputTokens: number;
  fast?: boolean;
  isNew?: boolean;
  pro?: boolean;
  experimental?: boolean;
  requiresAuth?: boolean;
};

// `name` is the analytics/DB identifier persisted to messages.model and filtered
// in app/api/admin/analytics/tokens/route.ts. `gatewaySlug` is the Vercel AI
// Gateway routing slug (provider/model). Keeping them separate avoids breaking
// existing analytics queries when the gateway prefix changes.
const MODELS = {
  xai: {
    name: 'grok-4.3',
    gatewaySlug: 'xai/grok-4.3',
    displayName: 'Grok 4.3',
    capabilities: {
      vision: true,
      reasoning: true,
      pdf: true,
      maxOutputTokens: 16000,
    },
  },
} as const;

const activeConfig = MODELS.xai;

export const languageModel = gateway(activeConfig.gatewaySlug);
export const DEFAULT_MODEL = activeConfig.name;
export const MODEL_CAPABILITIES = activeConfig.capabilities;

// Lightweight model for airport-code normalization. grok-3-mini is text-only
// (fine for "Frankfurt" → "FRA") and ~75% cheaper than the flagship: $0.30/M
// input vs $1.25/M, $0.50/M output vs $2.50/M.
const AIRPORT_RESOLVER_GATEWAY_SLUG = 'xai/grok-3-mini';

let _airportResolverModel: ReturnType<typeof gateway> | undefined;

export function getAirportResolverModel(): ReturnType<typeof gateway> {
  if (!_airportResolverModel) {
    _airportResolverModel = gateway(AIRPORT_RESOLVER_GATEWAY_SLUG);
  }
  return _airportResolverModel;
}

export function hasVisionSupport(): boolean {
  return MODEL_CAPABILITIES.vision;
}

export function hasPdfSupport(): boolean {
  return MODEL_CAPABILITIES.pdf;
}

export function hasReasoningSupport(): boolean {
  return MODEL_CAPABILITIES.reasoning;
}

export function getMaxOutputTokens(): number {
  return MODEL_CAPABILITIES.maxOutputTokens;
}

export function getModelParameters() {
  return {};
}

export function requiresAuthentication(_modelValue?: string): boolean {
  return false;
}

export function requiresProSubscription(_modelValue?: string): boolean {
  return false;
}

export function getAcceptedFileTypes(): string {
  return 'image/*,.pdf';
}

/**
 * Returns the active model metadata for legacy consumers.
 *
 * @param _modelValue - Unused legacy argument.
 * @returns The active model configuration.
 */
export function getModelConfig(_modelValue?: string) {
  return {
    value: activeConfig.name,
    label: activeConfig.displayName,
    vision: MODEL_CAPABILITIES.vision,
    reasoning: MODEL_CAPABILITIES.reasoning,
    pdf: MODEL_CAPABILITIES.pdf,
    maxOutputTokens: MODEL_CAPABILITIES.maxOutputTokens,
  };
}

export function shouldBypassRateLimits(_modelValue?: string, _user?: unknown): boolean {
  return false;
}

export const scira = {
  languageModel: (_model?: string) => languageModel,
};

export const models: AIModelDefinition[] = [
  {
    value: activeConfig.name,
    label: activeConfig.displayName,
    description: 'Standardmodell fuer Chat, Search und Sprachfunktionen.',
    category: 'Free',
    vision: MODEL_CAPABILITIES.vision,
    reasoning: MODEL_CAPABILITIES.reasoning,
    pdf: MODEL_CAPABILITIES.pdf,
    maxOutputTokens: MODEL_CAPABILITIES.maxOutputTokens,
    fast: true,
    isNew: true,
    pro: false,
    experimental: false,
    requiresAuth: false,
  },
];

console.log('[AI Provider] Using Vercel AI Gateway → xai/grok-4.3 (primary)');
console.log(`[AI Provider] Model: ${activeConfig.name}`);
