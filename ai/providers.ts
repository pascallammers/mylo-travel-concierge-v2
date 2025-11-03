import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';

// ============================================
// PROVIDER SWITCH - Single Boolean Control
// ============================================
// Set USE_XAI=true in environment to use xAI Grok 4 Fast
// Set USE_XAI=false (or omit) to use OpenAI GPT-5
// ============================================

const USE_XAI = process.env.USE_XAI === 'true';

// Provider clients
const openaiClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const xaiClient = createXai({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

// Model configurations
const MODELS = {
  openai: {
    name: 'gpt-5',
    displayName: 'GPT-5',
    capabilities: {
      vision: true,
      reasoning: true,
      pdf: true,
      maxOutputTokens: 16000,
    },
  },
  xai: {
    name: 'grok-4-fast-reasoning',
    displayName: 'Grok 4 Fast',
    capabilities: {
      vision: false,
      reasoning: true,
      pdf: false,
      maxOutputTokens: 16000,
    },
  },
} as const;

// Active configuration based on USE_XAI flag
const activeConfig = USE_XAI ? MODELS.xai : MODELS.openai;
const activeClient = USE_XAI ? xaiClient : openaiClient;

// Export active language model
export const languageModel = activeClient(activeConfig.name);
export const DEFAULT_MODEL = activeConfig.name;
export const MODEL_CAPABILITIES = activeConfig.capabilities;

// Helper functions
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

export function requiresAuthentication(modelValue?: string): boolean {
  return false;
}

export function requiresProSubscription(modelValue?: string): boolean {
  return false;
}

export function getAcceptedFileTypes(): string {
  return 'image/*,.pdf';
}

// Legacy exports for backward compatibility
export function getModelConfig(modelValue?: string) {
  return {
    value: activeConfig.name,
    label: activeConfig.displayName,
    vision: MODEL_CAPABILITIES.vision,
    reasoning: MODEL_CAPABILITIES.reasoning,
    pdf: MODEL_CAPABILITIES.pdf,
    maxOutputTokens: MODEL_CAPABILITIES.maxOutputTokens,
  };
}

export function shouldBypassRateLimits(modelValue?: string, user?: any): boolean {
  return false;
}

// Export languageModel as scira for backward compatibility
export const scira = {
  languageModel: (model?: string) => languageModel,
};

// Empty models array for backward compatibility
export const models: any[] = [];

// Log active provider on startup
console.log(`[AI Provider] Using ${USE_XAI ? 'xAI Grok 4 Fast' : 'OpenAI GPT-5'}`);
console.log(`[AI Provider] Model: ${activeConfig.name}`);
