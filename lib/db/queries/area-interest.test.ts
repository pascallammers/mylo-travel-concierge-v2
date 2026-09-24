import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { areaInterest, user } from '../schema';
import { PREVIEW_AREA_SLUGS } from '../../shell/preview-areas';

const statements: { sql: string; params: unknown[] }[] = [];
let result: unknown[][] = [];
const db = drizzle(async (sql, params) => {
  statements.push({ sql, params });
  return { rows: result };
});

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../index.ts', import.meta.url).href, { namedExports: { db, dbUncached: db } });
const { registerAreaInterest, hasAreaInterest, countAreaInterestByArea } = createRequire(import.meta.url)('./area-interest.ts') as typeof import('./area-interest');

beforeEach(() => {
  statements.length = 0;
  result = [];
});

test('the table enforces one entry per user and area and cascades user deletion', () => {
  const config = getTableConfig(areaInterest);
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['user_id', 'area_slug']);
  assert.deepEqual(areaInterest.areaSlug.enumValues, PREVIEW_AREA_SLUGS);
  assert.equal(config.foreignKeys[0].onDelete, 'cascade');
  assert.deepEqual(config.foreignKeys[0].reference().foreignColumns, [user.id]);
  assert.ok(areaInterest.userId.notNull && areaInterest.areaSlug.notNull && areaInterest.createdAt.notNull);
  assert.ok(areaInterest.createdAt.hasDefault);
});

test('repeated registration uses conflict-safe inserts with the same user and area', async () => {
  await registerAreaInterest('member', 'alerts');
  await registerAreaInterest('member', 'alerts');
  assert.equal(statements.length, 2);
  for (const query of statements) {
    assert.match(query.sql, /insert into "area_interest"/);
    assert.match(query.sql, /on conflict do nothing/);
    assert.deepEqual(query.params, ['member', 'alerts']);
  }
});

test('interest lookup scopes by both user and area and detects existing entries', async () => {
  result = [['member']];
  assert.equal(await hasAreaInterest('member', 'cards'), true);
  assert.match(statements[0].sql, /"area_interest"\."user_id" = \$1 and "area_interest"\."area_slug" = \$2/);
  assert.match(statements[0].sql, /limit \$3/);
  assert.deepEqual(statements[0].params, ['member', 'cards', 1]);
});

test('interest lookup returns false for a missing entry', async () => {
  assert.equal(await hasAreaInterest('member', 'alerts'), false);
});

test('count query groups by area and maps database counts to numbers', async () => {
  result = [['cards', '7']];
  assert.deepEqual(await countAreaInterestByArea(), { alerts: 0, cards: 7 });
  assert.match(statements[0].sql, /count\(\*\)/);
  assert.match(statements[0].sql, /group by "area_interest"\."area_slug"/);
  assert.deepEqual(statements[0].params, []);
});

test('count query returns both areas for an empty table', async () => {
  assert.deepEqual(await countAreaInterestByArea(), { alerts: 0, cards: 0 });
});
