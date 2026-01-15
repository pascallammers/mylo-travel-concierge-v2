import 'server-only';

import { serverEnv } from '@/env/server';
import { ChatSDKError } from '@/lib/errors';
import type { LoyaltyBalanceUnit } from '@/lib/db/schema';
import { ProxyAgent } from 'undici';

/**
 * AwardWallet Business API base URL
 * Documentation: https://awardwallet.com/api/account
 */
const AWARDWALLET_BASE_URL = 'https://business.awardwallet.com/api/export/v1';
const awardWalletDispatcher = serverEnv.AWARDWALLET_PROXY_URL
  ? new ProxyAgent(serverEnv.AWARDWALLET_PROXY_URL)
  : undefined;

function withAwardWalletProxy(init: RequestInit): RequestInit {
  if (!awardWalletDispatcher) {
    return init;
  }
  return { ...init, dispatcher: awardWalletDispatcher } as RequestInit;
}

/**
 * Account property from AwardWallet API
 */
interface AWAccountProperty {
  name: string;
  value: string;
  kind?: number;
  rank?: number;
}

/**
 * Raw account data from AwardWallet API
 * @see https://awardwallet.com/api/account#object-Account
 */
interface AWRawAccount {
  accountId: number;
  code: string;
  displayName: string;
  kind: string;
  login: string;
  balance?: string;
  balanceRaw?: number;
  expirationDate?: string;
  properties?: AWAccountProperty[];
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
 * Uses the create-auth-url endpoint to generate a secure connection link
 * @see https://awardwallet.com/api/account#method-Connect_1
 * @returns The URL to redirect users to for OAuth consent
 */
export async function createAuthUrl(): Promise<string> {
  const apiKey = serverEnv.AWARDWALLET_API_KEY;
  const authPayload = {
    platform: 'mobile',
    access: 2,
    granularSharing: false,
  };

  try {
    const response = await fetch(
      `${AWARDWALLET_BASE_URL}/create-auth-url`,
      withAwardWalletProxy({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authentication': apiKey,
        },
        body: JSON.stringify(authPayload),
      }),
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AwardWallet] Failed to create auth URL:', response.status, errorText);
      throw new ChatSDKError('bad_request:api', `AwardWallet API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[AwardWallet] Auth URL created successfully');

    // API returns { url: "..." }
    return data.url;
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    console.error('[AwardWallet] createAuthUrl error:', error);
    throw new ChatSDKError('bad_request:api', 'Failed to generate authorization URL');
  }
}

/**
 * Exchanges OAuth authorization code for user connection info
 * @see https://awardwallet.com/api/account#method-Connect_2
 * @param code - The authorization code from OAuth callback
 * @returns Connection info with AwardWallet userId
 */
export async function getConnectionInfo(code: string): Promise<AWConnectionInfo> {
  const apiKey = serverEnv.AWARDWALLET_API_KEY;

  console.log('[AwardWallet] Exchanging code for connection info');

  try {
    const response = await fetch(
      `${AWARDWALLET_BASE_URL}/get-connection-info/${code}`,
      withAwardWalletProxy({
        method: 'GET',
        headers: {
          'X-Authentication': apiKey,
        },
      }),
    );

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
 * @see https://awardwallet.com/api/account#method-Connected%20Users_2
 * @param awUserId - The AwardWallet userId
 * @returns Array of loyalty accounts
 */
export async function getConnectedUser(awUserId: string): Promise<AWLoyaltyAccount[]> {
  const apiKey = serverEnv.AWARDWALLET_API_KEY;

  console.log('[AwardWallet] Fetching accounts for user:', awUserId);

  try {
    // Get connected user details with all their accounts
    const response = await fetch(
      `${AWARDWALLET_BASE_URL}/connectedUser/${awUserId}`,
      withAwardWalletProxy({
        method: 'GET',
        headers: {
          'X-Authentication': apiKey,
        },
      }),
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AwardWallet] Failed to get connected user:', response.status, errorText);
      throw new ChatSDKError('bad_request:api', `Failed to fetch loyalty accounts`);
    }

    const data = await response.json();
    // API returns accounts array directly in the response
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
  // Extract elite status from properties (kind=3 is elite status)
  const eliteStatusProp = raw.properties?.find((p) => p.kind === 3);
  const eliteStatus = eliteStatusProp?.value || null;

  return {
    providerCode: raw.code,
    providerName: raw.displayName,
    balance: raw.balanceRaw ?? 0,
    balanceUnit: parseBalanceUnit(raw.kind),
    eliteStatus,
    expirationDate: raw.expirationDate ? new Date(raw.expirationDate) : null,
    accountNumber: raw.login || null,
    logoUrl: null, // API doesn't provide logo URL in account data
  };
}

/**
 * Parses the balance unit from AwardWallet's kind field
 */
function parseBalanceUnit(kind: string): LoyaltyBalanceUnit {
  const lowerKind = (kind || '').toLowerCase();

  if (lowerKind.includes('airline')) {
    return 'miles';
  }
  if (lowerKind.includes('hotel')) {
    return 'nights';
  }
  if (lowerKind.includes('credit')) {
    return 'credits';
  }
  return 'points';
}
