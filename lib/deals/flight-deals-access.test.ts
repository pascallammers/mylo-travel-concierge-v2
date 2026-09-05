import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

// Flight Deals lief bis 2026-08 hinter einer Zwei-Adressen-Allowlist. Seitdem gilt
// dieselbe Zugangsregel wie für die restliche App: bezahlender Kunde oder Admin.
// Braucht --experimental-test-module-mocks (im test-Script gesetzt).

const accessByUserId = new Map<string, boolean>([
  ['subscriber', true],
  ['churned', false],
]);

const checkUserAccess = mock.fn(async (userId: string) => {
  const hasAccess = accessByUserId.get(userId) ?? false;
  return { hasAccess, reason: hasAccess ? ('active_subscription' as const) : ('no_subscription' as const) };
});

mock.module('@/lib/access-control', {
  namedExports: { checkUserAccess },
});

const { hasFlightDealsAccess } = await import('./flight-deals-access');

describe('hasFlightDealsAccess', () => {
  it('grants access to every account that may use the app', async () => {
    assert.equal(await hasFlightDealsAccess('subscriber'), true);
  });

  it('denies accounts whose subscription no longer grants access', async () => {
    assert.equal(await hasFlightDealsAccess('churned'), false);
  });

  it('denies signed-out visitors without querying the database', async () => {
    checkUserAccess.mock.resetCalls();

    assert.equal(await hasFlightDealsAccess(null), false);
    assert.equal(await hasFlightDealsAccess(undefined), false);
    assert.equal(await hasFlightDealsAccess(''), false);
    assert.equal(checkUserAccess.mock.callCount(), 0);
  });
});
