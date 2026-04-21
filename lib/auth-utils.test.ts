import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFlightDealsAuthorizedEmail } from './deals/flight-deals-access';

describe('isFlightDealsAuthorizedEmail', () => {
  it('allows private rollout users regardless of casing or spacing', () => {
    assert.equal(isFlightDealsAuthorizedEmail(' Pascal.Lammers@Stay-Digital.de '), true);
    assert.equal(isFlightDealsAuthorizedEmail('tayler.schweigert@lovelifepassport.com'), true);
  });

  it('rejects missing and non-allowlisted emails', () => {
    assert.equal(isFlightDealsAuthorizedEmail(null), false);
    assert.equal(isFlightDealsAuthorizedEmail(undefined), false);
    assert.equal(isFlightDealsAuthorizedEmail('kunde@example.com'), false);
  });
});
