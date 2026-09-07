/**
 * DACH transfer partners: German American Express Membership Rewards and
 * PAYBACK Germany.
 *
 * IMPORTANT: These ratios differ significantly from US/UK markets where many
 * partners offer 1:1. In DACH, the standard best ratio is 5:4 (80%), with some
 * partners offering worse rates. Austrian and Swiss Amex cards run their own
 * partner tables and are not modelled here.
 *
 * Table date: `DACH_TRANSFER_TABLE_AS_OF` (single source of truth; tools quote
 * it in their answers).
 * Sources:
 * - americanexpress.com/de-de/rewards/membership-rewards/travel/all
 * - payback.de/partner/miles-and-more and payback.de/faq/miles-and-more-abo
 *
 * Changes since January 2026 (MYLO-51):
 * - Etihad Guest removed: Amex DE ended the transfer on 2026-06-15.
 * - ALL Accor added: Amex DE partner since 2026-07-06 (3:1).
 * - British Airways Executive Club and Iberia Plus renamed to British Airways
 *   Club and Iberia Club (the programs renamed themselves; Amex lists the new
 *   names).
 * - PAYBACK -> Miles & More modelled as its own source program.
 */

import type { PartnerMap } from './types';

/**
 * Month the DACH tables (Amex DE and PAYBACK) were last verified against the
 * sources above. Format `YYYY-MM`.
 */
export const DACH_TRANSFER_TABLE_AS_OF = '2026-09';

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
    name: 'British Airways Club',
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
      de: 'Früher „Executive Club“. Sehr gut für Kurzstreckenflüge innerhalb Europas.',
      en: 'Formerly "Executive Club". Excellent for short-haul flights within Europe.',
    },
  },
  iberia: {
    name: 'Iberia Club',
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
      de: 'Früher „Iberia Plus“. Sehr attraktiv für Business Class Flüge in die USA (Off-Peak ab 34.000 Avios OW).',
      en: 'Formerly "Iberia Plus". Very attractive for Business Class flights to the US (off-peak from 34,000 Avios OW).',
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

  // Hotels with 3:1 ratio
  accor: {
    name: 'ALL Accor',
    brand: 'Accor',
    amexPoints: 3,
    partnerMiles: 1,
    effectiveRate: 33.3,
    minTransfer: 900,
    transferIncrement: 3,
    transferDuration: { de: 'bis zu 1 Werktag', en: 'up to 1 business day' },
    type: 'hotel',
    currencyUnit: { de: 'Punkte', en: 'Points' },
    notes: {
      de: 'Neuer Partner seit 06.07.2026 (nur Amex Deutschland). Fester Gegenwert: 2.000 ALL-Punkte = 40 € Hotelrechnung, also ca. 0,67 ct pro MR-Punkt.',
      en: 'New partner since 06.07.2026 (Amex Germany only). Fixed value: 2,000 ALL points = EUR 40 off a hotel bill, about 0.67 cents per MR point.',
    },
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

  // PAYBACK (indirect Miles & More, see PAYBACK_DACH_PARTNERS for the second hop)
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
      de: 'Indirekter Weg zu Miles & More: MR -> PAYBACK (3:1) -> Miles & More (1:1), effektiv 3 MR pro Meile. Nur ein Transfer pro Tag. PAYBACK-Transferbonus zu M&M 1–2x jährlich (zuletzt 10 % im Juli 2026, 25 % im Januar 2026).',
      en: 'Indirect route to Miles & More: MR -> PAYBACK (3:1) -> Miles & More (1:1), effectively 3 MR per mile. One transfer per day. PAYBACK transfer bonus to M&M 1-2x per year (most recently 10% in July 2026, 25% in January 2026).',
    },
  },
};

/**
 * PAYBACK Germany transfer partners. PAYBACK itself is a source program here:
 * customers hold PAYBACK points (from shopping, the PAYBACK Amex, or an Amex
 * MR transfer) and convert them 1:1 into Miles & More.
 */
export const PAYBACK_DACH_PARTNERS: PartnerMap = {
  milesAndMore: {
    name: 'Miles & More',
    brand: 'Lufthansa Group',
    amexPoints: 1,
    partnerMiles: 1,
    effectiveRate: 100,
    minTransfer: 200,
    transferIncrement: 1,
    transferDuration: { de: 'bis zu 5 Werktage', en: 'up to 5 business days' },
    alliance: 'Star Alliance',
    type: 'airline',
    currencyUnit: { de: 'Meilen', en: 'Miles' },
    notes: {
      de: 'Jederzeit manuell oder per Meilen-Abo (März und September automatisch). Max. 999.999 Punkte je Transaktion, keine Rückbuchung. Transferbonus 1–2x jährlich (zuletzt 10 % im Juli 2026, 25 % im Januar 2026).',
      en: 'Manual any time or via the miles subscription (automatic in March and September). Max. 999,999 points per transaction, no reversal. Transfer bonus 1-2x per year (most recently 10% in July 2026, 25% in January 2026).',
    },
  },
};
