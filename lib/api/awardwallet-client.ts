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

/**
 * Cached proxy dispatcher tagged with the URL it was built for.
 * If the configured AWARDWALLET_PROXY_URL changes (e.g. via Next.js HMR
 * when .env.local is edited in dev), we rebuild the dispatcher so it
 * doesn't keep pointing at a stale proxy endpoint.
 */
let cachedDispatcher: { url: string; agent: ProxyAgent } | undefined;

function getProxyDispatcher(): ProxyAgent | undefined {
  const url = serverEnv.AWARDWALLET_PROXY_URL;
  if (!url) return undefined;
  if (cachedDispatcher && cachedDispatcher.url === url) {
    return cachedDispatcher.agent;
  }
  try {
    const agent = new ProxyAgent(url);
    cachedDispatcher = { url, agent };
    return agent;
  } catch (err) {
    console.error('[AwardWallet] Failed to create ProxyAgent:', err);
    cachedDispatcher = undefined;
    return undefined;
  }
}

function withAwardWalletProxy(init: RequestInit): RequestInit {
  const dispatcher = getProxyDispatcher();
  if (!dispatcher) {
    return init;
  }
  return { ...init, dispatcher } as RequestInit;
}

/**
 * Classifies an upstream HTTP status into the appropriate ChatSDKError code.
 * Auth (401/403) and 5xx coming from the upstream API are NOT user-input
 * errors, so they must not be reported as `bad_request:api` (which renders
 * "check your input" to the end user). They are surfaced as
 * `service_unavailable:api` instead.
 */
function classifyUpstreamStatus(status: number): 'service_unavailable:api' | 'bad_request:api' {
  if (status === 401 || status === 403) return 'service_unavailable:api';
  if (status >= 500) return 'service_unavailable:api';
  return 'bad_request:api';
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

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authentication': apiKey,
    },
    body: JSON.stringify(authPayload),
  };

  try {
    const useProxy = !!getProxyDispatcher();
    console.error('[AwardWallet] Calling create-auth-url API (proxy:', useProxy, ')');

    let response: Response;
    try {
      response = await fetch(
        `${AWARDWALLET_BASE_URL}/create-auth-url`,
        withAwardWalletProxy(fetchOptions),
      );
    } catch (fetchError) {
      // If a proxy is configured, ALL outbound calls MUST go through it
      // (AwardWallet enforces an IP allowlist). A proxy-fetch failure must
      // bubble up as a real upstream error and not silently retry direct.
      if (useProxy) {
        console.error('[AwardWallet] Proxy fetch failed:', fetchError);
        throw new ChatSDKError(
          'service_unavailable:api',
          `AwardWallet proxy fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        );
      }
      throw fetchError;
    }

    console.error('[AwardWallet] API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AwardWallet] Failed to create auth URL:', response.status, errorText);
      throw new ChatSDKError(
        classifyUpstreamStatus(response.status),
        response.status === 401 || response.status === 403
          ? `Upstream authentication failed (status ${response.status})`
          : `AwardWallet API error: ${response.status}`,
      );
    }

    const data = await response.json();
    console.error('[AwardWallet] API response data keys:', Object.keys(data));

    if (!data.url || typeof data.url !== 'string') {
      console.error('[AwardWallet] API returned 200 but missing url field:', JSON.stringify(data));
      throw new ChatSDKError('service_unavailable:api', 'AwardWallet API returned no authorization URL');
    }

    console.error('[AwardWallet] Auth URL created successfully');
    return data.url;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      console.error('[AwardWallet] createAuthUrl ChatSDKError:', error.message, error.cause);
      throw error;
    }
    console.error('[AwardWallet] createAuthUrl unexpected error:', error);
    throw new ChatSDKError(
      'service_unavailable:api',
      `Failed to generate authorization URL: ${error instanceof Error ? error.message : String(error)}`,
    );
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

  // Validate user-supplied input up front. A missing/malformed code is a
  // genuine bad-request — keep it as `bad_request:api` so the user sees
  // "check your input".
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    throw new ChatSDKError('bad_request:api', 'Missing or invalid authorization code');
  }

  console.error('[AwardWallet] Exchanging code for connection info');

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
      // 400 from this endpoint usually means an invalid/expired code (user input).
      if (response.status === 400 || response.status === 404) {
        throw new ChatSDKError('bad_request:api', 'Invalid or expired authorization code');
      }
      throw new ChatSDKError(
        classifyUpstreamStatus(response.status),
        response.status === 401 || response.status === 403
          ? `Upstream authentication failed (status ${response.status})`
          : `AwardWallet API error: ${response.status}`,
      );
    }

    const data = await response.json();
    console.error('[AwardWallet] Connection info retrieved, userId:', data.userId);

    return {
      userId: String(data.userId),
    };
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    console.error('[AwardWallet] getConnectionInfo error:', error);
    throw new ChatSDKError(
      'service_unavailable:api',
      `Failed to exchange authorization code: ${error instanceof Error ? error.message : String(error)}`,
    );
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

  console.error('[AwardWallet] Fetching accounts for user:', awUserId);

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
      throw new ChatSDKError(
        classifyUpstreamStatus(response.status),
        response.status === 401 || response.status === 403
          ? `Upstream authentication failed (status ${response.status})`
          : `Failed to fetch loyalty accounts: status ${response.status}`,
      );
    }

    const data = await response.json();
    // API returns accounts array directly in the response
    const accounts: AWRawAccount[] = data.accounts || [];

    console.error(`[AwardWallet] Retrieved ${accounts.length} accounts`);

    return accounts.map(formatAccount);
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    console.error('[AwardWallet] getConnectedUser error:', error);
    throw new ChatSDKError(
      'service_unavailable:api',
      `Failed to fetch loyalty accounts: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Parses expiration date string safely, returning null for invalid dates
 * @param dateStr - Date string from AwardWallet API
 * @returns Valid Date object or null
 */
function parseExpirationDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Generates a fallback provider code from the display name
 * Used when AwardWallet API returns accounts without a code field
 * @param displayName - The provider's display name
 * @returns A normalized code string (e.g., "Amex Centurion" -> "amex-centurion")
 */
function generateProviderCode(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Formats raw AwardWallet account data to MYLO format
 */
function formatAccount(raw: AWRawAccount): AWLoyaltyAccount {
  // Extract elite status from properties (kind=3 is elite status)
  const eliteStatusProp = raw.properties?.find((p) => p.kind === 3);
  const eliteStatus = eliteStatusProp?.value || null;

  // Generate fallback code from displayName if code is missing
  const providerCode = raw.code || generateProviderCode(raw.displayName);

  return {
    providerCode,
    providerName: raw.displayName,
    balance: Math.round(raw.balanceRaw ?? 0),
    balanceUnit: parseBalanceUnit(raw.kind),
    eliteStatus,
    expirationDate: parseExpirationDate(raw.expirationDate),
    accountNumber: raw.login || null,
    logoUrl: null,
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

// ---------------------------------------------------------------------------
// Test-only helpers. These are not part of the public API surface and exist
// purely so unit tests can assert on the internal proxy/dispatcher behavior
// without reaching into module internals via reflection.
// ---------------------------------------------------------------------------

/** @internal — test only */
export function __resetAwardWalletDispatcherCacheForTests(): void {
  cachedDispatcher = undefined;
}

/** @internal — test only */
export function __getAwardWalletDispatcherCacheForTests(): { url: string } | undefined {
  return cachedDispatcher ? { url: cachedDispatcher.url } : undefined;
}

/** @internal — test only */
export function __getProxyDispatcherForTests(): ProxyAgent | undefined {
  return getProxyDispatcher();
}
