import 'server-only';

import { serverEnv } from '@/env/server';
import { ChatSDKError } from '@/lib/errors';
import type { LoyaltyBalanceUnit } from '@/lib/db/schema';

const AWARDWALLET_BASE_URL = 'https://business.awardwallet.com/api/business';

/**
 * Raw account data from AwardWallet API
 */
interface AWRawAccount {
  id: number;
  displayName: string;
  valueName: string;
  kind: string;
  login: string;
  balance?: {
    value: number;
    date: string;
  };
  expireDate?: string;
  eliteLevelName?: string;
  lastCheckedAt?: string;
  logoUrl?: string;
}

/**
 * Connection info returned after OAuth code exchange
 */
export interface AWConnectionInfo {
  userId: string;
}

/**
 * Loyalty account data formatted for MYLO
 */
export interface AWLoyaltyAccount {
  providerCode: string;
  providerName: string;
  balance: number;
  balanceUnit: LoyaltyBalanceUnit;
  eliteStatus: string | null;
  expirationDate: Date | null;
  accountNumber: string | null;
  logoUrl: string | null;
}

/**
 * Creates the AwardWallet OAuth consent URL
 * @returns The URL to redirect users to for OAuth consent
 */
export async function createAuthUrl(): Promise<string> {
  const apiKey = serverEnv.AWARDWALLET_API_KEY;
  const callbackUrl =
    serverEnv.AWARDWALLET_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/awardwallet/auth/callback`;

  console.log('[AwardWallet] Creating auth URL with callback:', callbackUrl);

  try {
    const response = await fetch(`${AWARDWALLET_BASE_URL}/create-auth-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        callbackUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AwardWallet] Failed to create auth URL:', response.status, errorText);
      throw new ChatSDKError('bad_request:api', `AwardWallet API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[AwardWallet] Auth URL created successfully');

    return data.authUrl;
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    console.error('[AwardWallet] createAuthUrl error:', error);
    throw new ChatSDKError('bad_request:api', 'Failed to generate authorization URL');
  }
}

/**
 * Exchanges OAuth authorization code for user connection info
 * @param code - The authorization code from OAuth callback
 * @returns Connection info with AwardWallet userId
 */
export async function getConnectionInfo(code: string): Promise<AWConnectionInfo> {
  const apiKey = serverEnv.AWARDWALLET_API_KEY;

  console.log('[AwardWallet] Exchanging code for connection info');

  try {
    const response = await fetch(`${AWARDWALLET_BASE_URL}/get-connection-info/${code}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AwardWallet] Failed to get connection info:', response.status, errorText);
      throw new ChatSDKError('bad_request:api', `Invalid or expired authorization code`);
    }

    const data = await response.json();
    console.log('[AwardWallet] Connection info retrieved, userId:', data.userId);

    return {
      userId: String(data.userId),
    };
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    console.error('[AwardWallet] getConnectionInfo error:', error);
    throw new ChatSDKError('bad_request:api', 'Failed to exchange authorization code');
  }
}

/**
 * Fetches all loyalty accounts for a connected user
 * @param awUserId - The AwardWallet userId
 * @returns Array of loyalty accounts
 */
export async function getConnectedUser(awUserId: string): Promise<AWLoyaltyAccount[]> {
  const apiKey = serverEnv.AWARDWALLET_API_KEY;

  console.log('[AwardWallet] Fetching accounts for user:', awUserId);

  try {
    const response = await fetch(`${AWARDWALLET_BASE_URL}/get-connected-user/${awUserId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AwardWallet] Failed to get connected user:', response.status, errorText);
      throw new ChatSDKError('bad_request:api', `Failed to fetch loyalty accounts`);
    }

    const data = await response.json();
    const accounts: AWRawAccount[] = data.accounts || [];

    console.log(`[AwardWallet] Retrieved ${accounts.length} accounts`);

    return accounts.map(formatAccount);
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    console.error('[AwardWallet] getConnectedUser error:', error);
    throw new ChatSDKError('bad_request:api', 'Failed to fetch loyalty accounts');
  }
}

/**
 * Formats raw AwardWallet account data to MYLO format
 */
function formatAccount(raw: AWRawAccount): AWLoyaltyAccount {
  return {
    providerCode: String(raw.id),
    providerName: raw.displayName,
    balance: raw.balance?.value ?? 0,
    balanceUnit: parseBalanceUnit(raw.valueName, raw.kind),
    eliteStatus: raw.eliteLevelName || null,
    expirationDate: raw.expireDate ? new Date(raw.expireDate) : null,
    accountNumber: raw.login || null,
    logoUrl: raw.logoUrl || null,
  };
}

/**
 * Parses the balance unit from AwardWallet's valueName and kind fields
 */
function parseBalanceUnit(valueName: string, kind: string): LoyaltyBalanceUnit {
  const lowerValue = (valueName || '').toLowerCase();
  const lowerKind = (kind || '').toLowerCase();

  if (lowerValue.includes('mile') || lowerKind.includes('airline')) {
    return 'miles';
  }
  if (lowerValue.includes('night') || lowerKind.includes('hotel')) {
    return 'nights';
  }
  if (lowerValue.includes('credit')) {
    return 'credits';
  }
  return 'points';
}
