import { describe, test, expect } from 'bun:test';
import { buildGoogleFlightsUrl, buildSkyscannerUrl } from './flight-search-links';

describe('buildGoogleFlightsUrl', () => {
  test('builds one-way flight URL correctly', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'BUSINESS',
      passengers: 1,
    });

    expect(url).toContain('google.com/travel/flights');
    expect(url).toContain('/FRA/HKT/2025-12-15');
    expect(url).toContain('cabin=business');
    expect(url).not.toContain('passengers='); // Single passenger omitted
  });

  test('builds round-trip flight URL correctly', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'ECONOMY',
      passengers: 1,
    });

    expect(url).toContain('google.com/travel/flights');
    expect(url).toContain('/FRA/HKT/2025-12-15/2025-12-22');
    expect(url).toContain('cabin=economy');
  });

  test('includes passenger count for multiple passengers', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'BER',
      destination: 'JFK',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'ECONOMY',
      passengers: 3,
    });

    expect(url).toContain('passengers=3');
    expect(url).toContain('cabin=economy');
  });

  test('handles premium economy cabin class', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'PREMIUM_ECONOMY',
      passengers: 2,
    });

    expect(url).toContain('cabin=premium_economy');
    expect(url).toContain('passengers=2');
  });

  test('handles first class cabin', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'LAX',
      destination: 'SYD',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'FIRST',
      passengers: 1,
    });

    expect(url).toContain('cabin=first');
  });

  test('defaults to economy for invalid cabin class', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'INVALID_CLASS',
      passengers: 1,
    });

    expect(url).toContain('cabin=economy');
  });

  test('handles lowercase cabin class input', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'business',
      passengers: 1,
    });

    expect(url).toContain('cabin=business');
  });
});

describe('buildSkyscannerUrl', () => {
  test('builds one-way flight URL correctly', () => {
    const url = buildSkyscannerUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'BUSINESS',
      passengers: 1,
    });

    expect(url).toContain('skyscanner.com/transport/flights');
    expect(url).toContain('/FRA/HKT/251215');
    expect(url).toContain('adults=1');
    expect(url).toContain('cabinclass=business');
  });

  test('builds round-trip flight URL with correct date format', () => {
    const url = buildSkyscannerUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'ECONOMY',
      passengers: 2,
    });

    expect(url).toContain('skyscanner.com/transport/flights');
    expect(url).toContain('/FRA/HKT/251215/251222'); // YYMMDD format
    expect(url).toContain('adults=2');
    expect(url).toContain('cabinclass=economy');
  });

  test('formats dates correctly (YYMMDD)', () => {
    const url = buildSkyscannerUrl({
      origin: 'BER',
      destination: 'JFK',
      departDate: '2026-01-05',
      returnDate: '2026-01-12',
      cabin: 'BUSINESS',
      passengers: 1,
    });

    expect(url).toContain('/260105/260112'); // YY=26, MM=01, DD=05/12
  });

  test('handles premium economy cabin class', () => {
    const url = buildSkyscannerUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'PREMIUM_ECONOMY',
      passengers: 2,
    });

    expect(url).toContain('cabinclass=premiumeconomy');
    expect(url).toContain('adults=2');
  });

  test('handles first class cabin', () => {
    const url = buildSkyscannerUrl({
      origin: 'LAX',
      destination: 'SYD',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'FIRST',
      passengers: 3,
    });

    expect(url).toContain('cabinclass=first');
    expect(url).toContain('adults=3');
  });

  test('defaults to economy for invalid cabin class', () => {
    const url = buildSkyscannerUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'INVALID_CLASS',
      passengers: 1,
    });

    expect(url).toContain('cabinclass=economy');
  });

  test('handles multiple passengers correctly', () => {
    const url = buildSkyscannerUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'BUSINESS',
      passengers: 4,
    });

    expect(url).toContain('adults=4');
  });

  test('handles lowercase cabin class input', () => {
    const url = buildSkyscannerUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: null,
      cabin: 'business',
      passengers: 1,
    });

    expect(url).toContain('cabinclass=business');
  });
});

describe('URL format validation', () => {
  test('Google Flights URLs are properly formatted', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'BUSINESS',
      passengers: 2,
    });

    // Should be a valid URL
    expect(() => new URL(url)).not.toThrow();
    
    // Should use HTTPS
    expect(url).toStartWith('https://');
  });

  test('Skyscanner URLs are properly formatted', () => {
    const url = buildSkyscannerUrl({
      origin: 'FRA',
      destination: 'HKT',
      departDate: '2025-12-15',
      returnDate: '2025-12-22',
      cabin: 'BUSINESS',
      passengers: 2,
    });

    // Should be a valid URL
    expect(() => new URL(url)).not.toThrow();
    
    // Should use HTTPS
    expect(url).toStartWith('https://');
  });
});
