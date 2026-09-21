import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { transferRates, transferTableChecks } from './schema';

test('history schema has a partial current-row uniqueness constraint and check foreign key', () => {
  const rates = getTableConfig(transferRates);
  assert.equal(rates.indexes[0].config.unique, true);
  assert.ok(rates.indexes[0].config.where);
  assert.deepEqual(
    rates.indexes[0].config.columns.map((column) => ('name' in column ? column.name : null)),
    ['source_program_id', 'partner_key'],
  );
  assert.equal(rates.foreignKeys.length, 1);
  assert.equal(transferRates.validFrom.withTimezone, true);
  assert.equal(transferRates.validTo.withTimezone, true);
  assert.equal(transferTableChecks.checkedAt.withTimezone, true);
});

test('migration 0023, snapshot and journal stay in sync without running SQL', () => {
  const migration = readFileSync(new URL('../../drizzle/migrations/0023_transfer_table.sql', import.meta.url), 'utf8');
  const snapshot = JSON.parse(
    readFileSync(new URL('../../drizzle/migrations/meta/0023_snapshot.json', import.meta.url), 'utf8'),
  );
  const journal = JSON.parse(
    readFileSync(new URL('../../drizzle/migrations/meta/_journal.json', import.meta.url), 'utf8'),
  );
  assert.equal(journal.entries.at(-1).tag, '0023_transfer_table');
  for (const table of ['transfer_rates', 'transfer_table_checks']) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
    assert.ok(snapshot.tables[`public.${table}`]);
  }
  assert.equal(
    snapshot.tables['public.transfer_rates'].indexes.transfer_rates_current_unique.where,
    '"transfer_rates"."valid_to" IS NULL',
  );
  assert.equal(getTableConfig(transferTableChecks).columns.length, 9);
});
