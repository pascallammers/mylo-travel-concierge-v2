/**
 * PROTOTYP (MYLO-30) — Wegwerf-Route, nicht in main folden.
 *
 * Drei Varianten von öffentlicher Landing Page und eingeloggter Plattform-Shell,
 * umschaltbar über `?variant=A|B|C` und `?surface=landing|app`.
 * Keine DB, kein Login, keine Mutationen — alles aus `mock-data.ts`.
 *
 * Aufruf: pnpm dev → http://localhost:3000/de/prototype-shell
 */

import { Suspense } from 'react';
import { PrototypeSwitcher } from './prototype-switcher';
import { VARIANT_A } from './variant-a';
import { VARIANT_B } from './variant-b';
import { VARIANT_C } from './variant-c';

const VARIANTS = [VARIANT_A, VARIANT_B, VARIANT_C];

export const metadata = {
  title: 'PROTOTYP — Shell & Landing (MYLO-30)',
  robots: { index: false, follow: false },
};

export default async function PrototypeShellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawVariant = Array.isArray(params.variant) ? params.variant[0] : params.variant;
  const rawSurface = Array.isArray(params.surface) ? params.surface[0] : params.surface;

  const variant =
    VARIANTS.find((candidate) => candidate.key === rawVariant?.toUpperCase()) ?? VARIANTS[0];
  const surface: 'landing' | 'app' = rawSurface === 'app' ? 'app' : 'landing';

  const Surface = surface === 'app' ? variant.App : variant.Landing;

  return (
    <>
      <Surface />
      <Suspense fallback={null}>
        <PrototypeSwitcher
          variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
          currentVariant={variant.key}
          currentSurface={surface}
        />
      </Suspense>
    </>
  );
}
