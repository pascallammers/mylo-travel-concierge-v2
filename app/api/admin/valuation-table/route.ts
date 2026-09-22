import { getUser, isCurrentUserAdmin } from '@/lib/auth-utils';
import { handleValuationAdminGet, handleValuationAdminPost, type AdminDependencies } from '@/lib/valuation/admin';
import { getValuationRepository, resetValuationTableCache } from '@/lib/valuation/runtime';

const dependencies: AdminDependencies = {
  isAdmin: isCurrentUserAdmin,
  getUserId: async () => (await getUser())?.id ?? null,
  repository: {
    ensureSeeded: (now) => getValuationRepository().ensureSeeded(now),
    loadCurrentRows: () => getValuationRepository().loadCurrentRows(),
    replaceRate: (rate, now, options) => getValuationRepository().replaceRate(rate, now, options),
  },
  resetCache: resetValuationTableCache,
  now: () => new Date(),
};

/**
 * Read the current valuation dashboard using existing administrator authorization.
 * @returns German status JSON or an authorization/server failure.
 */
export async function GET() {
  return handleValuationAdminGet(dependencies);
}

/**
 * Record a new valuation version from an authenticated administrator.
 * @param request - New value and optional deviation confirmation.
 * @returns The saved version or German validation/conflict feedback.
 */
export async function POST(request: Request) {
  return handleValuationAdminPost(request, dependencies);
}
