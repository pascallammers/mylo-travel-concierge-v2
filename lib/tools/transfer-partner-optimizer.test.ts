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

describe('transferPartnerOptimizerTool — minTransfer + transferIncrement', () => {
  it('filters out partners when sourcePoints is below minTransfer (Codex finding #3)', async () => {
    // Flying Blue DACH: minTransfer=625, transferIncrement=5.
    // 500 source points → aligned 500, but 500 < 625 → impossible.
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 500,
      targetAirline: 'Flying Blue',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      const flyingBlue = r.partners.find(
        (p: { partnerName: string }) => /Flying Blue/i.test(p.partnerName),
      );
      assert.strictEqual(
        flyingBlue,
        undefined,
        'Flying Blue should be filtered out when sourcePoints < minTransfer',
      );
    }
  });

  it('includes partner when sourcePoints meets minTransfer', async () => {
    // 1000 source points clears Flying Blue's 625 minimum.
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 1000,
      targetAirline: 'Flying Blue',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.partners.length >= 1);
      const flyingBlue = r.partners.find(
        (p: { partnerName: string }) => /Flying Blue/i.test(p.partnerName),
      );
      assert.ok(flyingBlue, 'Flying Blue should appear when above minTransfer');
    }
  });

  it('exposes pointsUsed and transferIncrement on every entry', async () => {
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 100_000,
      limit: 3,
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      for (const p of r.partners) {
        assert.strictEqual(typeof p.pointsUsed, 'number');
        assert.ok(p.pointsUsed > 0, 'pointsUsed must be positive after filtering');
        assert.ok(p.pointsUsed <= 100_000, 'pointsUsed cannot exceed sourcePoints');
        assert.strictEqual(typeof p.transferIncrement, 'number');
        assert.ok(p.transferIncrement >= 1);
      }
    }
  });

  it('aligns pointsUsed to transferIncrement (Codex finding #3 part 2)', async () => {
    // Flying Blue increment is 5. 1003 source → aligned to 1000 (closest below
    // that's a multiple of 5).
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 1003,
      targetAirline: 'Flying Blue',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      const flyingBlue = r.partners.find(
        (p: { partnerName: string }) => /Flying Blue/i.test(p.partnerName),
      );
      assert.ok(flyingBlue);
      if (flyingBlue) {
        assert.strictEqual(
          flyingBlue.pointsUsed % flyingBlue.transferIncrement,
          0,
          'pointsUsed must be a multiple of transferIncrement',
        );
        assert.ok(
          flyingBlue.pointsUsed <= 1003,
          'pointsUsed must not exceed sourcePoints',
        );
      }
    }
  });

  it('milesOut is calculated from pointsUsed, not raw sourcePoints', async () => {
    // 1003 → pointsUsed=1000, Flying Blue ratio 5:4, expected milesOut=800
    const r = await run({
      sourceProgram: 'amex_dach',
      sourcePoints: 1003,
      targetAirline: 'Flying Blue',
    });
    assert.strictEqual(r.success, true);
    if (r.success) {
      const flyingBlue = r.partners.find(
        (p: { partnerName: string }) => /Flying Blue/i.test(p.partnerName),
      );
      assert.ok(flyingBlue);
      if (flyingBlue) {
        // Flying Blue ratio 5:4 → 1000 source × 4/5 = 800 miles (not 1003 × 4/5 = 802)
        assert.strictEqual(flyingBlue.milesOut, 800);
      }
    }
  });
});
