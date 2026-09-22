import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  valueAward,
  type AwardValuationRate,
  type EurRates,
} from './award-valuation';

const RATE: AwardValuationRate = {
  centsPerUnit: 1.7,
  validFrom: new Date('2026-01-01T00:00:00Z'),
};

const EUR_ONLY: EurRates = {
  toEur: (amount, currency) => (currency === 'EUR' ? amount : null),
};

const WITH_USD: EurRates = {
  toEur: (amount, currency) => {
    if (currency === 'EUR') return amount;
    if (currency === 'USD') return amount / 1.25;
    return null;
  },
};

describe('valueAward', () => {
  it('rechnet Ersparnis gegen den Ø Barpreis', () => {
    const result = valueAward(
      { miles: 60000, taxesAmount: 480, taxesCurrency: 'EUR' },
      RATE,
      { meanEur: 2900, samples: 5 },
      EUR_ONLY,
    );

    assert.equal(result.taxesEur, 480);
    assert.equal(result.redemptionCostEur, 1500);
    assert.ok(Math.abs((result.savingsPercent ?? 0) - 48.28) < 0.01);
    assert.equal(result.rate?.centsPerUnit, 1.7);
  });

  it('laesst Einloesekosten und Ersparnis leer ohne Rate', () => {
    const result = valueAward(
      { miles: 60000, taxesAmount: 480, taxesCurrency: 'EUR' },
      null,
      { meanEur: 2900, samples: 5 },
      EUR_ONLY,
    );

    assert.equal(result.taxesEur, 480);
    assert.equal(result.redemptionCostEur, null);
    assert.equal(result.savingsPercent, null);
    assert.equal(result.rate, null);
  });

  it('rechnet Einloesekosten auch ohne Ø Barpreis', () => {
    const result = valueAward(
      { miles: 60000, taxesAmount: 480, taxesCurrency: 'EUR' },
      RATE,
      null,
      EUR_ONLY,
    );

    assert.equal(result.redemptionCostEur, 1500);
    assert.equal(result.savingsPercent, null);
  });

  it('rechnet Zuschlaege in Fremdwaehrung nach EUR um', () => {
    const result = valueAward(
      { miles: 60000, taxesAmount: 100, taxesCurrency: 'USD' },
      RATE,
      null,
      WITH_USD,
    );

    assert.equal(result.taxesEur, 80);
    assert.equal(result.redemptionCostEur, 1100);
  });

  it('laesst alles abhaengige leer bei leerer Zuschlagswaehrung', () => {
    const result = valueAward(
      { miles: 60000, taxesAmount: 480, taxesCurrency: '' },
      RATE,
      { meanEur: 2900, samples: 5 },
      EUR_ONLY,
    );

    assert.equal(result.taxesEur, null);
    assert.equal(result.redemptionCostEur, null);
    assert.equal(result.savingsPercent, null);
  });

  it('laesst alles abhaengige leer ohne Zuschlagsbetrag', () => {
    const result = valueAward(
      { miles: 60000, taxesAmount: null, taxesCurrency: 'EUR' },
      RATE,
      { meanEur: 2900, samples: 5 },
      EUR_ONLY,
    );

    assert.equal(result.taxesEur, null);
    assert.equal(result.redemptionCostEur, null);
    assert.equal(result.savingsPercent, null);
  });
});
