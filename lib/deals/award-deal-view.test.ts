import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAwardDealView, type AwardDealContext, type AwardDealFields } from './award-deal-view';

const deal: AwardDealFields = {
  price: 100_000,
  programId: 'lufthansa',
  programReachableDach: true,
  taxesEur: 480,
  seatsLeft: 2,
  cashReferencePrice: 2580,
  cashReferenceSamples: 3,
  valuationRateCt: 1.7,
  valuationRateValidFrom: new Date('2026-09-01T00:00:00Z'),
};
const context: AwardDealContext = {
  ownBalanceProgramIds: new Set(),
  resolveProgramName: () => 'Miles & More',
  resolveDachRoute: () => ({ label: 'PAYBACK 1:1' }),
};

test('transfer access with full inputs provides both currencies, route and a precise seal', () => {
  const view = buildAwardDealView(deal, context);
  assert.deepEqual(view, {
    programId: 'lufthansa', programName: 'Miles & More', miles: 100_000, taxesEur: 480,
    seatsLeft: 2, cashReferenceEur: 2580, reachability: 'transfer', transferRoute: { label: 'PAYBACK 1:1' },
    seal: { achievedCents: 2.1, typicalCents: 1.7, verdict: 'above_travel', rateValidFrom: deal.valuationRateValidFrom },
  });
  const precise = buildAwardDealView({ ...deal, price: 60_000, cashReferencePrice: 1480 }, context);
  assert.equal(precise.seal?.achievedCents, (1000 / 60_000) * 100);
});

test('fewer than three cash samples hide the cash reference and seal', () => {
  for (const cashReferenceSamples of [null, 0, 1, 2]) {
    const view = buildAwardDealView({ ...deal, cashReferenceSamples }, context);
    assert.equal(view.cashReferenceEur, null);
    assert.equal(view.seal, null);
  }
});

test('unreachable awards keep their cash comparison but never have a seal', () => {
  for (const programReachableDach of [false, null]) {
    const view = buildAwardDealView({ ...deal, programReachableDach }, {
      ...context, resolveDachRoute: () => null,
    });
    assert.equal(view.reachability, 'unreachable');
    assert.equal(view.cashReferenceEur, 2580);
    assert.equal(view.seal, null);
    assert.equal(view.transferRoute, null);
  }
});

test('own balances allow a seal and transfer access takes precedence', () => {
  const ownContext = { ...context, ownBalanceProgramIds: new Set(['lufthansa']) };
  for (const programReachableDach of [false, null]) {
    const view = buildAwardDealView({ ...deal, programReachableDach }, ownContext);
    assert.equal(view.reachability, 'own_balance');
    assert.equal(view.seal?.verdict, 'above_travel');
  }
  assert.equal(buildAwardDealView(deal, ownContext).reachability, 'transfer');
  assert.equal(buildAwardDealView({ ...deal, programReachableDach: false }, {
    ...context, ownBalanceProgramIds: new Set(['united']),
  }).reachability, 'unreachable');
});

test('a missing program is unreachable even when the stored transfer flag is true', () => {
  const view = buildAwardDealView({ ...deal, programId: null }, {
    ...context,
    resolveProgramName: () => assert.fail('must not resolve a missing program'),
    resolveDachRoute: () => assert.fail('must not resolve a missing program'),
  });
  assert.equal(view.reachability, 'unreachable');
  assert.equal(view.programName, null);
  assert.equal(view.transferRoute, null);
  assert.equal(view.seal, null);
});

test('missing valuation inputs or invalid miles never create a seal', () => {
  for (const missing of [
    { taxesEur: null }, { valuationRateCt: null }, { cashReferencePrice: null },
    { price: 0 }, { price: -1 }, { valuationRateCt: 0 }, { taxesEur: Number.NaN },
  ]) {
    assert.equal(buildAwardDealView({ ...deal, ...missing }, context).seal, null);
  }
});

test('zero surcharges and zero seats are retained; unknown seats remain null', () => {
  const view = buildAwardDealView({ ...deal, taxesEur: 0, seatsLeft: 0 }, context);
  assert.ok(view.seal);
  assert.equal(view.taxesEur, 0);
  assert.equal(view.seatsLeft, 0);
  assert.equal(buildAwardDealView({ ...deal, seatsLeft: null }, context).seatsLeft, null);
});

test('classifies exact 1.5x and below-travel awards', () => {
  assert.equal(buildAwardDealView({ ...deal, cashReferencePrice: 3030 }, context).seal?.verdict, 'far_above_travel');
  const below = buildAwardDealView({ ...deal, cashReferencePrice: 1480 }, context);
  assert.equal(below.seal?.achievedCents, 1);
  assert.equal(below.seal?.verdict, 'below_travel');
});

test('surcharges at or above the cash fare leave no seal instead of a negative cent value', () => {
  assert.equal(buildAwardDealView({ ...deal, cashReferencePrice: 480 }, context).seal, null);
  assert.equal(buildAwardDealView({ ...deal, cashReferencePrice: 380 }, context).seal, null);
});

test('a legacy rate without a date keeps its seal without inventing the date', () => {
  assert.equal(buildAwardDealView({ ...deal, valuationRateValidFrom: null }, context).seal?.rateValidFrom, null);
});
