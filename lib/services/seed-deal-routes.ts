import 'server-only';

import { seedBaseRoutes } from '@/lib/db/deal-queries';

/**
 * Popular routes from DACH airports to top destinations.
 * This is the initial set; user-generated routes get added dynamically.
 */
const BASE_ROUTES: Array<{ origin: string; destination: string }> = [
  // Frankfurt (FRA)
  { origin: 'FRA', destination: 'BCN' },
  { origin: 'FRA', destination: 'ATH' },
  { origin: 'FRA', destination: 'IST' },
  { origin: 'FRA', destination: 'PMI' },
  { origin: 'FRA', destination: 'LIS' },
  { origin: 'FRA', destination: 'BKK' },
  { origin: 'FRA', destination: 'JFK' },
  { origin: 'FRA', destination: 'DXB' },
  // Munich (MUC)
  { origin: 'MUC', destination: 'BCN' },
  { origin: 'MUC', destination: 'ATH' },
  { origin: 'MUC', destination: 'PMI' },
  { origin: 'MUC', destination: 'FCO' },
  { origin: 'MUC', destination: 'LIS' },
  { origin: 'MUC', destination: 'BKK' },
  // Berlin (BER)
  { origin: 'BER', destination: 'BCN' },
  { origin: 'BER', destination: 'ATH' },
  { origin: 'BER', destination: 'PMI' },
  { origin: 'BER', destination: 'IST' },
  { origin: 'BER', destination: 'LIS' },
  // Duesseldorf (DUS)
  { origin: 'DUS', destination: 'BCN' },
  { origin: 'DUS', destination: 'ATH' },
  { origin: 'DUS', destination: 'PMI' },
  { origin: 'DUS', destination: 'AGP' },
  // Hamburg (HAM)
  { origin: 'HAM', destination: 'BCN' },
  { origin: 'HAM', destination: 'PMI' },
  { origin: 'HAM', destination: 'ATH' },
  // Vienna (VIE)
  { origin: 'VIE', destination: 'BCN' },
  { origin: 'VIE', destination: 'ATH' },
  { origin: 'VIE', destination: 'IST' },
  { origin: 'VIE', destination: 'BKK' },
  // Zurich (ZRH)
  { origin: 'ZRH', destination: 'BCN' },
  { origin: 'ZRH', destination: 'ATH' },
  { origin: 'ZRH', destination: 'LIS' },
  { origin: 'ZRH', destination: 'JFK' },
];

export async function seedDealRoutes(): Promise<number> {
  console.log(`[Seed] Seeding ${BASE_ROUTES.length} base routes...`);
  await seedBaseRoutes(BASE_ROUTES);
  console.log(`[Seed] Done.`);
  return BASE_ROUTES.length;
}
