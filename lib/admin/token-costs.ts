export const GROK_43_PRICING_USD_PER_MILLION = {
  input: 1.25,
  cachedInput: 0.20,
  output: 2.50,
} as const;

export const GROK_45_PRICING_USD_PER_MILLION = {
  input: 2.00,
  cachedInput: 0.30,
  output: 6.00,
} as const;

export type ModelPricing = {
  input: number;
  cachedInput: number;
  output: number;
};

/**
 * Resolves per-million-token pricing from the persisted messages.model value.
 * Rows written before the Grok 4.5 bump carry 'grok-4.3' or NULL (legacy rows
 * without model tracking), so everything that isn't explicitly 'grok-4.5' is
 * priced at Grok 4.3 rates.
 * @param model - The messages.model value, or null/undefined for legacy rows.
 * @returns The matching xAI per-million-token prices.
 */
export function getGrokPricing(model?: string | null): ModelPricing {
  return model === 'grok-4.5' ? GROK_45_PRICING_USD_PER_MILLION : GROK_43_PRICING_USD_PER_MILLION;
}

export const MONTHLY_REVENUE_PER_USER_EUR = 47;
export const DEFAULT_USD_TO_EUR_RATE = 1;

export type TokenUsageBreakdown = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type TokenCostBreakdown = TokenUsageBreakdown & {
  billableInputTokens: number;
  unclassifiedOutputTokens: number;
  inputCostUsd: number;
  cachedInputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
};

/**
 * Calculates Grok API cost from token usage with cached input separated.
 * @param usage - Token usage counters captured from the AI SDK.
 * @param model - The persisted messages.model value used to pick the price table.
 * @returns Cost breakdown in USD using xAI per-million-token prices.
 */
export function calculateGrokTokenCost(
  usage: TokenUsageBreakdown,
  model?: string | null,
): TokenCostBreakdown {
  const pricing = getGrokPricing(model);
  const inputTokens = normalizeTokenCount(usage.inputTokens);
  const cachedInputTokens = Math.min(normalizeTokenCount(usage.cachedInputTokens), inputTokens);
  const outputTokens = normalizeTokenCount(usage.outputTokens);
  const totalTokens = normalizeTokenCount(usage.totalTokens);
  const billableInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const knownTokens = inputTokens + outputTokens;
  const unclassifiedOutputTokens = Math.max(0, totalTokens - knownTokens);

  const inputCostUsd = pricePerMillion(billableInputTokens, pricing.input);
  const cachedInputCostUsd = pricePerMillion(cachedInputTokens, pricing.cachedInput);
  const outputCostUsd = pricePerMillion(
    outputTokens + unclassifiedOutputTokens,
    pricing.output,
  );

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    billableInputTokens,
    unclassifiedOutputTokens,
    inputCostUsd,
    cachedInputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + cachedInputCostUsd + outputCostUsd,
  };
}

/**
 * Calculates the period revenue baseline and API-margin estimate.
 * @param params - Usage cost and commercial baseline inputs.
 * @returns Period revenue and profit estimate in EUR.
 */
export function calculateRevenueBaseline(params: {
  costUsd: number;
  days: number;
  monthlyRevenueEur?: number;
  usdToEurRate?: number;
}) {
  const monthlyRevenueEur = params.monthlyRevenueEur ?? MONTHLY_REVENUE_PER_USER_EUR;
  const usdToEurRate = params.usdToEurRate ?? DEFAULT_USD_TO_EUR_RATE;
  const revenueEur = (monthlyRevenueEur / 30) * params.days;
  const costEur = params.costUsd * usdToEurRate;

  return {
    revenueEur,
    costEur,
    profitEur: revenueEur - costEur,
  };
}

function normalizeTokenCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function pricePerMillion(tokens: number, priceUsdPerMillion: number): number {
  return (tokens / 1_000_000) * priceUsdPerMillion;
}
