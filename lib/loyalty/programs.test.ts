import { describe, it } from 'node:test';
import assert from 'node:assert';

import { LOYALTY_PROGRAMS, decodeHtmlEntities, getLoyaltyProgram, resolveLoyaltyProgram } from './programs';

describe('resolveLoyaltyProgram', () => {
  it('collapses the two Flying Blue providers onto one programme', () => {
    const klm = resolveLoyaltyProgram({ code: 'klm', displayName: 'KLM (Flying Blue)', kind: 'Airlines' });
    const airfrance = resolveLoyaltyProgram({
      code: 'airfrance',
      displayName: 'Air France (Flying Blue)',
      kind: 'Airlines',
    });
    assert.equal(klm.programId, 'flyingblue');
    assert.equal(airfrance.programId, 'flyingblue');
    assert.equal(klm.name, 'Flying Blue');
    assert.equal(klm.unit, 'miles');
    assert.equal(klm.known, true);
  });

  it('maps code-less Amex providers by display name onto Membership Rewards', () => {
    const centurion = resolveLoyaltyProgram({ code: null, displayName: 'Amex Centurion', kind: 'Credit Cards' });
    const mr = resolveLoyaltyProgram({ code: undefined, displayName: 'Amex (Membership Rewards)', kind: 'Credit Cards' });
    const amex = resolveLoyaltyProgram({ code: 'amex', displayName: 'Amex (Membership Rewards)', kind: 'Credit Cards' });
    assert.equal(centurion.programId, 'amex-mr');
    assert.equal(mr.programId, 'amex-mr');
    assert.equal(amex.programId, 'amex-mr');
    assert.equal(amex.unit, 'points');
  });

  it('hotel programmes hold points, never nights', () => {
    const hilton = resolveLoyaltyProgram({ code: 'hhonors', displayName: 'Hilton (Honors)', kind: 'Hotels' });
    assert.equal(hilton.programId, 'hilton');
    assert.equal(hilton.unit, 'points');
  });

  it('keeps unknown providers apart under a stable aw: id', () => {
    const a = resolveLoyaltyProgram({ code: 'finnair', displayName: 'Finnair (Plus)', kind: 'Airlines' });
    const b = resolveLoyaltyProgram({ code: 'booking', displayName: 'Booking.com', kind: 'Hotels' });
    assert.deepEqual(a, { programId: 'aw:finnair', name: 'Finnair (Plus)', unit: 'miles', known: false });
    assert.deepEqual(b, { programId: 'aw:booking', name: 'Booking.com', unit: 'points', known: false });
  });

  it('derives the id from the name when AwardWallet omits the code', () => {
    const r = resolveLoyaltyProgram({ code: null, displayName: 'Some &amp; Other Club', kind: 'Other' });
    assert.equal(r.programId, 'aw:some-other-club');
    assert.equal(r.name, 'Some & Other Club');
  });

  it('decodes HTML entities in display names', () => {
    const turkish = resolveLoyaltyProgram({
      code: 'unknown-turkish',
      displayName: 'Turkish Airlines (Miles&amp;Smiles)',
      kind: 'Airlines',
    });
    assert.equal(turkish.name, 'Turkish Airlines (Miles&Smiles)');
    assert.equal(decodeHtmlEntities('A &#38; B &#x26; C &quot;D&quot; &unknown;'), 'A & B & C "D" &unknown;');
  });
});

describe('LOYALTY_PROGRAMS', () => {
  it('has unique ids and never claims an AwardWallet code twice', () => {
    const ids = new Set<string>();
    const codes = new Set<string>();
    for (const p of LOYALTY_PROGRAMS) {
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
      ids.add(p.id);
      for (const c of p.awardWalletCodes) {
        assert.ok(!codes.has(c), `code ${c} claimed twice`);
        codes.add(c);
      }
    }
    assert.equal(getLoyaltyProgram('lufthansa')?.name, 'Miles & More');
  });
});
