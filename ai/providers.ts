import { createXai } from '@ai-sdk/xai';

const xaiClient = createXai({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

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

const MODELS = {
  xai: {
    name: 'grok-4-fast-reasoning',
    displayName: 'Grok 4 Fast',
    capabilities: {
      vision: true,
      reasoning: true,
      pdf: true,
      maxOutputTokens: 16000,
    },
  },
} as const;

const activeConfig = MODELS.xai;

export const languageModel = xaiClient(activeConfig.name);
export const DEFAULT_MODEL = activeConfig.name;
export const MODEL_CAPABILITIES = activeConfig.capabilities;

let _airportResolverModel: ReturnType<typeof xaiClient> | undefined;

/**
 * Returns the lightweight xAI model used for airport normalization.
 *
 * @returns The lazily initialized airport resolver model.
 */
export function getAirportResolverModel(): ReturnType<typeof xaiClient> {
  if (!_airportResolverModel) {
    _airportResolverModel = process.env.XAI_API_KEY
      ? xaiClient('grok-4-1-fast-non-reasoning')
      : (languageModel as ReturnType<typeof xaiClient>);
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
 * @returns The active xAI model configuration.
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

console.log('[AI Provider] Using xAI Grok 4 Fast');
console.log(`[AI Provider] Model: ${activeConfig.name}`);
