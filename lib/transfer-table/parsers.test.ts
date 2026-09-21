import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AMEX_DACH_PARTNERS } from '../config/transfer-engine/dach';
import { parseAmexDePartners, parsePaybackMilesAndMore, TransferParseError } from './parsers';
import { amexHtml, paybackHtml } from './test-support';
import { seedRows } from './seeds';

test('Amex fixture reproduces all 14 seed entries including exact German duration', () => {
  const observations = parseAmexDePartners(amexHtml);
  assert.equal(observations.length, 14);
  const actual = observations.map(
    ({ partnerKey, sourcePoints, partnerUnits, minTransfer, transferIncrement, transferDurationDe }) => ({
      partnerKey,
      sourcePoints,
      partnerUnits,
      minTransfer,
      transferIncrement,
      transferDurationDe,
    }),
  );
  assert.deepEqual(
    actual.sort((a, b) => a.partnerKey!.localeCompare(b.partnerKey!)),
    seedRows(AMEX_DACH_PARTNERS).sort((a, b) => a.partnerKey.localeCompare(b.partnerKey)),
  );
  assert.equal(observations.find((item) => item.sourceName.includes('KrysFlyer'))?.partnerKey, 'singaporeKrisflyer');
  assert.ok(Buffer.byteLength(amexHtml) < 60_000);
});

test('PAYBACK parses the ratio and minimum only', () => {
  assert.deepEqual(parsePaybackMilesAndMore(paybackHtml), [
    {
      sourceName: 'Miles & More',
      sourceCode: 'miles-and-more',
      partnerKey: 'milesAndMore',
      sourcePoints: 1,
      partnerUnits: 1,
      minTransfer: 200,
    },
  ]);
  assert.ok(Buffer.byteLength(paybackHtml) < 60_000);
});

test('partial, empty, duplicate, inconsistent, and invalid Amex pages fail closed', () => {
  for (const html of [
    '',
    amexHtml
      .split(/(?=<li class="product-item)/)
      .slice(0, 4)
      .join(''),
    amexHtml.replaceAll('BART-01', 'FB-01'),
    amexHtml.replace('id="minAmount1" value="1000"', 'id="minAmount1" value="2000"'),
    amexHtml.replace('id="transferIncrement1" value="5"', 'id="transferIncrement1" value="0"'),
    amexHtml.replace('id="clientToParticipantRate1" value="0.8"', 'id="clientToParticipantRate1" value="0.5"'),
    amexHtml.replace('5 Membership Rewards Punkte', '0 Membership Rewards Punkte'),
  ])
    assert.throws(() => parseAmexDePartners(html), TransferParseError);
});

test('unknown Amex product is retained without guessed metadata', () => {
  const observation = parseAmexDePartners(amexHtml.replaceAll('BART-01', 'NEW-01'))[0];
  assert.equal(observation.partnerKey, undefined);
  assert.equal(observation.sourceCode, 'NEW-01');
});

test('missing, contradictory, or invalid PAYBACK ratio fails closed', () => {
  for (const html of [
    '',
    '<p>Transferbonus 25 %</p>',
    paybackHtml.replace('1:1', '0:1'),
    paybackHtml + paybackHtml.replace('1:1', '2:1'),
  ]) {
    assert.throws(() => parsePaybackMilesAndMore(html), TransferParseError);
  }
});
