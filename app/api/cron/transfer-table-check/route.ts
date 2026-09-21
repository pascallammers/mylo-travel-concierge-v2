import { serverEnv } from '@/env/server';
import { sendTransferTableAdminAlert } from '@/lib/email';
import { createFetchHtml, runTransferTableCheck, TRANSFER_SEEDS } from '@/lib/transfer-table';
import { handleTransferCron } from '@/lib/transfer-table/http';
import { getTransferRepository } from '@/lib/transfer-table/runtime';

/**
 * Check the DACH sources on the monthly Vercel schedule.
 * @param request - GET request bearing CRON_SECRET.
 * @returns Check summaries for Amex and PAYBACK.
 */
export async function GET(request: Request) {
  return handleTransferCron(request, serverEnv.CRON_SECRET, () =>
    runTransferTableCheck({
      repository: getTransferRepository(),
      seeds: TRANSFER_SEEDS,
      fetchHtml: createFetchHtml(fetch),
      sendMail: sendTransferTableAdminAlert,
      now: () => new Date(),
    }),
  );
}

export const maxDuration = 120;
