import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MODULE_TOOLS,
  enabledModuleToolNames,
  retiredModuleTools,
} from './tool-registry';

describe('tool registry', () => {
  it('returns active and beta tools in stable registry order', () => {
    assert.deepEqual(enabledModuleToolNames(), [
      'cpp_calculator',
      'transfer_partner_optimizer',
      'kiwi_flight_search',
      'trivago_hotel_search',
    ]);
  });

  it('returns all three retired tools with a replacement sentence', () => {
    const retired = retiredModuleTools();

    assert.deepEqual(
      retired.map(({ name }) => name),
      [
        'skiplagged_flight_search',
        'sweet_spot_lookup',
        'ferryhopper_search',
      ],
    );
    for (const tool of retired) {
      assert.notEqual(tool.replacement.trim(), '');
    }
  });

  it('uses snake_case names', () => {
    for (const name of Object.keys(MODULE_TOOLS)) {
      assert.match(name, /^[a-z][a-z0-9_]*$/);
    }
  });
});
