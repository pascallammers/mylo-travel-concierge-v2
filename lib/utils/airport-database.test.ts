import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  getAirportDetails,
  isValidIATACodeInDB,
  lookupAirportByName,
  searchAirports,
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

describe('searchAirports', () => {
  it('liefert Vorschlaege fuer Staedte und IATA-Codes', async () => {
    const results = await searchAirports('Düsseldorf');

    assert.ok(results.length > 0);
    assert.strictEqual(results[0]?.iataCode, 'DUS');
    assert.match(results[0]?.name ?? '', /Düsseldorf|Duesseldorf|Dusseldorf/i);
  });

  it('findet deutsche Teiltreffer auch mit Umlauten und ASCII-Varianten', async () => {
    const umlautResults = await searchAirports('Düssel');
    const asciiResults = await searchAirports('Dussel');
    const expandedResults = await searchAirports('Duessel');

    assert.ok(umlautResults.some((result) => result.iataCode === 'DUS'));
    assert.ok(asciiResults.some((result) => result.iataCode === 'DUS'));
    assert.ok(expandedResults.some((result) => result.iataCode === 'DUS'));
  });
});
