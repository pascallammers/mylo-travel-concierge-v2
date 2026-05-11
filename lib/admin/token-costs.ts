export const GROK_43_PRICING_USD_PER_MILLION = {
  input: 1.25,
  cachedInput: 0.20,
  output: 2.50,
} as const;

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
 * Calculates Grok 4.3 API cost from token usage with cached input separated.
 * @param usage - Token usage counters captured from the AI SDK.
 * @returns Cost breakdown in USD using xAI per-million-token prices.
 */
export function calculateGrok43TokenCost(usage: TokenUsageBreakdown): TokenCostBreakdown {
  const inputTokens = normalizeTokenCount(usage.inputTokens);
  const cachedInputTokens = Math.min(normalizeTokenCount(usage.cachedInputTokens), inputTokens);
  const outputTokens = normalizeTokenCount(usage.outputTokens);
  const totalTokens = normalizeTokenCount(usage.totalTokens);
  const billableInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const knownTokens = inputTokens + outputTokens;
  const unclassifiedOutputTokens = Math.max(0, totalTokens - knownTokens);

  const inputCostUsd = pricePerMillion(billableInputTokens, GROK_43_PRICING_USD_PER_MILLION.input);
  const cachedInputCostUsd = pricePerMillion(cachedInputTokens, GROK_43_PRICING_USD_PER_MILLION.cachedInput);
  const outputCostUsd = pricePerMillion(
    outputTokens + unclassifiedOutputTokens,
    GROK_43_PRICING_USD_PER_MILLION.output,
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
