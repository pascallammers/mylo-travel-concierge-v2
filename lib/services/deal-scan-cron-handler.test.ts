import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  handleDealScanCronRequest,
  isAuthorizedCronRequest,
} from './deal-scan-cron-handler';
import type { ScanResult } from './deal-scanner';

function createScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    routesScanned: 34,
    dealsFound: 12,
    priceHistoryEntries: 34,
    expiredDealsRemoved: 0,
    errors: [],
    ...overrides,
  };
}

describe('isAuthorizedCronRequest', () => {
  it('allows the bearer token sent by Vercel Cron', () => {
    const headers = new Headers({ authorization: 'Bearer cron-secret' });

    assert.equal(isAuthorizedCronRequest(headers, 'cron-secret'), true);
  });

  it('rejects missing or wrong bearer tokens', () => {
    assert.equal(isAuthorizedCronRequest(new Headers(), 'cron-secret'), false);
    assert.equal(
      isAuthorizedCronRequest(new Headers({ authorization: 'Bearer wrong-secret' }), 'cron-secret'),
      false,
    );
  });
});

describe('handleDealScanCronRequest', () => {
  it('runs the scanner for authorized GET cron requests', async () => {
    const runDealScan = mock.fn(async () => createScanResult());
    const request = new Request('https://example.com/api/cron/scan-deals', {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
    });

    const response = await handleDealScanCronRequest(request, {
      cronSecret: 'cron-secret',
      runDealScan,
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.routesScanned, 34);
    assert.equal(runDealScan.mock.calls.length, 1);
  });

  it('does not run the scanner for unauthorized requests', async () => {
    const runDealScan = mock.fn(async () => createScanResult());
    const request = new Request('https://example.com/api/cron/scan-deals', {
      method: 'GET',
    });

    const response = await handleDealScanCronRequest(request, {
      cronSecret: 'cron-secret',
      runDealScan,
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, 'Unauthorized');
    assert.equal(runDealScan.mock.calls.length, 0);
  });
});
