import 'server-only';

export interface PriceStats {
  mean: number;
  stddev: number;
  count: number;
  min: number;
  max: number;
}

/**
 * Compute mean and standard deviation from an array of prices.
 */
export function computePriceStats(prices: number[]): PriceStats | null {
  if (prices.length < 2) return null;

  const count = prices.length;
  const mean = prices.reduce((sum, p) => sum + p, 0) / count;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / (count - 1);
  const stddev = Math.sqrt(variance);

  return {
    mean,
    stddev,
    count,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

/**
 * Calculate deal score (0-100) using Z-score percentile ranking.
 *
 * Higher score = better deal.
 * Z-Score = (mean - currentPrice) / stddev
 * Score maps the Z-score to a 0-100 percentile.
 *
 * Score > 90: Exceptional deal
 * Score 70-90: Very good deal
 * Score 60-70: Good deal
 * Score < 60: Not shown as deal
 */
export function calculateDealScore(
  currentPrice: number,
  stats: PriceStats,
): number {
  if (stats.stddev === 0) {
    return currentPrice < stats.mean ? 80 : 50;
  }

  const zScore = (stats.mean - currentPrice) / stats.stddev;
  const score = Math.round(50 + 50 * erf(zScore / Math.SQRT2));

  return Math.max(0, Math.min(100, score));
}

/**
 * Error function approximation (Abramowitz and Stegun).
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const a = Math.abs(x);

  const t = 1.0 / (1.0 + 0.3275911 * a);
  const y =
    1.0 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);

  return sign * y;
}

/**
 * Determine deal category based on score.
 */
export function getDealCategory(score: number): 'exceptional' | 'very_good' | 'good' | 'normal' {
  if (score >= 90) return 'exceptional';
  if (score >= 70) return 'very_good';
  if (score >= 60) return 'good';
  return 'normal';
}
