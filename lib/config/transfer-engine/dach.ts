/**
 * DACH region (Germany, Austria, Switzerland) transfer partners.
 *
 * Currently sources: American Express Membership Rewards Germany.
 *
 * IMPORTANT: These ratios differ significantly from US/UK markets where many partners offer 1:1.
 * In DACH, the standard best ratio is 5:4 (80%), with some partners offering worse rates.
 *
 * Last updated: January 2026
 * Source: americanexpress.com/de-de/rewards/membership-rewards/travel/all
 */

import type { PartnerMap } from './types';

/**
 * Amex Membership Rewards transfer partners available in Germany.
 * Sorted by effective rate (best first).
 */
export const AMEX_DACH_PARTNERS: PartnerMap = {
  radisson: {
    name: 'Radisson Rewards',
    brand: 'Radisson',
    amexPoints: 1,
    partnerMiles: 2,
    effectiveRate: 200,
    minTransfer: 1000,
    transferIncrement: 2,
    transferDuration: { de: '7 Werktage', en: '7 business days' },
    type: 'hotel',
    currencyUnit: { de: 'Punkte', en: 'Points' },
  },
  hilton: {
    name: 'Hilton Honors',
    brand: 'Hilton',
    amexPoints: 1,
    partnerMiles: 1,
    effectiveRate: 100,
    minTransfer: 2500,
    transferIncrement: 25,
    transferDuration: { de: 'bis zu 1 Werktag', en: 'up to 1 business day' },
    type: 'hotel',
    currencyUnit: { de: 'Punkte', en: 'Points' },
  },

  // Airlines with 5:4 ratio (best airline rate in DACH)
  flyingBlue: {
    name: 'Flying Blue',
    brand: 'Air France / KLM',
    amexPoints: 5,
    partnerMiles: 4,
    effectiveRate: 80,
    minTransfer: 625,
    transferIncrement: 5,
    transferDuration: { de: 'bis zu 1 Werktag', en: 'up to 1 business day' },
    alliance: 'SkyTeam',
    type: 'airline',
    currencyUnit: { de: 'Meilen', en: 'Miles' },
    notes: {
      de: 'Oft Transfer in Echtzeit. Promo Rewards bieten oft 50% Rabatt auf Award-Flüge.',
      en: 'Often instant transfer. Promo Rewards frequently offer 50% off award flights.',
    },
  },
  britishAirways: {
    name: 'British Airways Executive Club',
    brand: 'British Airways',
    amexPoints: 5,
    partnerMiles: 4,
    effectiveRate: 80,
    minTransfer: 1000,
    transferIncrement: 5,
    transferDuration: { de: 'bis zu 1 Werktag', en: 'up to 1 business day' },
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: { de: 'Avios', en: 'Avios' },
    notes: {
      de: 'Sehr gut für Kurzstreckenflüge innerhalb Europas.',
      en: 'Excellent for short-haul flights within Europe.',
    },
  },
  iberia: {
    name: 'Iberia Plus',
    brand: 'Iberia',
    amexPoints: 5,
    partnerMiles: 4,
    effectiveRate: 80,
    minTransfer: 1000,
    transferIncrement: 500,
    transferDuration: { de: 'bis zu 1 Werktag', en: 'up to 1 business day' },
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: { de: 'Avios', en: 'Avios' },
    notes: {
      de: 'Sehr attraktiv für Business Class Flüge in die USA (Off-Peak ab 34.000 Avios OW).',
      en: 'Very attractive for Business Class flights to the US (off-peak from 34,000 Avios OW).',
    },
  },
  sasEurobonus: {
    name: 'SAS EuroBonus',
    brand: 'SAS Scandinavian Airlines',
    amexPoints: 5,
    partnerMiles: 4,
    effectiveRate: 80,
    minTransfer: 1000,
    transferIncrement: 500,
    transferDuration: { de: '5 Werktage', en: '5 business days' },
    alliance: 'SkyTeam',
    type: 'airline',
    currencyUnit: { de: 'Punkte', en: 'Points' },
    notes: {
      de: 'SAS ist seit 2024 SkyTeam Mitglied (vorher Star Alliance).',
      en: 'SAS joined SkyTeam in 2024 (previously Star Alliance).',
    },
  },

  // Airlines with 3:2 ratio
  cathay: {
    name: 'Cathay',
    brand: 'Cathay Pacific',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 900,
    transferIncrement: 300,
    transferDuration: { de: '3 Werktage', en: '3 business days' },
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: { de: 'Miles', en: 'Miles' },
    notes: {
      de: 'Abgewertet am 01.08.2025 von 5:4 auf 3:2. Gut für Oneworld Partner wie Qatar QSuites.',
      en: 'Devalued on 01.08.2025 from 5:4 to 3:2. Good for Oneworld partners like Qatar QSuites.',
    },
  },
  singaporeKrisflyer: {
    name: 'Singapore Airlines KrisFlyer',
    brand: 'Singapore Airlines',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 1500,
    transferIncrement: 3,
    transferDuration: { de: 'bis zu 15 Werktage', en: 'up to 15 business days' },
    alliance: 'Star Alliance',
    type: 'airline',
    currencyUnit: { de: 'Meilen', en: 'Miles' },
    notes: {
      de: 'Einziger Weg, Singapore Airlines Suites/First Class mit Meilen zu buchen.',
      en: 'Only way to book Singapore Airlines Suites/First Class with miles.',
    },
  },
  qatarPrivilegeClub: {
    name: 'Qatar Airways Privilege Club',
    brand: 'Qatar Airways',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 900,
    transferIncrement: 3,
    transferDuration: { de: '7 Werktage', en: '7 business days' },
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: { de: 'Avios', en: 'Avios' },
    notes: {
      de: 'Abgewertet am 01.08.2025 von 5:4 auf 3:2. Avios-Familie mit BA/Iberia.',
      en: 'Devalued on 01.08.2025 from 5:4 to 3:2. Avios family with BA/Iberia.',
    },
  },
  etihadGuest: {
    name: 'Etihad Guest',
    brand: 'Etihad Airways',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 900,
    transferIncrement: 300,
    transferDuration: { de: '5 Werktage', en: '5 business days' },
    alliance: null,
    type: 'airline',
    currencyUnit: { de: 'Meilen', en: 'Miles' },
    notes: {
      de: 'Abgewertet am 01.08.2025 von 5:4 auf 3:2. Dynamische Bepreisung macht Awards teuer.',
      en: 'Devalued on 01.08.2025 from 5:4 to 3:2. Dynamic pricing makes awards expensive.',
    },
  },
  deltaSkyMiles: {
    name: 'Delta SkyMiles',
    brand: 'Delta Air Lines',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 3000,
    transferIncrement: 3,
    transferDuration: { de: '5 Werktage', en: '5 business days' },
    alliance: 'SkyTeam',
    type: 'airline',
    currencyUnit: { de: 'Meilen', en: 'Miles' },
    notes: {
      de: 'Dynamische Bepreisung. Economy oft OK, Business meist überteuert.',
      en: 'Dynamic pricing. Economy often OK, Business usually overpriced.',
    },
  },

  // Hotels with 3:2 ratio
  marriottBonvoy: {
    name: 'Marriott Bonvoy',
    brand: 'Marriott',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 900,
    transferIncrement: 3,
    transferDuration: { de: 'bis zu 1 Werktag', en: 'up to 1 business day' },
    type: 'hotel',
    currencyUnit: { de: 'Punkte', en: 'Points' },
  },

  // Worst rate - Emirates
  emiratesSkywards: {
    name: 'Emirates Skywards',
    brand: 'Emirates',
    amexPoints: 2,
    partnerMiles: 1,
    effectiveRate: 50,
    minTransfer: 1000,
    transferIncrement: 2,
    transferDuration: { de: 'bis zu 1 Werktag', en: 'up to 1 business day' },
    alliance: null,
    type: 'airline',
    currencyUnit: { de: 'Meilen', en: 'Miles' },
    notes: {
      de: 'STARK ABGEWERTET am 01.08.2025 von 5:4 auf 2:1! Emirates First Class nur mit Status buchbar. Hohe Treibstoffzuschläge. Nicht empfehlenswert.',
      en: 'HEAVILY DEVALUED on 01.08.2025 from 5:4 to 2:1! Emirates First Class only bookable with status. High fuel surcharges. Not recommended.',
    },
  },

  // PAYBACK (indirect Miles & More)
  payback: {
    name: 'PAYBACK',
    brand: 'PAYBACK (-> Miles & More)',
    amexPoints: 3,
    partnerMiles: 1,
    effectiveRate: 33.3,
    minTransfer: 900,
    transferIncrement: 3,
    transferDuration: { de: '2 Werktage', en: '2 business days' },
    type: 'other',
    currencyUnit: { de: 'Punkte', en: 'Points' },
    notes: {
      de: 'Indirekter Weg zu Miles & More: MR -> PAYBACK (3:1) -> Miles & More (1:1). 2x jährlich bis zu 25% Transferbonus zu M&M.',
      en: 'Indirect route to Miles & More: MR -> PAYBACK (3:1) -> Miles & More (1:1). 2x per year up to 25% transfer bonus to M&M.',
    },
  },
};
