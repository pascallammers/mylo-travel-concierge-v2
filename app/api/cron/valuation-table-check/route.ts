import { serverEnv } from '@/env/server';
import { sendValuationTableAdminAlert } from '@/lib/admin-alerts';
import { runValuationTableCheck } from '@/lib/valuation/check';
import { handleValuationCron } from '@/lib/valuation/http';
import { getValuationRepository } from '@/lib/valuation/runtime';

/**
 * Enforce the monthly manual valuation review deadlines.
 * @param request - GET request bearing CRON_SECRET.
 * @returns Overdue count and source month, or a German failure response.
 */
export async function GET(request: Request) {
  return handleValuationCron(request, serverEnv.CRON_SECRET, () =>
    runValuationTableCheck({
      repository: getValuationRepository(),
      sendMail: sendValuationTableAdminAlert,
      now: () => new Date(),
    }),
  );
}

export const maxDuration = 60;
