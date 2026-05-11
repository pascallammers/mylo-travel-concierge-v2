// lib/chat/feature-flags.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { PHASE_1_TOOL_NAMES, isPhase1ToolsEnabled } from './feature-flags';

describe('isPhase1ToolsEnabled', () => {
  it('returns false when env is empty', () => {
    assert.strictEqual(isPhase1ToolsEnabled({}), false);
  });

  it('returns false when flag is unset', () => {
    assert.strictEqual(isPhase1ToolsEnabled({ OTHER_VAR: '1' }), false);
  });

  it('returns true when flag is "1"', () => {
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: '1' }), true);
  });

  it('returns true when flag is "true"', () => {
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: 'true' }), true);
  });

  it('returns false for any other truthy-looking string (strict opt-in)', () => {
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: 'yes' }), false);
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: 'TRUE' }), false);
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: '2' }), false);
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: 'enabled' }), false);
  });

  it('returns false for explicitly disabling values', () => {
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: '0' }), false);
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: 'false' }), false);
    assert.strictEqual(isPhase1ToolsEnabled({ ENABLE_PHASE_1_TOOLS: '' }), false);
  });

  it('defaults to reading process.env when no arg passed', () => {
    // Smoke check: should not throw, returns a boolean. Actual value depends on
    // ambient env at test time, which we don't control.
    const result = isPhase1ToolsEnabled();
    assert.strictEqual(typeof result, 'boolean');
  });
});

describe('PHASE_1_TOOL_NAMES', () => {
  it('contains all 7 Phase 1 tools (3 from Lane E + 4 from Phase 1b)', () => {
    assert.strictEqual(PHASE_1_TOOL_NAMES.length, 7);
    assert.ok(PHASE_1_TOOL_NAMES.includes('cpp_calculator'));
    assert.ok(PHASE_1_TOOL_NAMES.includes('transfer_partner_optimizer'));
    assert.ok(PHASE_1_TOOL_NAMES.includes('sweet_spot_lookup'));
    assert.ok(PHASE_1_TOOL_NAMES.includes('skiplagged_flight_search'));
    assert.ok(PHASE_1_TOOL_NAMES.includes('kiwi_flight_search'));
    assert.ok(PHASE_1_TOOL_NAMES.includes('trivago_hotel_search'));
    assert.ok(PHASE_1_TOOL_NAMES.includes('ferryhopper_search'));
  });

  it('uses snake_case matching the existing groupTools registry convention', () => {
    for (const name of PHASE_1_TOOL_NAMES) {
      assert.match(name, /^[a-z][a-z0-9_]*$/, `${name} should be snake_case`);
    }
  });
});
