// lib/tools/cpp-calculator.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { cppCalculatorTool } from './cpp-calculator';

// Light helper: parse input via the tool's zod schema (live AI SDK does this
// before invoking execute), then call execute. ToolCallOptions is irrelevant
// for behavior tests.
async function run(rawInput: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions / schema typing is irrelevant for behavior tests
  const parsed = (cppCalculatorTool.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions is irrelevant for behavior tests
  return await (cppCalculatorTool.execute as any)(parsed, {});
}

describe('cppCalculatorTool', () => {
  it('declares description and zod input schema', () => {
    assert.ok(cppCalculatorTool.description);
    assert.ok(cppCalculatorTool.inputSchema);
  });

  it('returns success result for valid USD input', async () => {
    const r = await run({
      programId: 'amex_membership_rewards',
      pointsRequired: 50_000,
      cashEquivalent: 1000,
      currency: 'USD',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.strictEqual(r.cpp, 2.0);
      assert.strictEqual(r.tier, 'good');
      assert.strictEqual(r.inputCurrency, 'USD');
      assert.strictEqual(r.programName, 'American Express Membership Rewards');
    }
  });

  it('defaults currency to EUR when not provided (DACH user)', async () => {
    const r = await run({
      programId: 'amex_membership_rewards',
      pointsRequired: 50_000,
      cashEquivalent: 1000,
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.strictEqual(r.inputCurrency, 'EUR');
    }
  });

  it('applies M&M Star Alliance partner override for lufthansa', async () => {
    const r = await run({
      programId: 'lufthansa',
      pointsRequired: 50_000,
      cashEquivalent: 1000,
      currency: 'USD',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.strictEqual(r.source, 'mm-override');
      assert.strictEqual(r.threshold.ceiling, 1.8);
    }
  });

  it('returns error result (not thrown) for unknown programId', async () => {
    const r = await run({
      programId: 'definitely_not_a_real_program',
      pointsRequired: 50_000,
      cashEquivalent: 1000,
      currency: 'USD',
    });
    assert.strictEqual(r.success, false);
    if (!r.success) {
      assert.match(r.error, /Unknown programId/i);
    }
  });

  it('schema rejects non-positive pointsRequired before execute runs', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing is irrelevant
    const parse = (cppCalculatorTool.inputSchema as any).safeParse({
      programId: 'amex_membership_rewards',
      pointsRequired: 0,
      cashEquivalent: 1000,
      currency: 'USD',
    });
    assert.strictEqual(parse.success, false);
  });

  it('schema rejects non-positive cashEquivalent before execute runs', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing is irrelevant
    const parse = (cppCalculatorTool.inputSchema as any).safeParse({
      programId: 'amex_membership_rewards',
      pointsRequired: 50_000,
      cashEquivalent: -5,
      currency: 'USD',
    });
    assert.strictEqual(parse.success, false);
  });

  it('produces a human-readable summary on success', async () => {
    const r = await run({
      programId: 'amex_membership_rewards',
      pointsRequired: 50_000,
      cashEquivalent: 1100,
      currency: 'USD',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.summary);
      assert.match(r.summary, /excellent|good|fair|poor/i);
      assert.match(r.summary, /2\.2/); // cpp value visible
    }
  });
});
