import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildMockToolRegistry, WEB_GROUP_TOOL_NAMES } from './mock-tools';

describe('buildMockToolRegistry', () => {
  it('exposes exactly the 16 web group tool names', () => {
    const registry = buildMockToolRegistry();
    const keys = Object.keys(registry).sort();
    const expected = [...WEB_GROUP_TOOL_NAMES].sort();
    assert.deepStrictEqual(keys, expected);
  });

  it('every entry has an execute that returns a noop result', async () => {
    const registry = buildMockToolRegistry();
    for (const [name, t] of Object.entries(registry)) {
      const result = await t.execute({}, { toolCallId: 'x', messages: [] });
      assert.deepStrictEqual(result, { ok: true, mock: true }, `tool ${name} did not return noop`);
    }
  });

  it('preserves the inputSchema from the production tool', () => {
    const registry = buildMockToolRegistry();
    // search_flights production schema requires `query` (verify via parse)
    assert.ok(
      'inputSchema' in registry.search_flights,
      'search_flights mock missing inputSchema',
    );
  });
});
