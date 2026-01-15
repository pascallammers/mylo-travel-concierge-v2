import { NextRequest, NextResponse } from 'next/server';
import { ProxyAgent, type Dispatcher } from 'undici';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { serverEnv } from '@/env/server';

type FetchInit = RequestInit & { dispatcher?: Dispatcher };

/**
 * GET /api/admin/awardwallet/proxy-debug
 * Verifies AwardWallet proxy routing by fetching an external IP (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const proxyUrl = serverEnv.AWARDWALLET_PROXY_URL;
    if (!proxyUrl) {
      return NextResponse.json(
        { error: 'AWARDWALLET_PROXY_URL is not configured.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const dispatcher = new ProxyAgent(proxyUrl);
    const response = await fetch(
      'https://api.ipify.org?format=json',
      { method: 'GET', dispatcher } satisfies FetchInit,
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to reach IP check service.', details: errorText },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const data = (await response.json()) as { ip?: string };

    return NextResponse.json(
      {
        ip: data.ip ?? null,
        proxyConfigured: true,
        checkedAt: new Date().toISOString(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[AwardWallet] Proxy debug error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
