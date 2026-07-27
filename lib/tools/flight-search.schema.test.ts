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

  it('applies defaults while preserving valid loyaltyPrograms and nonStop', () => {
    const defaults = flightSearchInputSchema.parse(validSearch);
    assert.strictEqual(defaults.passengers, 1);
    assert.strictEqual(defaults.awardOnly, false);
    assert.strictEqual(defaults.flexibility, 0);
    assert.strictEqual(defaults.nonStop, false);
    assert.strictEqual(defaults.loyaltyPrograms, undefined);

    const custom = flightSearchInputSchema.parse({
      ...validSearch,
      loyaltyPrograms: ['Aeroplan', 'Miles & More'],
      nonStop: true,
    });
    assert.deepStrictEqual(custom.loyaltyPrograms, ['Aeroplan', 'Miles & More']);
    assert.strictEqual(custom.nonStop, true);
  });

  it('rejects invalid loyaltyPrograms and nonStop field types', () => {
    assert.strictEqual(
      flightSearchInputSchema.safeParse({
        ...validSearch,
        loyaltyPrograms: 'Aeroplan',
      }).success,
      false,
    );
    assert.strictEqual(
      flightSearchInputSchema.safeParse({
        ...validSearch,
        nonStop: 'true',
      }).success,
      false,
    );
  });
});
