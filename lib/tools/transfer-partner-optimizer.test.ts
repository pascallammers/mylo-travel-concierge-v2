// lib/tools/transfer-partner-optimizer.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { transferPartnerOptimizerTool } from './transfer-partner-optimizer';

async function run(rawInput: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant for behavior tests
  const parsed = (transferPartnerOptimizerTool.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions irrelevant
  return await (transferPartnerOptimizerTool.execute as any)(parsed, {});
}

describe('transferPartnerOptimizerTool — listing', () => {
  it('declares description and zod input schema', () => {
    assert.ok(transferPartnerOptimizerTool.description);
    assert.ok(transferPartnerOptimizerTool.inputSchema);
  });

  it('returns top airline partners for amex_dach without filter', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.partners.length > 0);
      assert.ok(r.partners.length <= 5); // default limit
      // Each entry has ratio + milesOut
      const first = r.partners[0];
      assert.ok(typeof first.partnerName === 'string');
      assert.ok(typeof first.milesOut === 'number');
      assert.ok(first.milesOut > 0);
      assert.match(first.ratio, /\d+:\d+/);
    }
  });

  it('sorts results by milesOut descending (best deal first)', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      for (let i = 1; i < r.partners.length; i++) {
        assert.ok(r.partners[i - 1].milesOut >= r.partners[i].milesOut);
      }
    }
  });

  it('respects custom limit', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
      limit: 3,
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.partners.length <= 3);
    }
  });

  it('supports all 6 source programs', async () => {
    const programs = ['amex_dach', 'amex_us', 'chase_ur', 'bilt', 'capital_one', 'citi_ty'] as const;
    for (const sp of programs) {
      const r = await run({ sourceProgram: sp, sourcePoints: 50_000 });
      assert.strictEqual(r.success, true, `${sp} should return success`);
      if (r.success) {
        assert.ok(r.partners.length > 0, `${sp} should have at least one partner`);
      }
    }
  });
});

describe('transferPartnerOptimizerTool — targeted lookup', () => {
  it('filters by targetAirline keyword (substring match on brand/name)', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
      targetAirline: 'Singapore',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.partners.length > 0);
      assert.match(r.partners[0].partnerName + r.partners[0].brand, /singapore/i);
    }
  });

  it('matches partner names case-insensitively', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
      targetAirline: 'BRITISH airways',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.partners.some((p: any) => /british/i.test(p.brand) || /british/i.test(p.partnerName)));
    }
  });

  it('returns empty partners array (success=true) when targetAirline matches nothing', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
      targetAirline: 'definitely-not-a-real-airline-zzz',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.strictEqual(r.partners.length, 0);
    }
  });
});

describe('transferPartnerOptimizerTool — output shape', () => {
  it('includes alliance and transferDuration in each entry', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
      limit: 1,
    });
    assert.strictEqual(r.success, true);
    if (r.success && r.partners.length > 0) {
      const p = r.partners[0];
      assert.ok('alliance' in p); // can be null
      assert.ok(typeof p.transferDuration === 'string');
      assert.ok(typeof p.minTransfer === 'number');
    }
  });

  it('respects de locale for transferDuration when locale=de', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
      limit: 1,
      locale: 'de',
    });
    assert.strictEqual(r.success, true);
    if (r.success && r.partners.length > 0) {
      // German durations contain words like "Stunden", "Tage", "Sofort", "Minuten" etc.
      // We just assert the field is non-empty.
      assert.ok(r.partners[0].transferDuration.length > 0);
    }
  });

  it('floors milesOut (no fractional miles)', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 12_345,
      limit: 1,
    });
    assert.strictEqual(r.success, true);
    if (r.success && r.partners.length > 0) {
      assert.strictEqual(r.partners[0].milesOut, Math.floor(r.partners[0].milesOut));
    }
  });

  it('schema rejects non-positive sourcePoints', () => {
    // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
    const parse = (transferPartnerOptimizerTool.inputSchema as any).safeParse({
      sourceProgram: 'amex_dach',
      sourcePoints: 0,
    });
    assert.strictEqual(parse.success, false);
  });
});
