import type { EurRates } from '@/lib/deals/award-valuation';

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR';

interface FrankfurterResponse {
  base: string;
  rates: Record<string, number>;
}

function createEurOnlyRates(): EurRates {
  return {
    toEur: (amount, currency) => (currency === 'EUR' ? amount : null),
  };
}

/**
 * Load the daily ECB reference rates (Frankfurter) once per scan run.
 *
 * @param fetchImpl - Fetch implementation, injected for tests.
 * @returns EUR converter; on any failure it only knows EUR and warns once.
 */
export async function fetchEurRates(fetchImpl: typeof fetch): Promise<EurRates> {
  try {
    const response = await fetchImpl(FRANKFURTER_URL);
    if (!response.ok) {
      throw new Error(`Frankfurter HTTP ${response.status}`);
    }
    const data = (await response.json()) as FrankfurterResponse;
    const rates = data.rates ?? {};
    return {
      toEur: (amount, currency) => {
        if (currency === 'EUR') return amount;
        const rate = rates[currency];
        return typeof rate === 'number' && rate > 0 ? amount / rate : null;
      },
    };
  } catch (error) {
    console.warn(
      '[EurRates] FX rates unavailable, taxes stay unconverted:',
      error instanceof Error ? error.message : error,
    );
    return createEurOnlyRates();
  }
}
