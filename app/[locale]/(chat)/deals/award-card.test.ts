import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import { buildDealsPageModel, type DealsPageModelDeal } from '@/lib/deals/deals-page-model';
import { DealCard } from './components/deal-card';
import { UnreachableDealsToggle } from './components/unreachable-deals-toggle';

const now = new Date('2026-09-23T12:00:00Z');
const award: DealsPageModelDeal = {
  id: 'award', source: 'seats_aero', origin: 'FRA', destination: 'JFK', destinationName: 'New York',
  departureDate: new Date('2026-10-01'), returnDate: null, price: 60_000, currency: 'PTS',
  cabinClass: 'business', averagePrice: null, priceChangePercent: 50, dealScore: 90,
  personalizedScore: null, personalizationReasons: ['Ab deinem Heimatflughafen'], airline: 'Lufthansa',
  flightDurationMinutes: 480, affiliateLink: null, stops: 0, tripType: 'oneway', createdAt: now,
  updatedAt: now, preferredOriginMatch: true, programId: 'lufthansa', programReachableDach: true,
  taxesEur: 480, seatsLeft: 1, cashReferencePrice: 1740, cashReferenceSamples: 3,
  valuationRateCt: 1.7, valuationRateValidFrom: new Date('2026-09-01'), savingsPercent: 30,
};

function model(deal: DealsPageModelDeal) {
  return buildDealsPageModel({
    deals: [deal], filters: { kind: deal.source === 'seats_aero' ? 'award' : 'cash', origins: [], sort: 'score' }, now,
    awardContext: {
      ownBalanceProgramIds: new Set(), resolveProgramName: () => 'Miles & More',
      resolveDachRoute: () => ({ label: 'PAYBACK 1:1' }),
    },
  });
}

function renderCard(overrides: Partial<DealsPageModelDeal> = {}, locale: 'de' | 'en' = 'de', showAvailabilityCheck = false) {
  const data = model({ ...award, ...overrides });
  return renderToStaticMarkup(createElement(NextIntlClientProvider, {
    locale, messages: locale === 'de' ? de : en, timeZone: 'UTC',
  }, createElement(DealCard, { deal: [...data.deals, ...data.unreachableDeals][0], locale, showScore: true, showAvailabilityCheck })))
    .replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('\u00a0', ' ');
}

test('award card displays miles, surcharges, sampled cash price, route and the dated seal in German', () => {
  const html = renderCard();
  for (const expected of [
    '60.000 Meilen', '+ 480 € Zuschläge', 'statt Ø 1.740 € bar', 'Miles & More', 'per PAYBACK 1:1',
    'noch 1 Sitz', '2,1 ct pro Meile · üblich 1,7 ct', 'über dem üblichen Reisewert',
    'Üblicher Reisewert 1,7 ct pro Meile, Satz gültig seit September 2026',
    'Zuletzt gesehen: gerade eben', 'Passt zu dir:', 'Mit MYLO prüfen', '/de/new?prefill=',
  ]) assert.ok(html.includes(expected), expected);
  assert.ok(!html.includes('AI Deal Score'));
  assert.ok(!html.includes('Ersparnis'));
});

test('the common variant without a cash reference keeps the costs and omits the entire seal', () => {
  const html = renderCard({ cashReferenceSamples: 2, seatsLeft: 2 });
  assert.ok(html.includes('60.000 Meilen'));
  assert.ok(html.includes('+ 480 € Zuschläge'));
  assert.ok(html.includes('noch 2 Sitze'));
  assert.ok(!html.includes('statt Ø'));
  assert.ok(!html.includes('ct pro Meile'));
  assert.ok(!html.includes('Satz gültig'));
});

test('unreachable cards have the grey notice and no seal despite complete comparison inputs', () => {
  const html = renderCard({ programReachableDach: false });
  assert.ok(html.includes('Nur mit vorhandenen Meilen buchbar'));
  assert.ok(html.includes('statt Ø'));
  assert.ok(!html.includes('ct pro Meile'));
});

test('English prices, cents, dates and seat plurals are localized', () => {
  const html = renderCard({ seatsLeft: 2 }, 'en');
  for (const expected of ['60,000 miles', '€480 surcharges', '2 seats left', '2.1 ct per mile', 'September 2026']) {
    assert.ok(html.includes(expected), expected);
  }
  assert.ok(renderCard({}, 'en').includes('1 seat left'));
});

test('cash cards retain their score and savings', () => {
  const html = renderCard({ source: 'travelpayouts', currency: 'EUR', price: 300, averagePrice: 600 });
  assert.ok(html.includes('AI Deal Score'));
  assert.ok(html.includes('Ersparnis'));
  assert.ok(html.includes('line-through'));
  assert.ok(!html.includes('Meilen'));
  assert.ok(!html.includes('ct pro Meile'));
});

function renderToggle(defaultOpen: boolean) {
  const data = model({ ...award, programReachableDach: false });
  return renderToStaticMarkup(createElement(NextIntlClientProvider, {
    locale: 'de', messages: de, timeZone: 'UTC',
  }, createElement(UnreachableDealsToggle, { deals: data.unreachableDeals, defaultOpen, locale: 'de', showFreshLabel: true })));
}

test('the unreachable group starts collapsed and exposes its count on the trigger', () => {
  const html = renderToggle(false);
  assert.ok(html.includes('Auch Programme ohne DACH-Transferweg zeigen (1)'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(!html.includes('60.000 Meilen'));
});

test('the unreachable group starts open when it is the only content of the tab', () => {
  const html = renderToggle(true);
  assert.ok(html.includes('aria-expanded="true"'));
  assert.ok(html.includes('60.000 Meilen'));
  assert.ok(html.includes('Nur mit vorhandenen Meilen buchbar'));
});


test('shell award cards open a ready mask with the deal program and keep chat second', () => {
  const html = renderCard({}, 'de', true);
  assert.ok(html.includes('/de/flights?from=FRA&to=JFK&date=2026-10-01&flex=3&program=lufthansa'));
  assert.ok(html.includes('Verfügbarkeit jetzt prüfen'));
  assert.ok(html.indexOf('/de/flights?') < html.indexOf('/de/new?prefill='));
  assert.ok(!renderCard().includes('/de/flights?'));
  assert.ok(renderCard({}, 'en', true).includes('Check availability now'));
});

test('cash cards keep their existing actions even for shell users', () => {
  const html = renderCard({ source: 'travelpayouts', currency: 'EUR', price: 300, averagePrice: 600 }, 'de', true);
  assert.ok(!html.includes('/de/flights?'));
  assert.ok(html.includes('/de/new?prefill='));
});
