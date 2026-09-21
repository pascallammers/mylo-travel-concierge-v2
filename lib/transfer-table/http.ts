import { z } from 'zod';
import { TransferConflictError } from './apply';
import { findSeedKey, TRANSFER_SEEDS } from './seeds';
import type { CheckSummary, Resolution, TransferRepository } from './types';

const resolutionInput = z.object({ checkId: z.string().uuid(), resolution: z.enum(['approved', 'rejected']) }).strict();

export interface AdminDependencies {
  isAdmin: () => Promise<boolean>;
  getUserId: () => Promise<string | null>;
  loadDashboard: TransferRepository['loadDashboard'];
  resolve: (checkId: string, resolution: Resolution, adminUserId: string) => Promise<void>;
}

/**
 * Authorize monthly cron invocations before invoking any dependencies.
 * @param request - Incoming request.
 * @param secret - Configured CRON_SECRET.
 * @param run - Injected check runner.
 * @returns Per-source JSON summary or an authorization/server error.
 */
export async function handleTransferCron(
  request: Request,
  secret: string | undefined,
  run: () => Promise<CheckSummary[]>,
): Promise<Response> {
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  try {
    const sources = await run();
    return Response.json({ sources }, { status: sources.some((source) => source.mailError) ? 502 : 200 });
  } catch {
    return Response.json({ error: 'Die Transfertabelle konnte nicht geprüft werden.' }, { status: 500 });
  }
}

/**
 * Read the compact administrator status, including metadata readiness.
 * @param deps - Authentication and persistence dependencies.
 * @returns Latest source checks and every unresolved held check.
 */
export async function handleTransferAdminGet(deps: AdminDependencies): Promise<Response> {
  try {
    if (!(await deps.isAdmin())) return Response.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    const dashboard = await deps.loadDashboard();
    const held = dashboard.held.map((check) => ({
      ...check,
      canApprove: check.changes.every(
        (change) =>
          change.type !== 'partner_added' ||
          Boolean(findSeedKey(change.observation, TRANSFER_SEEDS[check.sourceProgramId])),
      ),
    }));
    return Response.json({ ...dashboard, held });
  } catch {
    return Response.json({ error: 'Die Transfertabelle konnte nicht geladen werden.' }, { status: 500 });
  }
}

/**
 * Validate an authenticated administrator's resolution without accepting a forged user ID.
 * @param request - JSON request containing checkId and resolution.
 * @param deps - Authentication and resolution dependencies.
 * @returns Success, validation failure, or an explicit stale-check conflict.
 */
export async function handleTransferAdminPost(request: Request, deps: AdminDependencies): Promise<Response> {
  try {
    if (!(await deps.isAdmin())) return Response.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    const userId = await deps.getUserId();
    if (!userId) return Response.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    const input = resolutionInput.safeParse(await request.json().catch(() => null));
    if (!input.success) return Response.json({ error: 'Ungültige Prüfung oder Entscheidung.' }, { status: 400 });
    await deps.resolve(input.data.checkId, input.data.resolution, userId);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof TransferConflictError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: 'Die Entscheidung konnte nicht gespeichert werden.' }, { status: 500 });
  }
}
