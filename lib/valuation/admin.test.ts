import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  handleValuationAdminGet,
  handleValuationAdminPost,
  type AdminDependencies,
  type ValuationAdminData,
} from './admin';
import { createHarness } from './test-support';
import { LOYALTY_PROGRAMS } from '../loyalty/programs';

const body = {
  programId: 'lufthansa',
  anchor: 'travel',
  centsPerUnit: 1.8,
  source: 'reisetopia',
  sourceAsOf: '2026-09',
};
const request = (data: unknown) =>
  new Request('https://mylo.example/api/admin/valuation-table', { method: 'POST', body: JSON.stringify(data) });
function harness() {
  const harness = createHarness();
  let resets = 0;
  const deps: AdminDependencies = {
    repository: harness.repository,
    isAdmin: async () => true,
    getUserId: async () => 'session-admin',
    now: () => harness.state.now,
    resetCache: () => {
      resets++;
    },
  };
  return { ...harness, deps, resets: () => resets };
}

test('admin authorization runs before persistence and derives the actor from the session', async () => {
  const { deps, state } = harness();
  deps.isAdmin = async () => false;
  assert.equal((await handleValuationAdminGet(deps)).status, 403);
  assert.equal((await handleValuationAdminPost(request(body), deps)).status, 403);
  assert.equal(state.rows.length, 0);
  deps.isAdmin = async () => true;
  deps.getUserId = async () => null;
  assert.equal((await handleValuationAdminPost(request(body), deps)).status, 403);
  assert.equal(state.rows.length, 0);
});

test('first dashboard visit seeds and returns all registry programmes plus sorted current rates', async () => {
  const { deps, state } = harness();
  const response = await handleValuationAdminGet(deps);
  assert.equal(response.status, 200);
  const data = (await response.json()) as ValuationAdminData;
  assert.equal(data.tableAsOf, '2026-09');
  assert.equal(data.rates.length, 25);
  assert.equal(data.programs.length, LOYALTY_PROGRAMS.length);
  assert.ok(
    data.rates.every((rate) => !rate.stale && rate.origin === 'seed' && rate.validFrom === state.now.toISOString()),
  );
  const order = data.rates.map((rate) => `${rate.programName}|${rate.anchor}|${rate.cabin}`);
  assert.deepEqual(order.slice(0, 3), [
    'Air Canada Aeroplan|travel|all',
    'Amex Membership Rewards|travel|all',
    'Amex Membership Rewards|no_plan|all',
  ]);
  assert.deepEqual(
    order.filter((entry) => entry.startsWith('Miles & More')),
    [
      'Miles & More|travel|all',
      'Miles & More|travel|business',
      'Miles & More|travel|economy',
      'Miles & More|travel|first',
      'Miles & More|travel|premium_economy',
      'Miles & More|no_plan|all',
    ],
  );
  await handleValuationAdminGet(deps);
  assert.equal(state.rows.length, 25);
  state.now = new Date('2028-01-01');
  assert.ok(
    ((await (await handleValuationAdminGet(deps)).json()) as ValuationAdminData).rates.every((rate) => rate.stale),
  );
});

test('POST validates shape, numeric precision, real dates, URLs, cabins and known programme IDs', async () => {
  const { deps, state, resets } = harness();
  for (const invalid of [
    null,
    {},
    { ...body, createdBy: 'forged' },
    { ...body, currency: 'USD' },
    { ...body, programId: 'unknown' },
    { ...body, anchor: 'invalid' },
    { ...body, cabin: 'invalid' },
    { ...body, anchor: 'no_plan', cabin: 'business' },
    ...[0, -1, 1000, 0.0001, 1.2345, '1.7'].map((centsPerUnit) => ({ ...body, centsPerUnit })),
    { ...body, source: ' ' },
    { ...body, sourceAsOf: '2026-02-30' },
    { ...body, sourceAsOf: '2026-13' },
    { ...body, reviewDue: '2027-02-29' },
    { ...body, reviewDue: '2027-03' },
    { ...body, reviewDue: '2026-09-01' },
    { ...body, reviewDue: '2026-08-15' },
    { ...body, sourceUrl: 'javascript:alert(1)' },
    { ...body, sourceUrl: 'not a URL' },
    { ...body, confirmDeviation: 'true' },
  ]) {
    assert.equal((await handleValuationAdminPost(request(invalid), deps)).status, 400, JSON.stringify(invalid));
  }
  const unknown = await handleValuationAdminPost(request({ ...body, programId: 'unknown' }), deps);
  assert.equal((await unknown.json()).error, 'Unbekanntes Programm: unknown');
  const malformed = new Request('https://mylo.example', { method: 'POST', body: '{' });
  assert.equal((await handleValuationAdminPost(malformed, deps)).status, 400);
  assert.equal(state.rows.length, 0);
  assert.equal(resets(), 0);
});

test('POST persists a dated successor with trusted actor, default deadline and cache reset', async () => {
  const { deps, state, resets } = harness();
  const response = await handleValuationAdminPost(request({ ...body, sourceAsOf: '2026-09-22' }), deps);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.createdBy, 'session-admin');
  assert.equal(result.origin, 'admin');
  assert.equal(result.cabin, 'all');
  assert.equal(result.centsPerUnit, 1.8);
  assert.equal(result.sourceAsOf, '2026-09-01T00:00:00.000Z');
  assert.equal(result.reviewDue, '2027-03-01T00:00:00.000Z');
  assert.equal(result.sourceUrl, null);
  assert.equal(result.note, null);
  assert.equal(state.rows.length, 26);
  assert.equal(resets(), 1);
  const custom = await handleValuationAdminPost(
    request({ ...body, reviewDue: '2027-05-03', note: 'Geprüft', sourceUrl: 'https://reisetopia.de/guide' }),
    deps,
  );
  const saved = await custom.json();
  assert.equal(saved.reviewDue, '2027-05-03T00:00:00.000Z');
  assert.equal(saved.note, 'Geprüft');
  assert.equal(saved.sourceUrl, 'https://reisetopia.de/guide');
});

test('POST returns 409 for large deviations and only writes after explicit confirmation', async () => {
  const { deps, state, resets } = harness();
  await handleValuationAdminGet(deps);
  const changed = { ...body, centsPerUnit: 2.2 };
  const conflict = await handleValuationAdminPost(request(changed), deps);
  assert.equal(conflict.status, 409);
  assert.match((await conflict.json()).error, /2,2 ct.*1,7 ct/);
  assert.equal(state.rows.length, 25);
  assert.equal(resets(), 0);
  assert.equal((await handleValuationAdminPost(request({ ...changed, confirmDeviation: true }), deps)).status, 200);
  assert.equal(state.rows.length, 26);
  assert.equal(resets(), 1);
});

test('exact 25 percent is accepted and new programme rates expand the current allowlist', async () => {
  const { deps } = harness();
  assert.equal((await handleValuationAdminPost(request({ ...body, centsPerUnit: 2.125 }), deps)).status, 200);
  const response = await handleValuationAdminPost(request({ ...body, programId: 'ihg', centsPerUnit: 0.6 }), deps);
  assert.equal(response.status, 200);
  const data = (await (await handleValuationAdminGet(deps)).json()) as ValuationAdminData;
  assert.equal(data.rates.length, 26);
  assert.ok(data.rates.some((rate) => rate.programName === 'IHG One Rewards'));
});

test('admin API hides persistence and auth failure details', async () => {
  const { deps } = harness();
  deps.repository.ensureSeeded = async () => {
    throw new Error('secret database URL');
  };
  const get = await handleValuationAdminGet(deps);
  assert.equal(get.status, 500);
  assert.ok(!(await get.text()).includes('secret'));
  deps.repository.replaceRate = async () => {
    throw new Error('secret database URL');
  };
  const post = await handleValuationAdminPost(request(body), deps);
  assert.equal(post.status, 500);
  assert.ok(!(await post.text()).includes('secret'));
  deps.isAdmin = async () => {
    throw new Error('secret auth details');
  };
  assert.equal((await handleValuationAdminGet(deps)).status, 500);
});
