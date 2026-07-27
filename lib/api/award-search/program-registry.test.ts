/**
 * Unit tests for the seats.aero program-name registry.
 *
 * Maps the mileage-program SLUG (from trip.Source) to a customer-facing
 * display name. Slugs are the real seats.aero Source values, harvested live
 * from /partnerapi/search across diverse long-haul routes (aeroplan, united,
 * lufthansa, flyingblue, ...). Unknown slugs degrade to a Title-Cased label
 * plus a console warning rather than leaking a raw slug or inventing a brand.
 */

import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import {
  getProgramBookingUrl,
  getProgramCaveat,
  getProgramDisplayName,
  KNOWN_PROGRAM_SLUGS,
} from './program-registry';

describe('getProgramDisplayName', () => {
  it('maps the three MUC->MIA regression programs to brand names', () => {
    assert.strictEqual(getProgramDisplayName('aeroplan', 'de'), 'Air Canada Aeroplan');
    assert.strictEqual(getProgramDisplayName('lufthansa', 'de'), 'Lufthansa Miles & More');
    assert.strictEqual(getProgramDisplayName('united', 'de'), 'United MileagePlus');
  });

  it('serves both locales for the same slug', () => {
    assert.strictEqual(getProgramDisplayName('flyingblue', 'en'), 'Flying Blue (Air France/KLM)');
  });

  it('covers at least 25 known seats.aero source slugs', () => {
    assert.ok(
      KNOWN_PROGRAM_SLUGS.length >= 25,
      `expected >=25 mapped programs, got ${KNOWN_PROGRAM_SLUGS.length}`,
    );
    // Every advertised slug must actually resolve (guards typos in the table).
    for (const slug of KNOWN_PROGRAM_SLUGS) {
      assert.ok(getProgramDisplayName(slug, 'de'), `slug ${slug} must resolve in de`);
      assert.ok(getProgramDisplayName(slug, 'en'), `slug ${slug} must resolve in en`);
    }
  });

  it('returns an empty label for a missing slug without throwing', () => {
    assert.doesNotThrow(() => getProgramDisplayName('', 'de'));
    assert.strictEqual(getProgramDisplayName('', 'de'), '');
    assert.strictEqual(getProgramDisplayName(undefined as unknown as string, 'de'), '');
  });

  it('Title-Cases an unknown slug and warns instead of leaking the raw slug', () => {
    const warn = mock.method(console, 'warn', () => {});
    try {
      assert.strictEqual(getProgramDisplayName('madeupprogram', 'de'), 'Madeupprogram');
      assert.strictEqual(warn.mock.callCount(), 1, 'unknown slug must emit one warning');
    } finally {
      warn.mock.restore();
    }
  });
});

describe('getProgramCaveat', () => {
  it('returns the KrisFlyer search-lock caveat incl. workarounds for singapore (de)', () => {
    const caveat = getProgramCaveat('singapore', 'de');
    assert.ok(caveat, 'singapore must have a caveat');
    // The July 2026 lock: no award search below ~1,000 miles balance.
    assert.match(caveat!, /1\.000 Meilen/);
    assert.match(caveat!, /Award-Suche/i);
    // All three known workarounds must be mentioned.
    assert.match(caveat!, /Marriott Bonvoy/);
    assert.match(caveat!, /App/);
    assert.match(caveat!, /[Tt]elefon/);
  });

  it('returns the login + Classic-Rewards-checkbox caveat for emirates (de)', () => {
    const caveat = getProgramCaveat('emirates', 'de');
    assert.ok(caveat, 'emirates must have a caveat');
    assert.match(caveat!, /eingeloggt/i);
    assert.match(caveat!, /Classic Rewards/);
    assert.match(caveat!, /Search partner flights only/);
    assert.match(caveat!, /finden Sie/);
    assert.doesNotMatch(caveat!, /findest du/i);
  });

  it('serves the en locale for both caveat programs', () => {
    assert.match(getProgramCaveat('singapore', 'en')!, /1,000 miles/);
    assert.match(getProgramCaveat('emirates', 'en')!, /Classic Rewards/);
  });

  it('returns null for programs without known website caveats', () => {
    assert.strictEqual(getProgramCaveat('lufthansa', 'de'), null);
    assert.strictEqual(getProgramCaveat('aeroplan', 'en'), null);
    assert.strictEqual(getProgramCaveat('madeupprogram', 'de'), null);
    assert.strictEqual(getProgramCaveat('', 'de'), null);
  });
});

describe('getProgramBookingUrl', () => {
  const ctx = {
    origin: 'FRA',
    destination: 'JFK',
    departDate: '2026-06-15',
    cabin: 'Business',
  };

  it('builds a prefilled united.com award deeplink (route + date + cabin, one-way, award toggle)', () => {
    assert.strictEqual(
      getProgramBookingUrl('united', ctx),
      'https://www.united.com/en/us/fsr/choose-flights?f=FRA&t=JFK&d=2026-06-15&tt=1&at=1&px=1&taxng=1&idx=1&tqp=A&clm=4',
    );
  });

  it('maps all supported United cabin classes and ignores unknown values', () => {
    const cabinCodes = [
      ['Economy', '7'],
      ['Premium Economy', '6'],
      ['Business', '4'],
      ['First', '3'],
    ] as const;

    for (const [cabin, code] of cabinCodes) {
      const url = getProgramBookingUrl('united', { ...ctx, cabin });
      assert.match(url ?? '', new RegExp(`[?&]clm=${code}(?:&|$)`));
    }

    const unknownCabinUrl = getProgramBookingUrl('united', {
      ...ctx,
      cabin: 'constructor',
    });
    assert.doesNotMatch(unknownCabinUrl ?? '', /[?&]clm=/);
  });

  it('builds prefilled deeplinks for aeroplan, alaska and jetblue', () => {
    assert.strictEqual(
      getProgramBookingUrl('aeroplan', ctx),
      'https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=FRA&dest0=JFK&departureDate0=2026-06-15&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&marketCode=INT',
    );
    assert.strictEqual(
      getProgramBookingUrl('alaska', ctx),
      'https://www.alaskaair.com/search/results?A=1&O=FRA&D=JFK&OD=2026-06-15&RT=false&ShoppingMethod=onlineaward',
    );
    assert.strictEqual(
      getProgramBookingUrl('jetblue', ctx),
      'https://www.jetblue.com/booking/flights?from=FRA&to=JFK&depart=2026-06-15&adults=1&usePoints=true',
    );
  });

  it('falls back to the program award-search page when no deeplink template exists', () => {
    assert.strictEqual(
      getProgramBookingUrl('lufthansa', ctx),
      'https://www.miles-and-more.com/de/en/spend/flights.html',
    );
    assert.strictEqual(
      getProgramBookingUrl('singapore', ctx),
      'https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/use-miles/',
    );
    assert.strictEqual(
      getProgramBookingUrl('flyingblue', ctx),
      'https://www.flyingblue.com/en/earn-spend/flights/award-search',
    );
    assert.strictEqual(
      getProgramBookingUrl('qantas', ctx),
      'https://flightrewardfinder.qantas.com/',
    );
  });

  it('resolves EVERY known slug to an https URL that never points at seats.aero', () => {
    for (const slug of KNOWN_PROGRAM_SLUGS) {
      const url = getProgramBookingUrl(slug, ctx);
      assert.ok(url, `slug ${slug} must resolve to a booking URL`);
      assert.match(url!, /^https:\/\//, `slug ${slug} must be an https URL`);
      assert.doesNotMatch(url!, /seats\.aero/i, `slug ${slug} must not link to seats.aero`);
    }
  });

  it('returns null for unknown or empty slugs instead of inventing a URL', () => {
    assert.strictEqual(getProgramBookingUrl('madeupprogram', ctx), null);
    assert.strictEqual(getProgramBookingUrl('', ctx), null);
  });

  it('treats inherited object properties as unknown slugs without throwing', () => {
    for (const slug of ['__proto__', 'constructor', 'toString']) {
      assert.doesNotThrow(() => getProgramBookingUrl(slug, ctx));
      assert.strictEqual(getProgramBookingUrl(slug, ctx), null);
    }
  });

  it('encodes reserved characters in deeplink query parameters', () => {
    const maliciousCtx = {
      origin: 'FRA&evil=1',
      destination: 'JFK) [Weiter](https://evil.example)',
      departDate: '2026-06-15&hack=1',
      cabin: 'Business',
    };
    const url = getProgramBookingUrl('united', maliciousCtx);
    assert.ok(url);
    assert.match(url!, /^https:\/\/www\.united\.com\//);
    assert.doesNotMatch(url!, /\[Weiter\]/, 'markdown link syntax must not survive in the URL');
    assert.match(url!, /f=FRA%26evil%3D1/);
    assert.match(url!, /t=JFK%29\+/);
    assert.match(url!, /%5BWeiter%5D%28https%3A%2F%2Fevil\.example%29/);
    assert.match(url!, /d=2026-06-15%26hack%3D1/);
  });
});
