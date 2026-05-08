/**
 * Unit tests for the AwardWallet API Client.
 *
 * Covers three hardening fixes:
 *  - B1: createAuthUrl() must NOT silently fall back to a direct fetch when
 *        a proxy is configured. AwardWallet enforces an IP allowlist
 *        server-side, so bypassing the proxy would always 403.
 *  - B2: Upstream API failures (401/403/5xx/network) must be reported as
 *        `service_unavailable:api` (renders "upstream service unavailable"),
 *        NOT `bad_request:api` (which renders "check your input").
 *  - B3: The cached ProxyAgent must be keyed by URL. If
 *        AWARDWALLET_PROXY_URL changes (e.g. via Next.js HMR after editing
 *        .env.local) the dispatcher must be rebuilt.
 */

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { serverEnv } from '@/env/server';
import { ChatSDKError } from '@/lib/errors';

import {
  createAuthUrl,
  getConnectionInfo,
  getConnectedUser,
  __resetAwardWalletDispatcherCacheForTests,
  __getAwardWalletDispatcherCacheForTests,
  __getProxyDispatcherForTests,
} from './awardwallet-client';

const ORIGINAL_PROXY_URL = (serverEnv as any).AWARDWALLET_PROXY_URL;

function setProxyUrl(url: string | undefined): void {
  // serverEnv is a Proxy with no set trap, so direct mutation reaches the
  // backing object. This is the only way to simulate an env change at
  // runtime (cf. how Next.js HMR re-imports env/server.ts in dev).
  (serverEnv as any).AWARDWALLET_PROXY_URL = url;
}

describe('AwardWallet Client', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    __resetAwardWalletDispatcherCacheForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setProxyUrl(ORIGINAL_PROXY_URL);
    __resetAwardWalletDispatcherCacheForTests();
  });

  // -----------------------------------------------------------------------
  // B1 — proxy fallback removed
  // -----------------------------------------------------------------------
  describe('B1: createAuthUrl proxy enforcement', () => {
    it('throws service_unavailable:api when proxy fetch fails (no silent fallback)', async () => {
      setProxyUrl('http://test-proxy.local:9293');
      __resetAwardWalletDispatcherCacheForTests();

      let fetchCallCount = 0;
      global.fetch = mock.fn(async () => {
        fetchCallCount += 1;
        throw new Error('ECONNREFUSED proxy down');
      }) as any;

      await assert.rejects(
        async () => {
          await createAuthUrl();
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError, 'expected ChatSDKError');
          assert.strictEqual(err.type, 'service_unavailable');
          assert.strictEqual(err.surface, 'api');
          return true;
        },
      );

      assert.strictEqual(
        fetchCallCount,
        1,
        'createAuthUrl must NOT silently retry without the proxy — exactly one fetch call expected',
      );
    });

    it('rethrows the network error directly when no proxy is configured', async () => {
      setProxyUrl(undefined);
      __resetAwardWalletDispatcherCacheForTests();

      let fetchCallCount = 0;
      global.fetch = mock.fn(async () => {
        fetchCallCount += 1;
        throw new Error('ENOTFOUND awardwallet.com');
      }) as any;

      // With no proxy configured, the original error path is used.
      // The catch-all wraps it as service_unavailable:api now (B2).
      await assert.rejects(
        async () => {
          await createAuthUrl();
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'service_unavailable');
          return true;
        },
      );

      assert.strictEqual(fetchCallCount, 1, 'exactly one direct fetch when no proxy');
    });
  });

  // -----------------------------------------------------------------------
  // B2 — upstream error classification
  // -----------------------------------------------------------------------
  describe('B2: upstream error classification', () => {
    beforeEach(() => {
      // Run B2 tests without a proxy so we go straight to the upstream
      // status-based branches (the IP_DENIED 403 lands here in prod too).
      setProxyUrl(undefined);
      __resetAwardWalletDispatcherCacheForTests();
    });

    it('createAuthUrl: 403 (IP_DENIED) becomes service_unavailable:api', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'IP not on allowlist',
      })) as any;

      await assert.rejects(
        async () => {
          await createAuthUrl();
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'service_unavailable');
          assert.strictEqual(err.statusCode, 503);
          return true;
        },
      );
    });

    it('createAuthUrl: 500 becomes service_unavailable:api', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })) as any;

      await assert.rejects(
        async () => {
          await createAuthUrl();
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'service_unavailable');
          return true;
        },
      );
    });

    it('createAuthUrl: 401 becomes service_unavailable:api', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      })) as any;

      await assert.rejects(
        async () => {
          await createAuthUrl();
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'service_unavailable');
          return true;
        },
      );
    });

    it('getConnectionInfo: empty/missing code stays bad_request:api (genuine user input error)', async () => {
      // Should NOT call fetch at all
      global.fetch = mock.fn(async () => {
        throw new Error('fetch should not be called for empty code');
      }) as any;

      await assert.rejects(
        async () => {
          await getConnectionInfo('');
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'bad_request');
          return true;
        },
      );
    });

    it('getConnectionInfo: 400 from upstream stays bad_request:api (invalid code)', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => 'invalid code',
      })) as any;

      await assert.rejects(
        async () => {
          await getConnectionInfo('some-code');
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'bad_request');
          return true;
        },
      );
    });

    it('getConnectionInfo: 500 becomes service_unavailable:api', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'upstream blew up',
      })) as any;

      await assert.rejects(
        async () => {
          await getConnectionInfo('some-code');
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'service_unavailable');
          return true;
        },
      );
    });

    it('getConnectedUser: 403 becomes service_unavailable:api', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'forbidden',
      })) as any;

      await assert.rejects(
        async () => {
          await getConnectedUser('aw-user-123');
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'service_unavailable');
          return true;
        },
      );
    });

    it('getConnectedUser: BUSINESS_ADMINS_REQUIRE_PLUS becomes forbidden:api', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            error: 'access_denied',
            code: 'BUSINESS_ADMINS_REQUIRE_PLUS',
            message: 'Access denied. All business account admins must have AwardWallet Plus to make this API call',
          }),
      })) as any;

      await assert.rejects(
        async () => {
          await getConnectedUser('aw-user-123');
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'forbidden');
          assert.strictEqual(err.statusCode, 403);
          assert.match(String(err.cause), /AwardWallet Plus/);
          return true;
        },
      );
    });

    it('getConnectedUser: network error becomes service_unavailable:api', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('socket hang up');
      }) as any;

      await assert.rejects(
        async () => {
          await getConnectedUser('aw-user-123');
        },
        (err: unknown) => {
          assert.ok(err instanceof ChatSDKError);
          assert.strictEqual(err.type, 'service_unavailable');
          return true;
        },
      );
    });

    it('service_unavailable:api carries the public-facing upstream message, not "check your input"', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'upstream blew up',
      })) as any;

      try {
        await createAuthUrl();
        assert.fail('expected throw');
      } catch (err) {
        assert.ok(err instanceof ChatSDKError);
        assert.match(
          err.message,
          /upstream service is temporarily unavailable/i,
          'should NOT render the bad_request "check your input" message',
        );
      }
    });
  });

  // -----------------------------------------------------------------------
  // B3 — dispatcher cached by URL
  // -----------------------------------------------------------------------
  describe('B3: dispatcher cache keyed by URL', () => {
    it('returns the same dispatcher across calls when AWARDWALLET_PROXY_URL is unchanged', () => {
      setProxyUrl('http://proxy-a.local:9293');
      __resetAwardWalletDispatcherCacheForTests();

      const first = __getProxyDispatcherForTests();
      const second = __getProxyDispatcherForTests();

      assert.ok(first, 'expected a dispatcher when proxy URL is set');
      assert.strictEqual(first, second, 'same dispatcher instance across repeat calls');

      const cache = __getAwardWalletDispatcherCacheForTests();
      assert.strictEqual(cache?.url, 'http://proxy-a.local:9293');
    });

    it('rebuilds the dispatcher when AWARDWALLET_PROXY_URL changes', () => {
      setProxyUrl('http://proxy-a.local:9293');
      __resetAwardWalletDispatcherCacheForTests();

      const first = __getProxyDispatcherForTests();
      assert.ok(first, 'expected initial dispatcher');

      // Simulate Next.js HMR picking up a new .env.local value
      setProxyUrl('http://proxy-b.local:9293');

      const second = __getProxyDispatcherForTests();
      assert.ok(second, 'expected rebuilt dispatcher');
      assert.notStrictEqual(first, second, 'dispatcher must be rebuilt when proxy URL changes');

      const cache = __getAwardWalletDispatcherCacheForTests();
      assert.strictEqual(cache?.url, 'http://proxy-b.local:9293');
    });

    it('returns undefined and clears the cache when the proxy URL is unset', () => {
      setProxyUrl('http://proxy-a.local:9293');
      __resetAwardWalletDispatcherCacheForTests();

      assert.ok(__getProxyDispatcherForTests(), 'sanity: dispatcher exists');

      setProxyUrl(undefined);
      const after = __getProxyDispatcherForTests();
      assert.strictEqual(after, undefined, 'no dispatcher when env var is unset');
    });
  });
});
