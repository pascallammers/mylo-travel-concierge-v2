import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, describe, it, mock } from 'node:test';

let user: { id: string } | null = { id: 'member' };
let hasAccess = true;
const checkAccess = mock.fn(async (_userId: string) => hasAccess);
const upsert = mock.fn(async (_userId: string, _preferences: Record<string, unknown>) => {});
const revalidatePath = mock.fn((_path: string) => {});

mock.module('next/cache', { namedExports: { revalidatePath } });
mock.module('@/lib/auth-utils', { namedExports: { getUser: async () => user } });
mock.module('@/lib/db/deal-queries', { namedExports: { upsertUserDealPreferences: upsert } });
mock.module('@/lib/deals/flight-deals-access', { namedExports: { hasFlightDealsAccess: checkAccess } });
mock.module('@/lib/deals', {
  namedExports: {
    resolveAirportCodeList: async (value: string) => value.split(',').map((code) => code.trim()).filter(Boolean),
  },
});

// Install dependency mocks before loading the server actions without dynamic imports.
const { saveDealPreferencesAction, subscribeWeeklyDigestAction } = createRequire(import.meta.url)('./actions.ts') as typeof import('./actions');

beforeEach(() => {
  user = { id: 'member' };
  hasAccess = true;
  upsert.mock.resetCalls();
  revalidatePath.mock.resetCalls();
  checkAccess.mock.resetCalls();
});

describe('subscribeWeeklyDigestAction', () => {
  it('aktiviert weekly, speichert ausgewählte Abflughäfen und aktualisiert die Deals-Seite', async () => {
    const result = await subscribeWeeklyDigestAction({ locale: 'de', originAirports: ['FRA', 'MUC'] });
    assert.deepEqual(result, { success: true });
    assert.deepEqual(upsert.mock.calls[0].arguments, ['member', { emailDigest: 'weekly', originAirports: ['FRA', 'MUC'] }]);
    assert.equal(upsert.mock.callCount(), 1);
    assert.deepEqual(revalidatePath.mock.calls.map((call) => call.arguments), [['/de/deals']]);
  });

  it('erhält gespeicherte Abflughäfen bei leerem Filter', async () => {
    await subscribeWeeklyDigestAction({ locale: 'en', originAirports: [] });
    assert.deepEqual(upsert.mock.calls[0].arguments, ['member', { emailDigest: 'weekly' }]);
    assert.deepEqual(revalidatePath.mock.calls[0].arguments, ['/en/deals']);
  });

  it('lehnt Besucher ohne Login vor der Zugriffsprüfung ab', async () => {
    user = null;
    await assert.rejects(subscribeWeeklyDigestAction({ locale: 'de', originAirports: [] }), /Unauthorized/);
    assert.equal(checkAccess.mock.callCount(), 0);
    assert.equal(upsert.mock.callCount(), 0);
    assert.equal(revalidatePath.mock.callCount(), 0);
  });

  it('lehnt Mitglieder ohne Deals-Zugang ohne Schreibzugriff ab', async () => {
    hasAccess = false;
    await assert.rejects(subscribeWeeklyDigestAction({ locale: 'de', originAirports: [] }), /Forbidden/);
    assert.deepEqual(checkAccess.mock.calls[0].arguments, ['member']);
    assert.equal(upsert.mock.callCount(), 0);
    assert.equal(revalidatePath.mock.callCount(), 0);
  });

  it('akzeptiert zehn Flughäfen und verwirft elf oder ungültige IATA-Codes', async () => {
    const airports = ['FRA', 'MUC', 'BER', 'DUS', 'HAM', 'VIE', 'ZRH', 'CGN', 'STR', 'LHR'];
    await subscribeWeeklyDigestAction({ locale: 'de', originAirports: airports });
    assert.deepEqual(upsert.mock.calls[0].arguments[1].originAirports, airports);
    upsert.mock.resetCalls();
    revalidatePath.mock.resetCalls();
    for (const originAirports of [[...airports, 'CDG'], ['fra'], ['AB'], ['ABCD'], ['F1A'], [''], [' FRA']]) {
      await assert.rejects(subscribeWeeklyDigestAction({ locale: 'de', originAirports }));
    }
    assert.equal(upsert.mock.callCount(), 0);
    assert.equal(revalidatePath.mock.callCount(), 0);
  });

  it('meldet Schreibfehler und aktualisiert die Seite erst nach erfolgreichem Speichern', async () => {
    upsert.mock.mockImplementationOnce(async () => { throw new Error('Database unavailable'); });
    await assert.rejects(subscribeWeeklyDigestAction({ locale: 'de', originAirports: ['FRA'] }), /Database unavailable/);
    assert.equal(revalidatePath.mock.callCount(), 0);
  });
});

describe('saveDealPreferencesAction', () => {
  const input = {
    locale: 'de', originAirports: 'FRA, MUC', preferredDestinations: 'PMI',
    cabinClass: 'business' as const, maxPrice: '450', emailDigest: 'daily' as const,
  };

  it('speichert weiterhin alle Einstellungen des Detail-Panels', async () => {
    assert.deepEqual(await saveDealPreferencesAction(input), { success: true });
    assert.deepEqual(upsert.mock.calls[0].arguments, ['member', {
      originAirports: ['FRA', 'MUC'], preferredDestinations: ['PMI'], cabinClass: 'business',
      maxPrice: 450, emailDigest: 'daily',
    }]);
    assert.deepEqual(revalidatePath.mock.calls.map((call) => call.arguments[0]), ['/de', '/de/deals', '/de/new']);
  });

  it('bewahrt die Login- und Zugangsprüfung für das Detail-Panel', async () => {
    user = null;
    await assert.rejects(saveDealPreferencesAction(input), /Unauthorized/);
    user = { id: 'member' };
    hasAccess = false;
    await assert.rejects(saveDealPreferencesAction(input), /Forbidden/);
    assert.equal(upsert.mock.callCount(), 0);
  });
});
