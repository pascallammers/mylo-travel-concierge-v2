import type { ScanResult } from './deal-scanner';

export interface DealScanCronDependencies {
  cronSecret: string;
  runDealScan: () => Promise<ScanResult>;
}

/**
 * Check whether an incoming cron request carries the expected bearer token.
 *
 * @param headers - Request headers from the cron invocation.
 * @param cronSecret - Secret configured for scheduled invocations.
 * @returns True when the request is allowed to run the scanner.
 */
export function isAuthorizedCronRequest(headers: Headers, cronSecret: string): boolean {
  return headers.get('authorization') === `Bearer ${cronSecret}`;
}

/**
 * Run the deal scan for an authenticated cron request.
 *
 * @param request - Incoming cron request.
 * @param deps - Runtime dependencies for auth and scanning.
 * @returns JSON response with scan summary or an error status.
 */
export async function handleDealScanCronRequest(
  request: Request,
  deps: DealScanCronDependencies,
): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.cronSecret)) {
    console.error('[DealScan Cron] Unauthorized request');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[DealScan Cron] Starting scheduled scan...');

  try {
    const result = await deps.runDealScan();

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[DealScan Cron] Scan failed:', error);
    return Response.json(
      { error: 'Scan failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
