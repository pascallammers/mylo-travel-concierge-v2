import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test, mock } from 'node:test';
import { drizzle } from 'drizzle-orm/pg-proxy';

const statements: { sql: string; params: unknown[] }[] = [];
let result: string[][] = [];
const db = drizzle(async (sql, params) => {
  statements.push({ sql, params });
  return { rows: result };
});

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../index.ts', import.meta.url).href, { namedExports: { db } });
const { getOwnBalanceProgramIds } = createRequire(import.meta.url)('./loyalty-balances.ts') as typeof import('./loyalty-balances');

test('scopes distinct positive-balance programs to the authenticated user via their connection', async () => {
  result = [['lufthansa'], ['united']];
  assert.deepEqual(await getOwnBalanceProgramIds('member-123'), new Set(['lufthansa', 'united']));
  const query = statements.at(-1);
  assert.ok(query);
  assert.match(query.sql, /select distinct "loyalty_accounts"\."program_id"/);
  assert.match(query.sql, /inner join "awardwallet_connections" on "loyalty_accounts"\."connection_id" = "awardwallet_connections"\."id"/);
  assert.match(query.sql, /"awardwallet_connections"\."user_id" = \$1/);
  assert.match(query.sql, /"loyalty_accounts"\."balance" > \$2/);
  assert.deepEqual(query.params, ['member-123', 0]);
});

test('returns an empty set without any linked positive-balance accounts', async () => {
  result = [];
  assert.deepEqual(await getOwnBalanceProgramIds('without-awardwallet'), new Set());
  assert.deepEqual(statements.at(-1)?.params, ['without-awardwallet', 0]);
});
