/**
 * One-off cross-check script: compare MYLO's Lane B transfer-engine ratios
 * against borski's transfer-partners.json. Output a markdown diff table.
 *
 * Run: `npx tsx lib/data/borski-toolkit-adapter/_scripts/cross-check.mts`
 */

import { readFileSync } from 'node:fs';
import {
  AMEX_US_PARTNERS,
  CHASE_PARTNERS,
  BILT_PARTNERS,
  CAPITAL_ONE_PARTNERS,
  CITI_PARTNERS,
  type PartnerMap,
  type TransferPartner,
} from '../../../config/transfer-engine/index.ts';

interface BorskiPartner {
  program: string;
  ratio: number;
}

interface BorskiIssuer {
  display_name: string;
  airlines: Record<string, BorskiPartner>;
  hotels: Record<string, BorskiPartner>;
}

interface BorskiFile {
  amex_mr: BorskiIssuer;
  chase_ur: BorskiIssuer;
  bilt: BorskiIssuer;
  capital_one: BorskiIssuer;
  citi_ty: BorskiIssuer;
  [key: string]: unknown;
}

const borski = JSON.parse(
  readFileSync('lib/data/borski-toolkit/data/transfer-partners.json', 'utf8'),
) as BorskiFile;

function myloRatio(p: TransferPartner): number {
  return p.partnerMiles / p.amexPoints;
}

interface IndexEntry {
  ratio: number;
  id: string;
  program: string;
}

function makeIndex(issuer: BorskiIssuer): Record<string, IndexEntry> {
  const idx: Record<string, IndexEntry> = {};
  for (const [id, p] of Object.entries(issuer.airlines)) {
    idx[p.program.toLowerCase()] = { ratio: p.ratio, id, program: p.program };
  }
  for (const [id, p] of Object.entries(issuer.hotels)) {
    idx[p.program.toLowerCase()] = { ratio: p.ratio, id, program: p.program };
  }
  return idx;
}

function findBorski(
  idx: Record<string, IndexEntry>,
  myloName: string,
): IndexEntry | null {
  const lc = myloName.toLowerCase();
  if (idx[lc]) return idx[lc];
  for (const [k, v] of Object.entries(idx)) {
    const kFirst = k.split(' ')[0];
    const lcFirst = lc.split(' ')[0];
    if (kFirst && lcFirst && (lc.includes(kFirst) || k.includes(lcFirst))) return v;
  }
  return null;
}

interface CheckSet {
  mylo: PartnerMap;
  borski: BorskiIssuer;
  name: string;
}

const sets: CheckSet[] = [
  { mylo: AMEX_US_PARTNERS, borski: borski.amex_mr, name: 'US Amex MR' },
  { mylo: CHASE_PARTNERS, borski: borski.chase_ur, name: 'US Chase UR' },
  { mylo: BILT_PARTNERS, borski: borski.bilt, name: 'US Bilt' },
  { mylo: CAPITAL_ONE_PARTNERS, borski: borski.capital_one, name: 'US Capital One' },
  { mylo: CITI_PARTNERS, borski: borski.citi_ty, name: 'US Citi TY' },
];

for (const s of sets) {
  console.log(`\n=== ${s.name} ===`);
  const idx = makeIndex(s.borski);
  for (const p of Object.values(s.mylo)) {
    const myloR = myloRatio(p);
    const found = findBorski(idx, p.name);
    let status: string;
    if (!found) {
      status = '❓ NOT IN BORSKI';
    } else if (Math.abs(myloR - found.ratio) < 0.01) {
      status = '✓ match';
    } else {
      status = `⚠ MYLO ${myloR.toFixed(3)} vs borski ${found.ratio.toFixed(3)}`;
    }
    console.log(`  ${p.name.padEnd(38)} | MYLO ${myloR.toFixed(3)} | ${status}`);
  }
  const myloNames = Object.values(s.mylo).map((p) => p.name.toLowerCase());
  for (const [k, v] of Object.entries(idx)) {
    const matched = myloNames.some((n) => {
      const kFirst = k.split(' ')[0];
      const nFirst = n.split(' ')[0];
      return kFirst && nFirst && (n.includes(kFirst) || k.includes(nFirst));
    });
    if (!matched) {
      console.log(
        `  ${v.id.padEnd(38)} | --- | 🆕 IN BORSKI ONLY (${v.program}, ratio ${v.ratio})`,
      );
    }
  }
}
