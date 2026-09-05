/**
 * Canonical loyalty programme registry.
 *
 * AwardWallet identifies *providers* (login surfaces), not programmes: `klm`
 * and `airfrance` are both Flying Blue, `amex` and the code-less "Amex
 * Centurion" provider both hold Membership Rewards. Everything downstream
 * (stacked balance bar, valuation allowlist, transfer hints) keys on the
 * programme, so this module owns the n:1 provider → programme join.
 *
 * Ids reuse the seats.aero award-programme slugs where one exists
 * (`lufthansa`, `flyingblue`, `emirates`, …) so the valuation table and the
 * transfer engine can share keys. Unknown providers still resolve, to an
 * `aw:<code>` id, so no account is ever dropped or merged by accident.
 */

export type LoyaltyProgramKind = 'airline' | 'hotel' | 'card' | 'other';
export type LoyaltyBalanceUnit = 'miles' | 'points';

/** `kind` values the AwardWallet account object can carry. */
export type AwardWalletAccountKind =
  | 'Airlines'
  | 'Hotels'
  | 'Credit Cards'
  | 'Shopping'
  | 'Rentals'
  | 'Dining'
  | 'Trains'
  | 'Cruises'
  | 'Surveys'
  | 'Other';

export interface LoyaltyProgram {
  readonly id: string;
  readonly name: string;
  readonly kind: LoyaltyProgramKind;
  readonly unit: LoyaltyBalanceUnit;
  /** AwardWallet provider codes that map to this programme. */
  readonly awardWalletCodes: readonly string[];
  /** Display names for providers AwardWallet returns without a `code`. */
  readonly awardWalletNames?: readonly string[];
}

const airline = (
  id: string,
  name: string,
  awardWalletCodes: readonly string[],
): LoyaltyProgram => ({ id, name, kind: 'airline', unit: 'miles', awardWalletCodes });

const hotel = (id: string, name: string, awardWalletCodes: readonly string[]): LoyaltyProgram => ({
  id,
  name,
  kind: 'hotel',
  unit: 'points',
  awardWalletCodes,
});

export const LOYALTY_PROGRAMS: readonly LoyaltyProgram[] = [
  airline('lufthansa', 'Miles & More', ['lufthansa']),
  airline('flyingblue', 'Flying Blue', ['klm', 'airfrance']),
  airline('emirates', 'Emirates Skywards', ['skywards']),
  airline('qatar', 'Qatar Airways Privilege Club', ['qmiles']),
  airline('british', 'British Airways Club', ['british']),
  airline('iberia', 'Iberia Plus', ['iberia']),
  airline('aerlingus', 'Aer Lingus AerClub', ['aerlingus']),
  airline('singapore', 'Singapore Airlines KrisFlyer', ['singaporeair']),
  airline('cathay', 'Cathay', ['asia']),
  airline('aeroplan', 'Air Canada Aeroplan', ['aeroplan']),
  airline('united', 'United MileagePlus', ['mileageplus']),
  airline('delta', 'Delta SkyMiles', ['delta']),
  airline('jetblue', 'JetBlue TrueBlue', ['jetblue']),
  airline('aeromexico', 'Aeromexico Rewards', ['aeromexico']),
  airline('etihad', 'Etihad Guest', ['etihad']),
  airline('eurobonus', 'SAS EuroBonus', ['eurobonus']),
  airline('turkish', 'Turkish Airlines Miles&Smiles', ['turkish']),
  airline('thai', 'Thai Airways Royal Orchid Plus', ['thaiair']),
  airline('qantas', 'Qantas Frequent Flyer', ['qantas']),
  airline('virginatlantic', 'Virgin Atlantic Flying Club', ['virgin']),
  airline('ryanair', 'Ryanair', ['ryanair']),
  hotel('marriott', 'Marriott Bonvoy', ['marriott']),
  hotel('hilton', 'Hilton Honors', ['hhonors']),
  hotel('ihg', 'IHG One Rewards', ['ichotelsgroup']),
  hotel('accor', 'Accor ALL', ['aplus']),
  hotel('radisson', 'Radisson Rewards', ['carlson']),
  hotel('choice', 'Choice Privileges', ['choice']),
  hotel('melia', 'MeliáRewards', ['solmelia']),
  hotel('nh', 'NH DISCOVERY', ['nhhotels']),
  hotel('gha', 'GHA DISCOVERY', ['gha']),
  hotel('lhw', 'LHW Leaders Club', ['leadinghotels']),
  {
    id: 'amex-mr',
    name: 'Amex Membership Rewards',
    kind: 'card',
    unit: 'points',
    awardWalletCodes: ['amex'],
    awardWalletNames: ['Amex (Membership Rewards)', 'Amex Centurion'],
  },
  { id: 'chase-ur', name: 'Chase Ultimate Rewards', kind: 'card', unit: 'points', awardWalletCodes: ['chase'] },
  { id: 'capital-one', name: 'Capital One Miles', kind: 'card', unit: 'miles', awardWalletCodes: ['capitalcards'] },
  { id: 'payback', name: 'PAYBACK', kind: 'other', unit: 'points', awardWalletCodes: ['paybackgerman'] },
];

const BY_CODE = new Map<string, LoyaltyProgram>();
const BY_NAME = new Map<string, LoyaltyProgram>();
for (const program of LOYALTY_PROGRAMS) {
  for (const code of program.awardWalletCodes) BY_CODE.set(code, program);
  for (const name of program.awardWalletNames ?? []) BY_NAME.set(name.toLowerCase(), program);
}

export function getLoyaltyProgram(id: string): LoyaltyProgram | undefined {
  return LOYALTY_PROGRAMS.find((p) => p.id === id);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** AwardWallet ships display names HTML-escaped ("Miles&amp;Smiles"). */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const codePoint = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface AwardWalletProviderRef {
  code: string | null | undefined;
  displayName: string;
  kind: AwardWalletAccountKind | string;
}

export interface ResolvedLoyaltyProgram {
  programId: string;
  name: string;
  unit: LoyaltyBalanceUnit;
  known: boolean;
}

/**
 * Maps an AwardWallet provider to a programme. Known providers collapse onto
 * their registry entry; unknown ones get a stable `aw:` id derived from the
 * provider code (or the name when AwardWallet omits the code), a decoded
 * display name, and a unit guessed from the provider category.
 */
export function resolveLoyaltyProgram(provider: AwardWalletProviderRef): ResolvedLoyaltyProgram {
  const displayName = decodeHtmlEntities(provider.displayName ?? '').trim();
  const program =
    (provider.code ? BY_CODE.get(provider.code) : undefined) ?? BY_NAME.get(displayName.toLowerCase());

  if (program) {
    return { programId: program.id, name: program.name, unit: program.unit, known: true };
  }

  return {
    programId: `aw:${provider.code || slugify(displayName) || 'unknown'}`,
    name: displayName || provider.code || 'Unbekanntes Programm',
    unit: provider.kind === 'Airlines' ? 'miles' : 'points',
    known: false,
  };
}
