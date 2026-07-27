import assert from 'node:assert';
import { describe, it } from 'node:test';

import { flightSearchInputSchema } from './flight-search-schema';

const validSearch = {
  origin: 'FRA',
  destination: 'JFK',
  departDate: '2027-06-15',
  cabin: 'BUSINESS',
};

describe('flightSearchTool input schema', () => {
  it('rejects negative maxTaxes values before executing a search', () => {
    const result = flightSearchInputSchema.safeParse({
      ...validSearch,
      maxTaxes: -1,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(
      flightSearchInputSchema.safeParse({ ...validSearch, maxTaxes: 0 }).success,
      true,
    );
  });
});
