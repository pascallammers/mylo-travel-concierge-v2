import { serverEnv } from '@/env/server';
import { handleDealScanCronRequest } from '@/lib/services/deal-scan-cron-handler';
import { runDealScan } from '@/lib/services/deal-scanner';

/**
 * Handle Vercel Cron invocations.
 *
 * @param request - Vercel Cron request with the CRON_SECRET authorization header.
 * @returns JSON scan summary.
 */
export async function GET(request: Request): Promise<Response> {
  return handleDealScanCronRequest(request, {
    cronSecret: serverEnv.CRON_SECRET,
    runDealScan,
  });
}

/**
 * Handle manual cron invocations for local debugging and admin tooling.
 *
 * @param request - Manual request with the CRON_SECRET authorization header.
 * @returns JSON scan summary.
 */
export async function POST(request: Request): Promise<Response> {
  return handleDealScanCronRequest(request, {
    cronSecret: serverEnv.CRON_SECRET,
    runDealScan,
  });
}

export const maxDuration = 300;
