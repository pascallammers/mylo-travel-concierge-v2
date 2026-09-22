import { z } from 'zod';
import { getLoyaltyProgram, LOYALTY_PROGRAMS } from '../loyalty/programs';
import { defaultReviewDue, parseCalendarDate, parseSourceMonth } from './dates';
import { ValuationDeviationError } from './deviation';
import { buildValuationTable } from './table';
import { CABINS, type Anchor, type RateVersion, type ValuationRepository } from './types';

const ANCHOR_ORDER: Record<Anchor, number> = { travel: 0, no_plan: 1 };

const rateInput = z
  .object({
    programId: z.string().trim().min(1).max(100),
    anchor: z.enum(['travel', 'no_plan']),
    cabin: z.enum(CABINS).default('all'),
    centsPerUnit: z
      .number()
      .finite()
      .min(0.001)
      .max(999.999)
      .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7),
    source: z.string().trim().min(1).max(200),
    sourceUrl: z
      .string()
      .url()
      .max(2000)
      .refine((value) => /^https?:\/\//i.test(value))
      .optional(),
    sourceAsOf: z.string().refine((value) => Boolean(parseSourceMonth(value))),
    reviewDue: z
      .string()
      .refine((value) => Boolean(parseCalendarDate(value)))
      .optional(),
    note: z.string().trim().max(2000).optional(),
    confirmDeviation: z.boolean().optional(),
  })
  .strict();

export interface AdminDependencies {
  isAdmin: () => Promise<boolean>;
  getUserId: () => Promise<string | null>;
  repository: Pick<ValuationRepository, 'ensureSeeded' | 'loadCurrentRows' | 'replaceRate'>;
  resetCache: () => void;
  now: () => Date;
}

type AdminRate = Omit<RateVersion, 'id' | 'validTo' | 'createdBy' | 'sourceAsOf' | 'reviewDue' | 'validFrom'> & {
  sourceAsOf: string;
  reviewDue: string;
  validFrom: string;
  stale: boolean;
  programName: string;
};

export interface ValuationAdminData {
  tableAsOf: string;
  rates: AdminRate[];
  programs: { id: string; name: string }[];
}

/**
 * Load persisted dashboard rates, seeding before the first authorized read.
 * @param deps - Administrator authorization, persistence, cache invalidation and clock.
 * @returns JSON rates sorted by programme name, anchor and cabin, plus the full registry.
 */
export async function handleValuationAdminGet(deps: AdminDependencies): Promise<Response> {
  try {
    if (!(await deps.isAdmin())) return Response.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    const now = deps.now();
    await deps.repository.ensureSeeded(now);
    const rows = await deps.repository.loadCurrentRows();
    const table = buildValuationTable(rows, now);
    const rates: AdminRate[] = rows
      .filter((row) => row.validTo === null)
      .map((row) => ({
        programId: row.programId,
        anchor: row.anchor,
        cabin: row.cabin,
        centsPerUnit: row.centsPerUnit,
        source: row.source,
        sourceUrl: row.sourceUrl,
        sourceAsOf: row.sourceAsOf.toISOString(),
        reviewDue: row.reviewDue.toISOString(),
        note: row.note,
        validFrom: row.validFrom.toISOString(),
        origin: row.origin,
        stale: row.reviewDue.getTime() < now.getTime(),
        programName: getLoyaltyProgram(row.programId)?.name ?? row.programId,
      }))
      .sort(
        (a, b) =>
          a.programName.localeCompare(b.programName, 'de') ||
          ANCHOR_ORDER[a.anchor] - ANCHOR_ORDER[b.anchor] ||
          a.cabin.localeCompare(b.cabin),
      );
    const programs = LOYALTY_PROGRAMS.map(({ id, name }) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'de'),
    );
    return Response.json({ tableAsOf: table.tableAsOf, rates, programs } satisfies ValuationAdminData);
  } catch {
    return Response.json({ error: 'Die Bewertungstabelle konnte nicht geladen werden.' }, { status: 500 });
  }
}

/**
 * Validate a manual valuation and use the transactional write-path deviation gate.
 * @param request - JSON containing a new value, never the actor's identity.
 * @param deps - Administrator authorization, repository, cache invalidation and clock.
 * @returns New version, German validation/conflict message, or a sanitized server error.
 */
export async function handleValuationAdminPost(request: Request, deps: AdminDependencies): Promise<Response> {
  try {
    if (!(await deps.isAdmin())) return Response.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    const userId = await deps.getUserId();
    if (!userId) return Response.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    const input = rateInput.safeParse(await request.json().catch(() => null));
    if (!input.success)
      return Response.json(
        {
          error:
            'Ungültiger Bewertungssatz. Bitte Programm, Wert (bis zu drei Nachkommastellen), Quelle und Datumsangaben prüfen.',
        },
        { status: 400 },
      );
    const data = input.data;
    if (!getLoyaltyProgram(data.programId))
      return Response.json({ error: `Unbekanntes Programm: ${data.programId}` }, { status: 400 });
    if (data.anchor === 'no_plan' && data.cabin !== 'all')
      return Response.json({ error: 'Ein Wert ohne Plan gilt für alle Klassen.' }, { status: 400 });
    const sourceAsOf = parseSourceMonth(data.sourceAsOf)!;
    const reviewDue = data.reviewDue ? parseCalendarDate(data.reviewDue)! : defaultReviewDue(sourceAsOf);
    if (reviewDue.getTime() <= sourceAsOf.getTime())
      return Response.json({ error: 'Das Fälligkeitsdatum muss nach dem Stand liegen.' }, { status: 400 });
    const result = await deps.repository.replaceRate(
      {
        programId: data.programId,
        anchor: data.anchor,
        cabin: data.cabin,
        centsPerUnit: data.centsPerUnit,
        source: data.source,
        sourceUrl: data.sourceUrl ?? null,
        sourceAsOf,
        reviewDue,
        note: data.note ?? null,
        createdBy: userId,
      },
      deps.now(),
      { confirmDeviation: data.confirmDeviation },
    );
    deps.resetCache();
    return Response.json(result);
  } catch (error) {
    if (error instanceof ValuationDeviationError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: 'Der Bewertungssatz konnte nicht gespeichert werden.' }, { status: 500 });
  }
}
