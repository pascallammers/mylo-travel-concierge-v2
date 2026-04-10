import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  getAirportDetails,
  isValidIATACodeInDB,
  lookupAirportByName,
} from './airport-database';

describe('lookupAirportByName', () => {
  it('loest gueltige IATA-Codes ueber die lokale Airport-Datenbank auf', async () => {
    const result = await lookupAirportByName('FRA');

    assert.ok(result);
    assert.strictEqual(result?.iataCode, 'FRA');
    assert.match(result?.name ?? '', /Frankfurt/i);
  });

  it('unterstuetzt deutsche City-Aliases', async () => {
    const result = await lookupAirportByName('München');

    assert.ok(result);
    assert.strictEqual(result?.iataCode, 'MUC');
    assert.strictEqual(result?.source, 'alias');
  });
});

describe('isValidIATACodeInDB', () => {
  it('validiert existierende und ungueltige Codes korrekt', async () => {
    assert.strictEqual(await isValidIATACodeInDB('FRA'), true);
    assert.strictEqual(await isValidIATACodeInDB('ZZZ'), false);
  });
});

describe('getAirportDetails', () => {
  it('liefert Flughafendetails fuer bekannte IATA-Codes', async () => {
    const airport = await getAirportDetails('JFK');

    assert.ok(airport);
    assert.strictEqual(airport?.iata, 'JFK');
    assert.match(airport?.airport ?? '', /Kennedy|JFK/i);
  });
});
