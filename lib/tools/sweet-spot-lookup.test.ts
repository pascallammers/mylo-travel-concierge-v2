// lib/tools/sweet-spot-lookup.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { sweetSpotLookupTool } from './sweet-spot-lookup';

async function run(rawInput: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: schema typing irrelevant
  const parsed = (sweetSpotLookupTool.inputSchema as any).parse(rawInput);
  // biome-ignore lint/suspicious/noExplicitAny: ToolCallOptions irrelevant
  return await (sweetSpotLookupTool.execute as any)(parsed, {});
}

describe('sweetSpotLookupTool — basic', () => {
  it('declares description and zod input schema', () => {
    assert.ok(sweetSpotLookupTool.description);
    assert.ok(sweetSpotLookupTool.inputSchema);
  });

  it('returns flight sweet spots when no filter is given (subject to default limit)', async () => {
    const r = await run({});
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.flights.length > 0);
      assert.ok(r.flights.length <= 5); // default limit
      assert.ok(r.count >= r.flights.length); // total >= returned
      assert.strictEqual(r.hotels.length, 0); // hotels off by default
    }
  });

  it('does not include hotels by default', async () => {
    const r = await run({});
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.strictEqual(r.hotels.length, 0);
    }
  });

  it('includes hotels when includeHotels=true', async () => {
    const r = await run({ includeHotels: true });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.hotels.length > 0);
    }
  });
});

describe('sweetSpotLookupTool — filtering', () => {
  it('filters flights by query substring (route key match: "japan")', async () => {
    const r = await run({ query: 'japan' });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.flights.length > 0);
      // every match must mention japan in name, airline, program, route keys, or why
      for (const f of r.flights) {
        const haystack = `${f.name} ${f.airline} ${f.program} ${Object.keys(f.routes).join(' ')} ${f.why ?? ''}`.toLowerCase();
        assert.match(haystack, /japan/);
      }
    }
  });

  it('filters by alliance (case-insensitive, normalizes spaces+underscores)', async () => {
    const r = await run({ alliance: 'Star Alliance' });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.flights.length > 0);
      for (const f of r.flights) {
        assert.match((f.alliance ?? '').toLowerCase().replace(/_/g, ' '), /star alliance/);
      }
    }
  });

  it('filters by tier (legendary)', async () => {
    const r = await run({ tier: 'legendary' });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.flights.length > 0);
      for (const f of r.flights) {
        assert.strictEqual(f.tier, 'legendary');
      }
    }
  });

  it('filters by cabin (first)', async () => {
    const r = await run({ cabin: 'first' });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.flights.length > 0);
      for (const f of r.flights) {
        assert.strictEqual(f.cabin, 'first');
      }
    }
  });

  it('combines filters with AND semantics', async () => {
    const r = await run({ alliance: 'Star Alliance', cabin: 'business' });
    assert.strictEqual(r.success, true);
    if (r.success) {
      for (const f of r.flights) {
        assert.match((f.alliance ?? '').toLowerCase().replace(/_/g, ' '), /star alliance/);
        assert.strictEqual(f.cabin, 'business');
      }
    }
  });

  it('returns empty results when no flight matches', async () => {
    const r = await run({ query: 'definitely-no-route-named-this-zzz' });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.strictEqual(r.flights.length, 0);
      assert.strictEqual(r.count, 0);
    }
  });
});

describe('sweetSpotLookupTool — output shape', () => {
  it('flight entries include name, tier, program, airline, cabin, routes, transfer_partners', async () => {
    const r = await run({ tier: 'legendary' });
    assert.strictEqual(r.success, true);
    if (r.success && r.flights.length > 0) {
      const f = r.flights[0];
      assert.ok(typeof f.name === 'string');
      assert.ok(typeof f.tier === 'string');
      assert.ok(typeof f.program === 'string');
      assert.ok(typeof f.airline === 'string');
      assert.ok(typeof f.cabin === 'string');
      assert.ok(typeof f.routes === 'object');
      assert.ok(Array.isArray(f.transfer_partners));
    }
  });

  it('respects limit', async () => {
    const r = await run({ limit: 2 });
    assert.strictEqual(r.success, true);
    if (r.success) {
      assert.ok(r.flights.length <= 2);
    }
  });

  it('returns count of matches before limit applied', async () => {
    const noLimit = await run({ limit: 999 });
    const withLimit = await run({ limit: 1 });
    if (noLimit.success && withLimit.success) {
      assert.ok(withLimit.count >= withLimit.flights.length);
      assert.strictEqual(withLimit.count, noLimit.flights.length);
      assert.strictEqual(withLimit.flights.length, 1);
    }
  });
});
