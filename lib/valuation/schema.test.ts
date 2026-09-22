import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { valuationRates } from './schema';

test('valuation schema and generated migration preserve the decided constraints', () => {
  const config = getTableConfig(valuationRates);
  assert.equal(config.columns.length, 14);
  assert.equal(config.foreignKeys.length, 0);
  assert.equal(config.checks.length, 5);
  assert.equal(config.indexes[0].config.unique, true);
  assert.ok(config.indexes[0].config.where);
  assert.deepEqual(
    config.indexes[0].config.columns.map((column) => ('name' in column ? column.name : null)),
    ['program_id', 'anchor', 'cabin'],
  );
  assert.equal(valuationRates.validFrom.withTimezone, true);
  const migration = readFileSync(new URL('../../drizzle/migrations/0024_valuation_table.sql', import.meta.url), 'utf8');
  const snapshot = JSON.parse(
    readFileSync(new URL('../../drizzle/migrations/meta/0024_snapshot.json', import.meta.url), 'utf8'),
  );
  const journal = JSON.parse(
    readFileSync(new URL('../../drizzle/migrations/meta/_journal.json', import.meta.url), 'utf8'),
  );
  assert.ok(journal.entries.some((entry: { tag: string }) => entry.tag === '0024_valuation_table'));
  assert.ok(snapshot.tables['public.valuation_rates']);
  assert.match(migration, /"cents_per_unit" numeric\(6, 3\) NOT NULL/);
  assert.match(migration, /"source_as_of" date NOT NULL/);
  assert.match(migration, /"anchor" = 'travel' OR "valuation_rates"\."cabin" = 'all'/);
  assert.match(migration, /WHERE "valuation_rates"\."valid_to" IS NULL/);
});
