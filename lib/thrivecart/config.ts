import { serverEnv } from '@/env/server';
import { parseMyloProductIds, primaryMyloProductIdString } from './mylo-product-ids';

const myloProductIds = parseMyloProductIds();

export const thrivecartConfig = {
  apiKey: serverEnv.THRIVECART_API_KEY,
  secretWord: serverEnv.THRIVECART_SECRET_WORD,
  /** All ThriveCart product IDs that grant MYLO access (standalone + upsell). */
  productIds: myloProductIds,
  /** Primary id for KPI/API filters (standalone product when present). */
  productId: primaryMyloProductIdString(myloProductIds),
  accountId: serverEnv.THRIVECART_ACCOUNT_ID,
  apiBaseUrl: 'https://thrivecart.com/api/external',
  rateLimitPerMinute: 60,
} as const;

/**
 * Verify that a webhook request is authentic by checking the thrivecart_secret.
 */
export function verifyWebhookSecret(secret: string): boolean {
  return secret === thrivecartConfig.secretWord;
}
