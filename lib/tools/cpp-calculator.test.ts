import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createCppCalculatorTool, cppCalculatorTool } from './cpp-calculator';
import type { RedemptionInput } from '../services/cpp-calculator';
import { buildValuationTable } from '../valuation/table';
import { seedRows } from '../valuation/seeds';
import { createHarness } from '../valuation/test-support';
import { loadValuationTable } from '../valuation/reader';

const table = buildValuationTable(seedRows(), new Date('2026-09-22'));
const input = { programId: 'lufthansa', cabin: 'business', pointsRequired: 100_000, cashEur: 2400 };
async function run(calculator: ReturnType<typeof createCppCalculatorTool>, raw: unknown = input) {
  const schema = calculator.inputSchema as z.ZodType<RedemptionInput>;
  const result = await calculator.execute!(schema.parse(raw), { toolCallId: 'test', messages: [] });
  assert.ok('success' in result);
  return result;
}

test('production export is available and schema documents every seed registry ID', () => {
  assert.ok(cppCalculatorTool.execute);
  assert.match(cppCalculatorTool.description!, /EUR cents per point/);
  const schema = cppCalculatorTool.inputSchema;
  assert.ok(schema instanceof z.ZodObject);
  for (const id of table.programIds()) assert.ok(schema.shape.programId.description.includes(`${id} = `));
  assert.ok(schema.shape.programId.description.includes('amex-mr = Amex Membership Rewards'));
  assert.equal(schema.shape.currency, undefined);
  assert.equal(schema.shape.cashEquivalent, undefined);
  assert.ok(!cppCalculatorTool.description?.includes('Borski'));
});

test('factory reads exactly one injected snapshot and returns its German assessment', async () => {
  let reads = 0;
  const calculator = createCppCalculatorTool(async () => {
    reads++;
    return table;
  });
  const result = await run(calculator);
  assert.equal(reads, 1);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.centsPerPoint, 2.4);
    assert.equal(result.travel.centsPerUnit, 1.7);
    assert.equal(result.noPlan?.centsPerUnit, 0.3);
    assert.equal(result.verdict, 'above_travel');
    assert.match(result.summary, /2,4 ct pro Punkt · üblich 1,7 ct/);
  }
});

test('new persisted rates affect the next execution and preserve source/date provenance', async () => {
  const { repository, state } = createHarness();
  await repository.ensureSeeded(state.now);
  const calculator = createCppCalculatorTool(() =>
    loadValuationTable({
      loadCurrentRows: repository.loadCurrentRows,
      now: () => state.now,
      warn: () => assert.fail('unexpected seed'),
    }),
  );
  const first = await run(calculator, { ...input, cabin: 'all', cashEur: 1750 });
  assert.ok(first.success);
  assert.equal(first.verdict, 'above_travel');
  await repository.replaceRate({ ...seedRows()[0], centsPerUnit: 1.8, sourceAsOf: new Date('2026-10-01') }, state.now);
  const next = await run(calculator, { ...input, cabin: 'all', cashEur: 1750 });
  assert.ok(next.success);
  assert.equal(next.verdict, 'below_travel');
  assert.equal(next.travel.centsPerUnit, 1.8);
  assert.match(next.summary, /Stand 10\/2026/);
});

test('unknown programmes and loader failures return German errors without internal details', async () => {
  const unknown = await run(
    createCppCalculatorTool(async () => table),
    { ...input, programId: 'chase-ur' },
  );
  assert.equal(unknown.success, false);
  if (!unknown.success) assert.match(unknown.error, /Chase Ultimate Rewards ist nicht bewertbar/);
  const failure = await run(
    createCppCalculatorTool(async () => {
      throw new Error('secret connection details');
    }),
  );
  assert.deepEqual(failure, { success: false, error: 'Die Einlösung konnte nicht bewertet werden.' });
});

test('tool schema requires positive EUR cash and points, accepts optional cabin, and rejects the old currency path', () => {
  const schema = cppCalculatorTool.inputSchema as z.ZodType<RedemptionInput>;
  for (const data of [
    { ...input, pointsRequired: 0 },
    { ...input, pointsRequired: Number.NaN },
    { ...input, cashEur: -5 },
    { ...input, cashEur: Number.POSITIVE_INFINITY },
    { ...input, cabin: 'invalid' },
    { ...input, currency: 'USD' },
    { programId: 'lufthansa', pointsRequired: 1000, cashEquivalent: 20 },
  ]) {
    const parsed = schema.safeParse(data);
    assert.equal(parsed.success, false);
    if (!parsed.success)
      assert.ok(parsed.error.issues.every((issue) => !/must|expected|required|invalid/i.test(issue.message)));
  }
  assert.equal(schema.safeParse({ programId: 'amex-mr', pointsRequired: 1000, cashEur: 20 }).success, true);
});

test('seed fallback still returns a dated, explicitly stale assessment', async () => {
  const calculator = createCppCalculatorTool(() =>
    loadValuationTable({ loadCurrentRows: async () => [], now: () => new Date('2028-01-01'), warn: () => {} }),
  );
  const result = await run(calculator);
  assert.ok(result.success);
  assert.equal(result.travel.stale, true);
  assert.match(result.summary, /Stand 09\/2026.*Bewertungssatz überfällig/);
});
