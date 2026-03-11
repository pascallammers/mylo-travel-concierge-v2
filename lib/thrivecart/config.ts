import { serverEnv } from '@/env/server';

export const thrivecartConfig = {
  apiKey: serverEnv.THRIVECART_API_KEY,
  secretWord: serverEnv.THRIVECART_SECRET_WORD,
  productId: serverEnv.THRIVECART_PRODUCT_ID,
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
