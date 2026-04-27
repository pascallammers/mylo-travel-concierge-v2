// lib/chat/__evals__/extract-real-chats.ts
//
// One-off interactive script: pulls recent user-query → first-tool-call pairs
// from production Neon and writes anonymized fixtures.
//
// Production stores tool calls in `message.parts` JSON with type 'tool-<name>'
// (AI SDK 5.x convention), NOT in the separate `tool_calls` table (which is
// empty in production at the time of this writing). The query joins each
// assistant message that has at least one tool-* part with the latest user
// message in the same chat that came before it (within 5 minutes).

import { dbUncached } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFile } from 'node:fs/promises';
import { anonymizeUserQuery, scanForPii } from './anonymize';
import { WEB_GROUP_TOOL_NAMES } from './mock-tools';

const LOOKBACK_DAYS = 14;
const CANDIDATE_LIMIT = 30;
const TARGET_COUNT = 5;
const ALLOWED_TOOL_TYPES = WEB_GROUP_TOOL_NAMES.map((n) => `tool-${n}`);

type Candidate = {
  idx: number;
  chatId: string;
  userId: string;
  userName: string | null;
  userQuery: string;
  toolName: string;
  createdAt: Date;
};

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  for (const p of parts) {
    if (
      p &&
      typeof p === 'object' &&
      'type' in p &&
      (p as { type: string }).type === 'text' &&
      'text' in p
    ) {
      return String((p as { text: unknown }).text ?? '');
    }
  }
  return '';
}

async function fetchCandidates(): Promise<Candidate[]> {
  // Find each assistant message's FIRST tool-* part (in array order),
  // then join with the latest user message in the same chat within 5 min before.
  const rows = await dbUncached.execute(sql`
    WITH assistant_first_tool AS (
      SELECT DISTINCT ON (m.id)
        m.id as a_id,
        m.chat_id,
        m.created_at as a_created_at,
        elem.value->>'type' as part_type
      FROM message m
      CROSS JOIN LATERAL jsonb_array_elements(m.parts::jsonb) WITH ORDINALITY AS elem(value, ordinality)
      WHERE m.role = 'assistant'
        AND m.created_at > now() - interval '${sql.raw(String(LOOKBACK_DAYS))} days'
        AND elem.value->>'type' IN (${sql.join(ALLOWED_TOOL_TYPES.map((t) => sql`${t}`), sql`, `)})
      ORDER BY m.id, elem.ordinality
    ),
    triggering_user_msg AS (
      SELECT DISTINCT ON (a.a_id)
        a.a_id,
        a.chat_id,
        a.a_created_at,
        a.part_type,
        u.id as user_id,
        u.parts as user_parts,
        u.created_at as user_created_at
      FROM assistant_first_tool a
      JOIN message u ON u.chat_id = a.chat_id
        AND u.role = 'user'
        AND u.created_at < a.a_created_at
        AND u.created_at > a.a_created_at - interval '5 minutes'
      ORDER BY a.a_id, u.created_at DESC
    )
    SELECT
      t.user_id,
      t.chat_id,
      t.a_created_at,
      t.part_type,
      t.user_parts,
      c."userId" as chat_user_id,
      u.name as user_name
    FROM triggering_user_msg t
    JOIN chat c ON c.id = t.chat_id
    LEFT JOIN "user" u ON u.id = c."userId"
    ORDER BY t.a_created_at DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);

  // Drizzle's `.execute()` over Neon HTTP returns FullQueryResults — extract `.rows`.
  // biome-ignore lint/suspicious/noExplicitAny: drizzle execute() row shape varies by adapter
  const data = (rows as any).rows ?? [];

  return data.map((r: Record<string, unknown>, idx: number) => ({
    idx: idx + 1,
    chatId: String(r.chat_id ?? ''),
    userId: String(r.chat_user_id ?? ''),
    userName: (r.user_name as string | null) ?? null,
    userQuery: extractTextFromParts(r.user_parts),
    toolName: String(r.part_type ?? '').replace(/^tool-/, ''),
    createdAt: new Date(r.a_created_at as string),
  }));
}

function printCandidates(cands: Candidate[]): void {
  console.log('idx | tool                  | userQuery (truncated)');
  console.log('----+----------------------+------------------------------------------------');
  for (const c of cands) {
    const q = c.userQuery.replace(/\s+/g, ' ').slice(0, 60).padEnd(60);
    console.log(`${String(c.idx).padStart(3)} | ${c.toolName.padEnd(20)} | ${q}`);
  }
}

async function promptSelection(maxCandidates: number): Promise<number[]> {
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = await rl.question(
    `\nSelect ${TARGET_COUNT} indices (comma-separated, e.g. 1,4,7,12,19): `,
  );
  rl.close();
  const ids = ans
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (ids.length !== TARGET_COUNT) {
    throw new Error(`Expected ${TARGET_COUNT} indices, got ${ids.length}`);
  }
  if (new Set(ids).size !== TARGET_COUNT) {
    throw new Error(`Indices must be unique. Got duplicates in: ${ids.join(',')}`);
  }
  for (const id of ids) {
    if (id < 1 || id > maxCandidates) {
      throw new Error(`Index ${id} out of range. Must be 1..${maxCandidates}.`);
    }
  }
  return ids;
}

function fixtureFromCandidate(c: Candidate & { anon: string }, n: number): string {
  const id = `real-${String(n).padStart(3, '0')}-${c.toolName.replace(/_/g, '-')}`;
  return `  {
    id: '${id}',
    source: 'real',
    description: 'Extracted from production chat ${c.chatId.slice(0, 8)} on ${c.createdAt.toISOString().slice(0, 10)}',
    userQuery: ${JSON.stringify(c.anon)},
    expectedTool: '${c.toolName}',
    reason: 'Production: this user query routed to ${c.toolName} successfully. Eval captures that behavior as the regression baseline.',
  },`;
}

async function main(): Promise<void> {
  console.log(`Fetching candidates from production Neon (last ${LOOKBACK_DAYS} days)...`);
  const cands = await fetchCandidates();
  if (cands.length < TARGET_COUNT) {
    throw new Error(`Only ${cands.length} candidates found, need ${TARGET_COUNT}`);
  }
  printCandidates(cands);
  const selectedIdx = await promptSelection(cands.length);
  const selected = cands
    .filter((c) => selectedIdx.includes(c.idx))
    .map((c) => ({
      ...c,
      anon: anonymizeUserQuery(c.userQuery, { userName: c.userName ?? undefined }),
    }));

  // PII safety check — runs against the EXACT string that will be written to disk
  for (const c of selected) {
    const issues = scanForPii(c.anon);
    if (issues.length > 0) {
      console.error(`PII WARNING for chat ${c.chatId}: ${issues.join(', ')}`);
      console.error(`  Anonymized text: ${c.anon}`);
      console.error('Aborting. Review and improve anonymize.ts before re-running.');
      process.exit(3);
    }
  }

  // Build fixture file (only after PII scan passes)
  const entries = selected.map((c, i) => fixtureFromCandidate(c, i + 1)).join('\n');
  const file =
    `// lib/chat/__evals__/fixtures/real-chats.ts\n` +
    `// Generated by extract-real-chats.ts on ${new Date().toISOString()}\n` +
    `// Anonymized — please review before committing.\n` +
    `import type { EvalFixture } from './types';\n\n` +
    `export const realChats: EvalFixture[] = [\n${entries}\n];\n`;

  await writeFile('lib/chat/__evals__/fixtures/real-chats.ts', file, 'utf8');
  console.log(`\nWrote ${selected.length} fixtures to lib/chat/__evals__/fixtures/real-chats.ts`);
  console.log('REVIEW THE FILE before committing.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
