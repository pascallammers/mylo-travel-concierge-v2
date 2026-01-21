/**
 * Amex Membership Rewards Transfer Ratios for DACH region (Germany, Austria, Switzerland).
 *
 * IMPORTANT: These ratios differ significantly from US/UK markets where many partners offer 1:1 transfers.
 * In DACH, the standard best ratio is 5:4 (80%), with some partners offering worse rates.
 *
 * Last updated: January 2026
 * Source: americanexpress.com/de-de/rewards/membership-rewards/travel/all
 */

export interface AmexTransferPartner {
  /** Display name of the loyalty program */
  name: string;
  /** Airline or hotel brand */
  brand: string;
  /** Points required from Amex side (numerator) */
  amexPoints: number;
  /** Miles/points received at partner (denominator) */
  partnerMiles: number;
  /** Effective transfer rate as percentage */
  effectiveRate: number;
  /** Minimum points required for transfer */
  minTransfer: number;
  /** Transfer increment (must transfer in multiples of this) */
  transferIncrement: number;
  /** Estimated transfer duration */
  transferDuration: string;
  /** Alliance membership if applicable */
  alliance?: 'Star Alliance' | 'Oneworld' | 'SkyTeam' | null;
  /** Type of program */
  type: 'airline' | 'hotel' | 'other';
  /** Currency unit name */
  currencyUnit: string;
  /** Notes about the program */
  notes?: string;
}

/**
 * All Amex Membership Rewards transfer partners available in Germany.
 * Sorted by effective rate (best first).
 */
export const AMEX_TRANSFER_PARTNERS_DACH: Record<string, AmexTransferPartner> = {
  // Hotels with best rates
  radisson: {
    name: 'Radisson Rewards',
    brand: 'Radisson',
    amexPoints: 1,
    partnerMiles: 2,
    effectiveRate: 200,
    minTransfer: 1000,
    transferIncrement: 2,
    transferDuration: '7 Werktage',
    type: 'hotel',
    currencyUnit: 'Punkte',
  },
  hilton: {
    name: 'Hilton Honors',
    brand: 'Hilton',
    amexPoints: 1,
    partnerMiles: 1,
    effectiveRate: 100,
    minTransfer: 2500,
    transferIncrement: 25,
    transferDuration: 'bis zu 1 Werktag',
    type: 'hotel',
    currencyUnit: 'Punkte',
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
    transferDuration: 'bis zu 1 Werktag',
    alliance: 'SkyTeam',
    type: 'airline',
    currencyUnit: 'Meilen',
    notes: 'Oft Transfer in Echtzeit. Promo Rewards bieten oft 50% Rabatt auf Award-Flüge.',
  },
  britishAirways: {
    name: 'British Airways Executive Club',
    brand: 'British Airways',
    amexPoints: 5,
    partnerMiles: 4,
    effectiveRate: 80,
    minTransfer: 1000,
    transferIncrement: 5,
    transferDuration: 'bis zu 1 Werktag',
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: 'Avios',
    notes: 'Sehr gut für Kurzstreckenflüge innerhalb Europas.',
  },
  iberia: {
    name: 'Iberia Plus',
    brand: 'Iberia',
    amexPoints: 5,
    partnerMiles: 4,
    effectiveRate: 80,
    minTransfer: 1000,
    transferIncrement: 500,
    transferDuration: 'bis zu 1 Werktag',
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: 'Avios',
    notes: 'Sehr attraktiv für Business Class Flüge in die USA (Off-Peak ab 34.000 Avios OW).',
  },
  sasEurobonus: {
    name: 'SAS EuroBonus',
    brand: 'SAS Scandinavian Airlines',
    amexPoints: 5,
    partnerMiles: 4,
    effectiveRate: 80,
    minTransfer: 1000,
    transferIncrement: 500,
    transferDuration: '5 Werktage',
    alliance: 'SkyTeam',
    type: 'airline',
    currencyUnit: 'Punkte',
    notes: 'SAS ist seit 2024 SkyTeam Mitglied (vorher Star Alliance).',
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
    transferDuration: '3 Werktage',
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: 'Miles',
    notes: 'Abgewertet am 01.08.2025 von 5:4 auf 3:2. Gut für Oneworld Partner wie Qatar QSuites.',
  },
  singaporeKrisflyer: {
    name: 'Singapore Airlines KrisFlyer',
    brand: 'Singapore Airlines',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 1500,
    transferIncrement: 3,
    transferDuration: 'bis zu 15 Werktage',
    alliance: 'Star Alliance',
    type: 'airline',
    currencyUnit: 'Meilen',
    notes: 'Einziger Weg, Singapore Airlines Suites/First Class mit Meilen zu buchen.',
  },
  qatarPrivilegeClub: {
    name: 'Qatar Airways Privilege Club',
    brand: 'Qatar Airways',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 900,
    transferIncrement: 3,
    transferDuration: '7 Werktage',
    alliance: 'Oneworld',
    type: 'airline',
    currencyUnit: 'Avios',
    notes: 'Abgewertet am 01.08.2025 von 5:4 auf 3:2. Avios-Familie mit BA/Iberia.',
  },
  etihadGuest: {
    name: 'Etihad Guest',
    brand: 'Etihad Airways',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 900,
    transferIncrement: 300,
    transferDuration: '5 Werktage',
    alliance: null,
    type: 'airline',
    currencyUnit: 'Meilen',
    notes: 'Abgewertet am 01.08.2025 von 5:4 auf 3:2. Dynamische Bepreisung macht Awards teuer.',
  },
  deltaSkyMiles: {
    name: 'Delta SkyMiles',
    brand: 'Delta Air Lines',
    amexPoints: 3,
    partnerMiles: 2,
    effectiveRate: 66.7,
    minTransfer: 3000,
    transferIncrement: 3,
    transferDuration: '5 Werktage',
    alliance: 'SkyTeam',
    type: 'airline',
    currencyUnit: 'Meilen',
    notes: 'Dynamische Bepreisung. Economy oft OK, Business meist überteuert.',
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
    transferDuration: 'bis zu 1 Werktag',
    type: 'hotel',
    currencyUnit: 'Punkte',
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
    transferDuration: 'bis zu 1 Werktag',
    alliance: null,
    type: 'airline',
    currencyUnit: 'Meilen',
    notes:
      'STARK ABGEWERTET am 01.08.2025 von 5:4 auf 2:1! Emirates First Class nur mit Status buchbar. Hohe Treibstoffzuschläge. Nicht empfehlenswert.',
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
    transferDuration: '2 Werktage',
    type: 'other',
    currencyUnit: 'Punkte',
    notes:
      'Indirekter Weg zu Miles & More: MR -> PAYBACK (3:1) -> Miles & More (1:1). 2x jährlich bis zu 25% Transferbonus zu M&M.',
  },
};

/**
 * Calculate how many Amex MR points are needed for a target amount of partner miles.
 * @param partnerId - The partner ID from AMEX_TRANSFER_PARTNERS_DACH
 * @param targetMiles - Desired miles/points at the partner program
 * @returns Number of Amex MR points required
 */
export function calculateRequiredAmexPoints(partnerId: string, targetMiles: number): number | null {
  const partner = AMEX_TRANSFER_PARTNERS_DACH[partnerId];
  if (!partner) return null;

  return Math.ceil((targetMiles * partner.amexPoints) / partner.partnerMiles);
}

/**
 * Calculate how many partner miles you get from Amex MR points.
 * @param partnerId - The partner ID from AMEX_TRANSFER_PARTNERS_DACH
 * @param amexPoints - Number of Amex MR points to transfer
 * @returns Number of miles/points received at partner
 */
export function calculatePartnerMiles(partnerId: string, amexPoints: number): number | null {
  const partner = AMEX_TRANSFER_PARTNERS_DACH[partnerId];
  if (!partner) return null;

  return Math.floor((amexPoints * partner.partnerMiles) / partner.amexPoints);
}

/**
 * Get partners sorted by effective rate (best first).
 */
export function getPartnersByEffectiveRate(): AmexTransferPartner[] {
  return Object.values(AMEX_TRANSFER_PARTNERS_DACH).sort(
    (a, b) => b.effectiveRate - a.effectiveRate
  );
}

/**
 * Get airline partners only.
 */
export function getAirlinePartners(): AmexTransferPartner[] {
  return Object.values(AMEX_TRANSFER_PARTNERS_DACH).filter((p) => p.type === 'airline');
}

/**
 * Format transfer ratio as human-readable string.
 */
export function formatTransferRatio(partner: AmexTransferPartner): string {
  return `${partner.amexPoints}:${partner.partnerMiles} (${partner.effectiveRate}%)`;
}
