// lib/services/cpp-calculator.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  calculateCpp,
  CppCalculatorError,
  DEFAULT_EUR_TO_USD,
  MM_EXCELLENT_THRESHOLD,
} from './cpp-calculator';
import type { BorskiPointsValuationsFile } from '@/lib/data/borski-toolkit-adapter';

const valuations: BorskiPointsValuationsFile = {
  _meta: {
    sources: {},
    last_updated: '2026-03-21',
    staleness_days: 45,
    staleness_note: 'test fixture',
    methodology: 'test fixture',
  },
  credit_card_points: {
    amex_membership_rewards: {
      name: 'American Express Membership Rewards',
      floor: 1.7,
      ceiling: 2.2,
      sources: { tpg: 2.0, up: 2.2, omaat: 1.7, vftw: 1.7 },
    },
  },
  airline_miles: {
    lufthansa: {
      name: 'Lufthansa Miles & More',
      floor: 1.2,
      ceiling: 1.3,
      sources: { up: 1.3, omaat: 1.2, vftw: 1.2 },
    },
  },
  hotel_points: {
    marriott_bonvoy: {
      name: 'Marriott Bonvoy',
      floor: 0.7,
      ceiling: 0.85,
      sources: { tpg: 0.8, up: 0.85, omaat: 0.7 },
    },
  },
};

describe('calculateCpp — basic computation', () => {
  it('computes cpp from points and USD cash', () => {
    const r = calculateCpp({
      programId: 'amex_membership_rewards',
      pointsRequired: 50_000,
      cashEquivalent: 1000,
      currency: 'USD',
      valuations,
    });
    assert.strictEqual(r.cpp, 2.0);
    assert.strictEqual(r.inputCurrency, 'USD');
    assert.strictEqual(r.programName, 'American Express Membership Rewards');
  });

  it('converts EUR cash to USD via rate before computing cpp', () => {
    const r = calculateCpp({
      programId: 'amex_membership_rewards',
      pointsRequired: 50_000,
      cashEquivalent: 1000,
      currency: 'EUR',
      valuations,
      eurToUsdRate: 1.1,
    });
    assert.strictEqual(r.cpp, 2.2); // 1000 EUR * 1.1 = 1100 USD → 2.2¢
    assert.strictEqual(r.inputCurrency, 'EUR');
  });

  it('uses DEFAULT_EUR_TO_USD when rate not provided for EUR input', () => {
    const r = calculateCpp({
      programId: 'amex_membership_rewards',
      pointsRequired: 50_000,
      cashEquivalent: 1000,
      currency: 'EUR',
      valuations,
    });
    const expected = (1000 * DEFAULT_EUR_TO_USD * 100) / 50_000;
    assert.strictEqual(r.cpp, Math.round(expected * 100) / 100);
  });

  it('looks up programs across credit_card_points, airline_miles, and hotel_points', () => {
    const cc = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 1000, cashEquivalent: 20, currency: 'USD', valuations });
    const air = calculateCpp({ programId: 'lufthansa', pointsRequired: 1000, cashEquivalent: 20, currency: 'USD', valuations });
    const hot = calculateCpp({ programId: 'marriott_bonvoy', pointsRequired: 1000, cashEquivalent: 20, currency: 'USD', valuations });
    assert.strictEqual(cc.programName, 'American Express Membership Rewards');
    assert.strictEqual(air.programName, 'Lufthansa Miles & More');
    assert.strictEqual(hot.programName, 'Marriott Bonvoy');
  });
});

describe('calculateCpp — tier logic (default borski floor/ceiling)', () => {
  // amex floor=1.7, ceiling=2.2, midpoint=1.95
  it('returns poor when cpp < floor', () => {
    const r = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 100_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 1.0);
    assert.strictEqual(r.tier, 'poor');
  });

  it('returns fair when floor <= cpp < midpoint', () => {
    const r = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 100_000, cashEquivalent: 1800, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 1.8);
    assert.strictEqual(r.tier, 'fair');
  });

  it('returns good when midpoint <= cpp < ceiling', () => {
    const r = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 2.0);
    assert.strictEqual(r.tier, 'good');
  });

  it('returns excellent when cpp >= ceiling', () => {
    const r = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 1100, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 2.2);
    assert.strictEqual(r.tier, 'excellent');
  });

  it('reports source as "borski" for non-M&M programs', () => {
    const r = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.source, 'borski');
  });
});

describe('calculateCpp — M&M (lufthansa) Override', () => {
  // borski lufthansa: floor=1.2, ceiling=1.3 → effective ceiling = MM_EXCELLENT_THRESHOLD (1.8)
  // effective midpoint = (1.2 + 1.8) / 2 = 1.5
  it('reports source as "mm-override" for lufthansa', () => {
    const r = calculateCpp({ programId: 'lufthansa', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.source, 'mm-override');
  });

  it('uses 1.8¢ as effective ceiling, not borski 1.3¢', () => {
    const r = calculateCpp({ programId: 'lufthansa', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.threshold.ceiling, MM_EXCELLENT_THRESHOLD);
    assert.strictEqual(r.threshold.floor, 1.2);
  });

  it('returns excellent at exactly 1.8¢ (boundary inclusive)', () => {
    const r = calculateCpp({ programId: 'lufthansa', pointsRequired: 50_000, cashEquivalent: 900, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 1.8);
    assert.strictEqual(r.tier, 'excellent');
  });

  it('returns good at 1.7¢ — above borski ceiling 1.3 but below override 1.8', () => {
    const r = calculateCpp({ programId: 'lufthansa', pointsRequired: 100_000, cashEquivalent: 1700, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 1.7);
    assert.strictEqual(r.tier, 'good');
  });

  it('returns fair at 1.4¢ — above floor 1.2 but below midpoint 1.5', () => {
    const r = calculateCpp({ programId: 'lufthansa', pointsRequired: 100_000, cashEquivalent: 1400, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 1.4);
    assert.strictEqual(r.tier, 'fair');
  });

  it('returns poor at 1.0¢ — below floor 1.2', () => {
    const r = calculateCpp({ programId: 'lufthansa', pointsRequired: 100_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 1.0);
    assert.strictEqual(r.tier, 'poor');
  });

  it('mentions M&M override in reasoning string', () => {
    const r = calculateCpp({ programId: 'lufthansa', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.match(r.reasoning, /M&M|override|sweet spot/i);
  });
});

describe('calculateCpp — input validation', () => {
  it('throws CppCalculatorError when programId is unknown', () => {
    assert.throws(
      () => calculateCpp({ programId: 'unknown_program', pointsRequired: 1000, cashEquivalent: 20, currency: 'USD', valuations }),
      CppCalculatorError,
    );
  });

  it('throws when pointsRequired is zero', () => {
    assert.throws(
      () => calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 0, cashEquivalent: 100, currency: 'USD', valuations }),
      CppCalculatorError,
    );
  });

  it('throws when pointsRequired is negative', () => {
    assert.throws(
      () => calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: -1000, cashEquivalent: 100, currency: 'USD', valuations }),
      CppCalculatorError,
    );
  });

  it('throws when cashEquivalent is zero', () => {
    assert.throws(
      () => calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 0, currency: 'USD', valuations }),
      CppCalculatorError,
    );
  });

  it('throws when cashEquivalent is negative', () => {
    assert.throws(
      () => calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: -100, currency: 'USD', valuations }),
      CppCalculatorError,
    );
  });

  it('throws when eurToUsdRate is non-positive', () => {
    assert.throws(
      () => calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'EUR', valuations, eurToUsdRate: 0 }),
      CppCalculatorError,
    );
  });
});

describe('calculateCpp — output shape', () => {
  it('rounds cpp to 2 decimal places', () => {
    // 1000 USD / 33333 points = 0.030003... → 3.0¢ (rounded)
    const r = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 33_333, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.cpp, 3.0);
  });

  it('reports threshold as { floor, ceiling } numbers', () => {
    const r = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'USD', valuations });
    assert.strictEqual(r.threshold.floor, 1.7);
    assert.strictEqual(r.threshold.ceiling, 2.2);
  });

  it('echoes inputCurrency unchanged', () => {
    const a = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'USD', valuations });
    const b = calculateCpp({ programId: 'amex_membership_rewards', pointsRequired: 50_000, cashEquivalent: 1000, currency: 'EUR', valuations });
    assert.strictEqual(a.inputCurrency, 'USD');
    assert.strictEqual(b.inputCurrency, 'EUR');
  });
});
