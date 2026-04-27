/**
 * Tests for the borski-toolkit adapter loaders.
 *
 * These tests load the real submodule data and assert structural invariants
 * — they double as drift detectors when the upstream submodule is updated.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTransferPartners,
  loadSweetSpots,
  loadPointsValuations,
  loadAlliances,
  loadPartnerAwards,
  loadHotelChains,
  resetBorskiCaches,
} from './load-from-borski';

describe('loadTransferPartners', () => {
  it('parses the file and exposes all 6 expected issuers', () => {
    resetBorskiCaches();
    const file = loadTransferPartners();
    for (const issuer of ['amex_mr', 'chase_ur', 'bilt', 'capital_one', 'citi_ty', 'wells_fargo']) {
      assert.ok(file[issuer], `missing issuer: ${issuer}`);
    }
  });

  it('has display_name + airlines + hotels for amex_mr', () => {
    const file = loadTransferPartners();
    const amex = file.amex_mr;
    assert.equal(typeof amex.display_name, 'string');
    assert.ok(Object.keys(amex.airlines).length > 0, 'amex_mr has airlines');
    assert.ok(Object.keys(amex.hotels).length > 0, 'amex_mr has hotels');
  });

  it('every airline partner has a numeric ratio', () => {
    const file = loadTransferPartners();
    const issuerIds = ['amex_mr', 'chase_ur', 'bilt', 'capital_one', 'citi_ty', 'wells_fargo'] as const;
    for (const id of issuerIds) {
      const issuer = file[id];
      assert.ok(issuer, `${id} present`);
      for (const partner of Object.values(issuer.airlines)) {
        assert.equal(typeof partner.program, 'string');
        assert.equal(typeof partner.ratio, 'number');
        assert.ok(partner.ratio >= 0, `ratio non-negative for ${partner.program}`);
      }
    }
  });

  it('caches the result across calls (referential equality)', () => {
    resetBorskiCaches();
    const a = loadTransferPartners();
    const b = loadTransferPartners();
    assert.equal(a, b);
  });
});

describe('loadSweetSpots', () => {
  it('parses the file and returns flights[]', () => {
    resetBorskiCaches();
    const file = loadSweetSpots();
    assert.ok(Array.isArray(file.flights));
    assert.ok(file.flights.length > 0, 'flights list non-empty');
  });

  it('every flight sweet spot has name, program, airline, cabin, routes', () => {
    const file = loadSweetSpots();
    for (const f of file.flights) {
      assert.equal(typeof f.name, 'string');
      assert.equal(typeof f.program, 'string');
      assert.equal(typeof f.airline, 'string');
      assert.equal(typeof f.cabin, 'string');
      assert.equal(typeof f.routes, 'object');
      assert.ok(Object.keys(f.routes).length > 0, `routes non-empty for ${f.name}`);
    }
  });

  it('every route has miles >= 0', () => {
    const file = loadSweetSpots();
    for (const f of file.flights) {
      for (const route of Object.values(f.routes)) {
        assert.ok(route.miles >= 0);
      }
    }
  });
});

describe('loadPointsValuations', () => {
  it('returns 3 sections: credit_card_points, airline_miles, hotel_points', () => {
    resetBorskiCaches();
    const file = loadPointsValuations();
    assert.ok(Object.keys(file.credit_card_points).length > 0);
    assert.ok(Object.keys(file.airline_miles).length > 0);
    assert.ok(Object.keys(file.hotel_points).length > 0);
  });

  it('every valuation has floor <= ceiling', () => {
    const file = loadPointsValuations();
    for (const section of [file.credit_card_points, file.airline_miles, file.hotel_points]) {
      for (const [id, v] of Object.entries(section)) {
        assert.ok(v.floor <= v.ceiling, `floor <= ceiling for ${id}`);
      }
    }
  });

  it('amex_membership_rewards has a sane CPP range', () => {
    const file = loadPointsValuations();
    const amex = file.credit_card_points.amex_membership_rewards;
    assert.ok(amex, 'amex_membership_rewards exists');
    assert.ok(amex.floor >= 1.0 && amex.floor <= 3.0);
    assert.ok(amex.ceiling >= amex.floor);
  });
});

describe('loadAlliances', () => {
  it('returns the 3 alliances with members[]', () => {
    resetBorskiCaches();
    const file = loadAlliances();
    for (const key of ['star_alliance', 'oneworld', 'skyteam'] as const) {
      assert.ok(file[key].founded > 1900);
      assert.ok(Array.isArray(file[key].members));
      assert.ok(file[key].members.length > 5, `${key} has members`);
    }
  });

  it('Lufthansa is in star_alliance', () => {
    const file = loadAlliances();
    const lh = file.star_alliance.members.find((m) => m.airline === 'Lufthansa');
    assert.ok(lh, 'Lufthansa found in Star Alliance');
  });
});

describe('loadPartnerAwards', () => {
  it('exposes a non-empty programs map', () => {
    resetBorskiCaches();
    const file = loadPartnerAwards();
    assert.ok(Object.keys(file.programs).length > 0);
  });

  it('every program has display_name and bookable_airlines', () => {
    const file = loadPartnerAwards();
    for (const [id, p] of Object.entries(file.programs)) {
      assert.equal(typeof p.display_name, 'string', `${id} has display_name`);
      assert.equal(typeof p.bookable_airlines, 'object', `${id} has bookable_airlines`);
    }
  });
});

describe('loadHotelChains', () => {
  it('exposes a non-empty chains map', () => {
    resetBorskiCaches();
    const file = loadHotelChains();
    assert.ok(Object.keys(file.chains).length > 0);
  });

  it('Marriott has a loyalty_program of "Marriott Bonvoy"', () => {
    const file = loadHotelChains();
    assert.equal(file.chains.marriott?.loyalty_program, 'Marriott Bonvoy');
  });
});
