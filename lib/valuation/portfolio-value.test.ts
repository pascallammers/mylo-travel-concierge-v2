import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeWertzahl, displayEuro, type PortfolioAccount } from './portfolio-value';
import { buildValuationTable } from './table';
import { seedRows } from './seeds';

const today = new Date('2026-09-24T12:00:00Z');
const table = buildValuationTable(seedRows(), today);

function account(programId: string, balance: number | null, syncErrorCode: number | null = null): PortfolioAccount {
  return { programId, balance, syncErrorCode, lastRetrievedAt: null };
}

function compute(accounts: readonly PortfolioAccount[]) {
  return computeWertzahl({ connected: true, accounts, table, now: today });
}

test('Wertzahl sums both anchors and rounds only the portfolio totals', () => {
  assert.deepEqual(compute([account('lufthansa', 100_000), account('amex-mr', 50_000)]), {
    kind: 'value',
    travelEur: 2600,
    noPlan: { eur: 500, coveredPrograms: 2, totalPrograms: 2 },
    ratedAccounts: 2,
    totalAccounts: 2,
    unreadableCount: 0,
    programs: [
      { programId: 'lufthansa', name: 'Miles & More', travelEur: 1700 },
      { programId: 'amex-mr', name: 'Amex Membership Rewards', travelEur: 850 },
    ],
  });
});

test('displayEuro preserves zero, rounds small values to euros and larger values to hundreds', () => {
  for (const [eur, displayed] of [
    [0, 0],
    [0.01, 1],
    [0.49, 1],
    [1.49, 1],
    [1.5, 2],
    [98.6, 99],
    [99.5, 100],
    [100, 100],
    [149, 100],
    [150, 200],
    [4649, 4600],
    [4650, 4700],
  ]) {
    assert.equal(displayEuro(eur), displayed, `${eur} euros`);
  }
});

test('small positive balances use whole euros for both anchors and keep unrounded programme values', () => {
  const value = compute([account('lufthansa', 100)]);
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.equal(value.travelEur, 2);
  assert.deepEqual(value.noPlan, { eur: 1, coveredPrograms: 1, totalPrograms: 1 });
  assert.equal(value.programs[0].travelEur, 1.7);
});

test('accounts without rates stay in the total: four of six accounts are rated', () => {
  const value = compute([
    account('lufthansa', 100_000),
    account('amex-mr', 50_000),
    account('payback', 10_000),
    account('marriott', 10_000),
    account('chase-ur', 1_000_000),
    account('aw:unknown', 1_000_000),
  ]);
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.equal(value.ratedAccounts, 4);
  assert.equal(value.totalAccounts, 6);
  assert.equal(value.travelEur, 2800);
  assert.equal(value.programs.length, 4);
});

test('only unreadable accounts produce no_rateable_account with repair and read-failure counts', () => {
  assert.deepEqual(compute([account('lufthansa', null, 2), account('amex-mr', null, 3)]), {
    kind: 'no_rateable_account',
    unreadableCount: 2,
    totalAccounts: 2,
  });
});

test('an unreadable account outside the allowlist is not counted as unreadable', () => {
  assert.deepEqual(compute([account('chase-ur', null, 2)]), {
    kind: 'no_rateable_account',
    unreadableCount: 0,
    totalAccounts: 1,
  });
});

test('connected without accounts has no Wertzahl, including no zero-euro value', () => {
  assert.deepEqual(compute([]), { kind: 'no_rateable_account', unreadableCount: 0, totalAccounts: 0 });
});

test('disconnected takes precedence even if accounts are supplied', () => {
  assert.deepEqual(
    computeWertzahl({
      connected: false,
      accounts: [account('lufthansa', 100_000)],
      table,
      now: today,
    }),
    { kind: 'not_connected' },
  );
});

test('Wert ohne Plan is a partial sum with coverage by rated programme, not by account', () => {
  const value = compute([
    account('lufthansa', 50_000),
    account('lufthansa', 50_000),
    account('marriott', 100_000),
    account('amex-mr', null, 2),
    account('chase-ur', 100_000),
  ]);
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.equal(value.travelEur, 2400);
  assert.deepEqual(value.noPlan, { eur: 300, coveredPrograms: 1, totalPrograms: 2 });
  assert.equal(value.unreadableCount, 1);
});

test('a portfolio with only travel anchors has no Wert ohne Plan', () => {
  const value = compute([account('marriott', 100_000)]);
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.equal(value.travelEur, 700);
  assert.equal(value.noPlan, null);
});

test('no_balance without a failing sync outcome is not unreadable', () => {
  assert.deepEqual(compute([null, 0, 1, 9].map((code) => account('lufthansa', null, code))), {
    kind: 'no_rateable_account',
    unreadableCount: 0,
    totalAccounts: 4,
  });
});

test('known balances with repair or read-failure codes remain fully rateable', () => {
  const value = compute([account('lufthansa', 50_000, 2), account('lufthansa', 50_000, 3)]);
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.equal(value.ratedAccounts, 2);
  assert.equal(value.travelEur, 1700);
  assert.equal(value.unreadableCount, 0);
});

test('old balances and accounts with other owners or hand-entered balances count fully', () => {
  const storedAccount = {
    ...account('lufthansa', 100_000),
    lastRetrievedAt: new Date('2020-01-01'),
    ownerIsConnectedUser: false,
    balanceVerified: false,
  };
  const value = compute([storedAccount]);
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.equal(value.travelEur, 1700);
  assert.equal(value.ratedAccounts, 1);
});

test('a known zero balance is rateable and retains no-plan programme coverage', () => {
  assert.deepEqual(compute([account('lufthansa', 0)]), {
    kind: 'value',
    travelEur: 0,
    noPlan: { eur: 0, coveredPrograms: 1, totalPrograms: 1 },
    ratedAccounts: 1,
    totalAccounts: 1,
    unreadableCount: 0,
    programs: [{ programId: 'lufthansa', name: 'Miles & More', travelEur: 0 }],
  });
});

test('Reisewert uses the business cabin even when the all-cabin rate differs', () => {
  const rows = seedRows();
  rows.find((row) => row.programId === 'lufthansa' && row.anchor === 'travel' && row.cabin === 'all')!.centsPerUnit =
    0.9;
  const value = computeWertzahl({
    connected: true,
    accounts: [account('lufthansa', 100_000)],
    table: buildValuationTable(rows, today),
    now: today,
  });
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.equal(value.travelEur, 1700);
});

test('programme contributions group balances and sort by unrounded Reisewert descending', () => {
  const accounts = [account('lufthansa', 60), account('lufthansa', 40), account('amex-mr', 200)];
  const original = structuredClone(accounts);
  const value = compute(accounts);
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.deepEqual(value.programs, [
    { programId: 'amex-mr', name: 'Amex Membership Rewards', travelEur: 3.4 },
    { programId: 'lufthansa', name: 'Miles & More', travelEur: 1.7 },
  ]);
  assert.deepEqual(value.noPlan, { eur: 1, coveredPrograms: 2, totalPrograms: 2 });
  assert.deepEqual(accounts, original);
});

test('an allowlisted programme outside the registry falls back to its programme ID', () => {
  const row = { ...seedRows()[0], programId: 'future-program' };
  const value = computeWertzahl({
    connected: true,
    accounts: [account('future-program', 1000)],
    table: buildValuationTable([row], today),
    now: today,
  });
  assert.equal(value.kind, 'value');
  if (value.kind !== 'value') return;
  assert.deepEqual(value.programs, [{ programId: 'future-program', name: 'future-program', travelEur: 17 }]);
});
