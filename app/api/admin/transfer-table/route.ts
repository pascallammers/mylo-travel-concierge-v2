import { getUser, isCurrentUserAdmin } from '@/lib/auth-utils';
import { resolveHeldCheck, TRANSFER_SEEDS } from '@/lib/transfer-table';
import { handleTransferAdminGet, handleTransferAdminPost, type AdminDependencies } from '@/lib/transfer-table/http';
import { getTransferRepository } from '@/lib/transfer-table/runtime';

const dependencies: AdminDependencies = {
  isAdmin: isCurrentUserAdmin,
  getUserId: async () => (await getUser())?.id ?? null,
  loadDashboard: () => getTransferRepository().loadDashboard(),
  resolve: (checkId, resolution, userId) =>
    resolveHeldCheck(checkId, resolution, userId, {
      repository: getTransferRepository(),
      seeds: TRANSFER_SEEDS,
      now: () => new Date(),
    }),
};

/**
 * Load transfer-table status using the existing admin authorization.
 * @returns German JSON status or authorization failure.
 */
export async function GET() {
  return handleTransferAdminGet(dependencies);
}

/**
 * Approve or reject an open held source check.
 * @param request - Validated decision request.
 * @returns Confirmation or a clear conflict response.
 */
export async function POST(request: Request) {
  return handleTransferAdminPost(request, dependencies);
}
