import { createOpenAI } from '@ai-sdk/openai';

// OpenAI Provider configured with GPT-5
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default model: GPT-5
export const DEFAULT_MODEL = 'gpt-5';

// Export the OpenAI language model
export const languageModel = openai(DEFAULT_MODEL);

// GPT-5 model capabilities
export const MODEL_CAPABILITIES = {
  vision: true,
  reasoning: true,
  pdf: true,
  maxOutputTokens: 16000,
};

// Simplified helper functions for GPT-5
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

// No authentication required for the app (as per plan)
export function requiresAuthentication(): boolean {
  return false;
}

export function requiresProSubscription(): boolean {
  return false;
}

export function getAcceptedFileTypes(): string {
  return 'image/*,.pdf';
}

// Legacy exports for backward compatibility
export function getModelConfig(modelValue?: string) {
  // Return GPT-5 config regardless of input
  return {
    value: 'gpt-5',
    label: 'GPT-5',
    vision: MODEL_CAPABILITIES.vision,
    reasoning: MODEL_CAPABILITIES.reasoning,
    pdf: MODEL_CAPABILITIES.pdf,
    maxOutputTokens: MODEL_CAPABILITIES.maxOutputTokens,
  };
}

export function shouldBypassRateLimits(modelValue?: string, user?: any): boolean {
  // No rate limit bypass needed with fixed GPT-5
  return false;
}

// Export languageModel as scira for backward compatibility
export const scira = {
  languageModel: (model?: string) => languageModel,
};

// Empty models array for backward compatibility
export const models: any[] = [];
