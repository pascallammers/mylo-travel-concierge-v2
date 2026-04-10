import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { PresentedDeal } from '@/lib/deals';
import { buildProactiveDealPrompt } from './proactive-deal-prompt';

function createDeal(overrides: Partial<PresentedDeal> = {}): PresentedDeal {
  return {
    id: 'deal-1',
    origin: 'FRA',
    destination: 'JFK',
    destinationName: 'New York',
    departureDate: new Date('2026-05-01T10:00:00.000Z'),
    returnDate: new Date('2026-05-09T10:00:00.000Z'),
    price: 450,
    averagePrice: 720,
    priceDifference: 270,
    priceChangePercent: 38,
    dealScore: 88,
    personalizedScore: 96,
    personalizationReasons: ['Abflug ab FRA'],
    cabinClass: 'business',
    airline: 'Lufthansa',
    source: 'travelpayouts',
    flightDurationMinutes: 480,
    currency: 'EUR',
    affiliateLink: null,
    stops: 0,
    tripType: 'roundtrip',
    updatedAt: new Date('2026-04-10T10:00:00.000Z'),
    routeDistanceKm: 6200,
    priceHistoryStats: { min: 430, max: 980, count: 18 },
    bucket: 'long_haul',
    insight: {
      why: '38% guenstiger als ueblich.',
      forWhom: 'Perfekt fuer Fernreise-Entdecker.',
      recommendation: {
        kind: 'book',
        confidence: 88,
      },
    },
    priceHistoryBar: {
      visible: true,
      percent: 14,
      tone: 'good',
    },
    ...overrides,
  };
}

describe('buildProactiveDealPrompt', () => {
  it('baut einen proaktiven Chat-Starter aus dem empfohlenen Deal', () => {
    const prompt = buildProactiveDealPrompt(createDeal(), 'de');

    assert.match(prompt, /New York ab FRA/i);
    assert.match(prompt, /Abflug ab FRA/i);
    assert.match(prompt, /guter Deal fuer mich/i);
  });
});
