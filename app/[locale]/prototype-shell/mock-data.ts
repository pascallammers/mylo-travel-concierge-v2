/**
 * PROTOTYP (MYLO-30) — Wegwerf-Code, nicht in main folden.
 *
 * Realistische Mock-Daten für Landing + Shell. Bewusst keine DB-Abfrage:
 * die Route soll ohne Login, ohne Seed und ohne Cron laufen.
 * Zahlen sind an den echten Scanner-Output angelehnt (DACH-Origins,
 * seats.aero-Award-Deals, Ø-Barpreis aus priceHistory).
 */

export interface MockDeal {
  id: string;
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  country: string;
  /** Punkte für Award-Deals, null bei reinen Cash-Deals */
  points: number | null;
  program: string | null;
  /** Steuern/Zuschläge in EUR — heute NICHT in der DB (siehe MYLO-35) */
  taxes: number;
  /** Ø Barpreis derselben Route aus priceHistory */
  cashAvg: number;
  cabin: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  airline: string;
  month: string;
  stops: number;
  score: number;
  tripType: 'roundtrip' | 'oneway';
  /** true = öffentlich sichtbar, false = hinter der Paywall */
  publicTile: boolean;
}

export const MOCK_DEALS: MockDeal[] = [
  {
    id: 'fra-bkk',
    origin: 'FRA',
    originName: 'Frankfurt',
    destination: 'BKK',
    destinationName: 'Bangkok',
    country: 'Thailand',
    points: 45000,
    program: 'Miles & More',
    taxes: 118,
    cashAvg: 2340,
    cabin: 'Business',
    airline: 'Thai Airways',
    month: 'November 2026',
    stops: 0,
    score: 94,
    tripType: 'oneway',
    publicTile: true,
  },
  {
    id: 'muc-jfk',
    origin: 'MUC',
    originName: 'München',
    destination: 'JFK',
    destinationName: 'New York',
    country: 'USA',
    points: 33000,
    program: 'Flying Blue',
    taxes: 89,
    cashAvg: 1780,
    cabin: 'Business',
    airline: 'Air France',
    month: 'Januar 2027',
    stops: 1,
    score: 88,
    tripType: 'oneway',
    publicTile: true,
  },
  {
    id: 'ber-dxb',
    origin: 'BER',
    originName: 'Berlin',
    destination: 'DXB',
    destinationName: 'Dubai',
    country: 'VAE',
    points: 42500,
    program: 'Emirates Skywards',
    taxes: 214,
    cashAvg: 1980,
    cabin: 'Business',
    airline: 'Emirates',
    month: 'Oktober 2026',
    stops: 0,
    score: 81,
    tripType: 'oneway',
    publicTile: true,
  },
  {
    id: 'fra-pmi',
    origin: 'FRA',
    originName: 'Frankfurt',
    destination: 'PMI',
    destinationName: 'Palma de Mallorca',
    country: 'Spanien',
    points: 15000,
    program: 'Miles & More',
    taxes: 42,
    cashAvg: 289,
    cabin: 'Economy',
    airline: 'Lufthansa',
    month: 'September 2026',
    stops: 0,
    score: 76,
    tripType: 'roundtrip',
    publicTile: true,
  },
  {
    id: 'muc-ath',
    origin: 'MUC',
    originName: 'München',
    destination: 'ATH',
    destinationName: 'Athen',
    country: 'Griechenland',
    points: null,
    program: null,
    taxes: 0,
    cashAvg: 312,
    cabin: 'Economy',
    airline: 'Aegean',
    month: 'Oktober 2026',
    stops: 0,
    score: 72,
    tripType: 'roundtrip',
    publicTile: true,
  },
  {
    id: 'ber-bcn',
    origin: 'BER',
    originName: 'Berlin',
    destination: 'BCN',
    destinationName: 'Barcelona',
    country: 'Spanien',
    points: 12500,
    program: 'Avios',
    taxes: 35,
    cashAvg: 246,
    cabin: 'Economy',
    airline: 'Vueling',
    month: 'September 2026',
    stops: 0,
    score: 69,
    tripType: 'roundtrip',
    publicTile: true,
  },
  // --- ab hier hinter der Paywall (Drosselung, siehe MYLO-35) ---
  {
    id: 'fra-hnd',
    origin: 'FRA',
    originName: 'Frankfurt',
    destination: 'HND',
    destinationName: 'Tokio',
    country: 'Japan',
    points: 55000,
    program: 'ANA Mileage Club',
    taxes: 96,
    cashAvg: 3120,
    cabin: 'Business',
    airline: 'ANA',
    month: 'Februar 2027',
    stops: 0,
    score: 96,
    tripType: 'oneway',
    publicTile: false,
  },
  {
    id: 'zrh-sin',
    origin: 'ZRH',
    originName: 'Zürich',
    destination: 'SIN',
    destinationName: 'Singapur',
    country: 'Singapur',
    points: 92000,
    program: 'KrisFlyer',
    taxes: 178,
    cashAvg: 4890,
    cabin: 'First',
    airline: 'Singapore Airlines',
    month: 'März 2027',
    stops: 0,
    score: 93,
    tripType: 'oneway',
    publicTile: false,
  },
];

export const PUBLIC_DEALS = MOCK_DEALS.filter((deal) => deal.publicTile);
export const LOCKED_DEALS = MOCK_DEALS.filter((deal) => !deal.publicTile);

/** Anzahl Deals, die insgesamt im Scanner liegen — Paywall-Argument */
export const TOTAL_DEAL_COUNT = 47;

/**
 * Bewertung der eingesetzten Punkte in EUR pro Punkt.
 * BEFUND AUS DEM PROTOTYP: Ohne diesen Term wird die Ersparnis unehrlich —
 * „45.000 Punkte + 118 €" gegen „2.340 € Barpreis" ergibt sonst −95 %, obwohl
 * die Punkte selbst rund 675 € wert sind. Welcher Satz je Programm gilt, ist
 * die offene Frage in MYLO-36.
 */
const POINT_VALUE_EUR = 0.015;

/** Was der Award real kostet: Zuschläge + Gegenwert der eingesetzten Punkte */
export function effectiveCostEur(deal: MockDeal): number {
  if (deal.points === null) return deal.cashAvg;
  return Math.round(deal.taxes + deal.points * POINT_VALUE_EUR);
}

/** Ersparnis gegenüber Ø Barpreis — Punktewert ist abgezogen */
export function savingsEur(deal: MockDeal): number {
  if (deal.points === null) return 0;
  return Math.round(deal.cashAvg - effectiveCostEur(deal));
}

export function savingsPercent(deal: MockDeal): number {
  if (deal.points === null) return 0;
  return Math.round((savingsEur(deal) / deal.cashAvg) * 100);
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPoints(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

/* -------------------------------------------------------------------------- */
/* Eingeloggter Nutzer                                                         */
/* -------------------------------------------------------------------------- */

export const MOCK_USER = {
  firstName: 'Pascal',
  /** C-lite: Summe aus AwardWallet-Salden × Bewertung (MYLO-36) */
  portfolioValueEur: 4213,
  portfolioValueRounded: '~4.200 €',
  hasAwardWallet: true,
  accounts: [
    { program: 'Miles & More', balance: 128400, valueEur: 1926, rate: 1.5 },
    { program: 'Amex Membership Rewards', balance: 96200, valueEur: 1443, rate: 1.5 },
    { program: 'Flying Blue', balance: 41800, valueEur: 585, rate: 1.4 },
    { program: 'Marriott Bonvoy', balance: 38000, valueEur: 259, rate: 0.68 },
  ],
};

/* -------------------------------------------------------------------------- */
/* Kategorien der Shell                                                        */
/* -------------------------------------------------------------------------- */

export type CategoryState = 'live' | 'beta' | 'preview';

export interface MockCategory {
  key: string;
  label: string;
  tagline: string;
  state: CategoryState;
  /** Zähler wie Roames „Alerts 0/5" — macht die Paywall vor dem Klick sichtbar */
  counter?: string;
  icon: 'plane' | 'tag' | 'bed' | 'creditCard' | 'bell' | 'sparkles';
}

export const MOCK_CATEGORIES: MockCategory[] = [
  {
    key: 'flights',
    label: 'Flüge',
    tagline: 'Award-Suche über 30+ Programme',
    state: 'live',
    icon: 'plane',
  },
  {
    key: 'deals',
    label: 'Deals',
    tagline: `${TOTAL_DEAL_COUNT} aktuelle Treffer ab DACH`,
    state: 'live',
    icon: 'tag',
  },
  {
    key: 'points',
    label: 'Karten & Punkte',
    tagline: 'Wert deiner Salden, Cent-pro-Punkt',
    state: 'live',
    icon: 'creditCard',
  },
  {
    key: 'hotels',
    label: 'Hotels',
    tagline: 'Preisvergleich über Trivago',
    state: 'beta',
    icon: 'bed',
  },
  {
    key: 'alerts',
    label: 'Alerts',
    tagline: 'Award-Plätze, sobald sie freigegeben werden',
    state: 'preview',
    counter: '0/5',
    icon: 'bell',
  },
  {
    key: 'cards-dach',
    label: 'Kreditkarten DACH',
    tagline: 'Welche Karte für welches Programm',
    state: 'preview',
    icon: 'creditCard',
  },
];

/** Beispiel-Prompts, die den Chat füllen (Variante A) */
export const MOCK_PROMPTS = [
  'Business Class nach Asien im Winter — was geht mit meinen Meilen?',
  'Lohnt sich der Transfer von Amex zu Flying Blue gerade?',
  'Was sind meine 128.000 Miles & More Meilen wirklich wert?',
  'Familienreise nach Mallorca im Herbst, 2 Erwachsene 2 Kinder',
];

export const MOCK_RECENT_CHATS = [
  'Bangkok Business im November',
  'Amex → Flying Blue Transferbonus',
  'Mallorca Herbstferien',
];
