import he from 'he';
import type { Observation } from './types';

const AMEX_PRODUCT_KEYS: Record<string, string> = {
  'BART-01': 'britishAirways',
  'CATH-01': 'cathay',
  DL03: 'deltaSkyMiles',
  'EK-01N': 'emiratesSkywards',
  'FB-01': 'flyingBlue',
  'IBRT-01': 'iberia',
  'QA-01N': 'qatarPrivilegeClub',
  'SAS-01DE': 'sasEurobonus',
  'SING-01': 'singaporeKrisflyer',
  'ACCR-01': 'accor',
  'HLRT-01': 'hilton',
  'MBRT-01': 'marriottBonvoy',
  'RZ-1DE': 'radisson',
  MRPB: 'payback',
};

/** A source page cannot safely be interpreted as transfer terms. */
export class TransferParseError extends Error {
  readonly code = 'TRANSFER_PARSE_ERROR';

  /**
   * Create a source parsing failure.
   * @param message - German explanation for the administrator.
   * @returns A typed parse error.
   */
  constructor(message: string) {
    super(message);
    this.name = 'TransferParseError';
  }
}

function plainText(html: string): string {
  return he
    .decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function positiveInteger(value: string | undefined): number {
  if (!value || !/^\d+(?:\.\d{3})*$/.test(value)) throw new TransferParseError('Ungültige Punktezahl in der Quelle.');
  const result = Number(value.replaceAll('.', ''));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 2147483647) {
    throw new TransferParseError('Ungültige Punktezahl in der Quelle.');
  }
  return result;
}

function hiddenValue(block: string, prefix: string): string | undefined {
  const input = [...block.matchAll(/<input\b[^>]*>/gi)].find(([tag]) =>
    new RegExp(`\\bid=["']${prefix}\\d+["']`, 'i').test(tag),
  );
  return input?.[0].match(/\bvalue=["']([^"']*)["']/i)?.[1];
}

/**
 * Parse Amex DE's server-rendered partner blocks, keyed by stable product codes.
 * @param html - Raw source HTML.
 * @returns All observations; malformed or suspiciously short pages throw TransferParseError.
 */
export function parseAmexDePartners(html: string): Observation[] {
  const blocks = html.split(/<li\b[^>]*class=["'][^"']*\bproduct-item\b[^"']*["'][^>]*>/i).slice(1);
  if (blocks.length < 10)
    throw new TransferParseError(`Amex: Nur ${blocks.length} Partner gefunden (mindestens 10 erwartet).`);
  const codes = new Set<string>();
  return blocks.map((block) => {
    const sourceCode = block.match(/href=["'][^"']*\/partner\/[^"'?]+\/([^/"'?]+)(?:\?|["'])/i)?.[1];
    const heading = block.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1];
    const ratio = block.match(/<li\b[^>]*class=["']ratio["'][^>]*>([\s\S]*?)<\/li>/i)?.[1];
    const numbers = plainText(ratio ?? '').match(
      /^(\d+(?:\.\d{3})*) Membership Rewards Punkte?\s*=\s*(\d+(?:\.\d{3})*)\s/,
    );
    const duration = block.match(/Transferdauer ca:\s*<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const minimum = block.match(/Mindesttransfer:\s*<span\b[^>]*>\s*(\d+(?:\.\d{3})*)\s+Punkte?/i)?.[1];
    if (!sourceCode || !heading || !numbers || !duration || !plainText(duration) || codes.has(sourceCode)) {
      throw new TransferParseError('Amex: Unvollständiger oder doppelter Partnerblock.');
    }
    codes.add(sourceCode);
    const sourcePoints = positiveInteger(numbers[1]);
    const partnerUnits = positiveInteger(numbers[2]);
    const minTransfer = positiveInteger(hiddenValue(block, 'minAmount'));
    const hiddenRate = Number(hiddenValue(block, 'clientToParticipantRate'));
    if (
      minTransfer !== positiveInteger(minimum) ||
      !Number.isFinite(hiddenRate) ||
      Math.abs(hiddenRate - partnerUnits / sourcePoints) > 0.000001
    ) {
      throw new TransferParseError(`Amex: Widersprüchliche Angaben bei ${plainText(heading)}.`);
    }
    return {
      sourceName: plainText(heading).replace(/\s+Punktetransfer$/i, ''),
      sourceCode,
      partnerKey: AMEX_PRODUCT_KEYS[sourceCode],
      sourcePoints,
      partnerUnits,
      minTransfer,
      transferIncrement: positiveInteger(hiddenValue(block, 'transferIncrement')),
      transferDurationDe: plainText(duration),
    };
  });
}

/**
 * Parse the PAYBACK minimum and ratio without inventing unpublished terms.
 * @param html - Raw PAYBACK partner page.
 * @returns The Miles & More observation, or a typed parse failure.
 */
export function parsePaybackMilesAndMore(html: string): Observation[] {
  const matches = [
    ...plainText(html).matchAll(
      /Ab\s+(\d+(?:\.\d{3})*)\s+PAYBACK\s*°?Punkten\s+können Sie diese im Verhältnis\s+(\d+)\s*:\s*(\d+)\s+in Miles\s*&\s*More Meilen umwandeln/gi,
    ),
  ];
  if (!matches.length || matches.some((match) => match.slice(1).join(':') !== matches[0].slice(1).join(':'))) {
    throw new TransferParseError('PAYBACK: Kein eindeutiges Transferverhältnis für Miles & More gefunden.');
  }
  return [
    {
      sourceName: 'Miles & More',
      sourceCode: 'miles-and-more',
      partnerKey: 'milesAndMore',
      sourcePoints: positiveInteger(matches[0][2]),
      partnerUnits: positiveInteger(matches[0][3]),
      minTransfer: positiveInteger(matches[0][1]),
    },
  ];
}
