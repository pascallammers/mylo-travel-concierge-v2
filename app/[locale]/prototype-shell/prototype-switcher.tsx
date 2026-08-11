'use client';

/**
 * PROTOTYP (MYLO-30) — Wegwerf-Code, nicht in main folden.
 *
 * Schwebende Leiste unten: Variante wechseln (← / →) und Fläche wechseln
 * (Landing ↔ eingeloggte Shell). Bewusst hässlich-kontrastreich, damit sie
 * nicht als Teil des Designs gelesen wird.
 */

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Globe, LayoutDashboard } from 'lucide-react';

interface PrototypeSwitcherProps {
  variants: { key: string; name: string }[];
  currentVariant: string;
  currentSurface: 'landing' | 'app';
}

export function PrototypeSwitcher({
  variants,
  currentVariant,
  currentSurface,
}: PrototypeSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const cycle = useCallback(
    (direction: 1 | -1) => {
      const index = variants.findIndex((variant) => variant.key === currentVariant);
      const nextIndex = (index + direction + variants.length) % variants.length;
      push({ variant: variants[nextIndex].key });
    },
    [currentVariant, push, variants],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') cycle(-1);
      if (event.key === 'ArrowRight') cycle(1);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycle]);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const current = variants.find((variant) => variant.key === currentVariant) ?? variants[0];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border-2 border-yellow-400 bg-zinc-900 p-1.5 text-white shadow-2xl">
        <button
          type="button"
          onClick={() => cycle(-1)}
          className="rounded-full p-2 transition-colors hover:bg-white/15"
          aria-label="Vorherige Variante"
        >
          <ChevronLeft className="size-4" />
        </button>

        <span className="min-w-56 px-2 text-center text-xs font-semibold tracking-tight">
          <span className="text-yellow-400">{current.key}</span> — {current.name}
        </span>

        <button
          type="button"
          onClick={() => cycle(1)}
          className="rounded-full p-2 transition-colors hover:bg-white/15"
          aria-label="Nächste Variante"
        >
          <ChevronRight className="size-4" />
        </button>

        <span className="mx-1 h-6 w-px bg-white/20" />

        <button
          type="button"
          onClick={() => push({ surface: 'landing' })}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            currentSurface === 'landing' ? 'bg-yellow-400 text-zinc-900' : 'hover:bg-white/15'
          }`}
        >
          <Globe className="size-3.5" />
          Landing
        </button>
        <button
          type="button"
          onClick={() => push({ surface: 'app' })}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            currentSurface === 'app' ? 'bg-yellow-400 text-zinc-900' : 'hover:bg-white/15'
          }`}
        >
          <LayoutDashboard className="size-3.5" />
          Eingeloggt
        </button>
      </div>
    </div>
  );
}
