'use client';

/**
 * PROTOTYP (MYLO-30) — Wegwerf-Code, nicht in main folden.
 *
 * VARIANTE D — „Suchmaske, die filtert" (A + B, nach Pascals Reaktion 11.08.2026)
 *
 * Pascal mag A's Aufbau, aber A's Maske verspricht eine Live-Suche, die auf
 * einer öffentlichen Seite nicht laufen darf (jede Bot-Anfrage kostet
 * seats.aero-Budget). D behält den Aufbau und ändert die Mechanik: die Maske
 * filtert den bereits gescannten Deal-Pool — eine DB-Abfrage, keine externe.
 * Das Ergebnis darunter ist B's Kachelwand mit ehrlicher Ersparnis.
 *
 * Shell-Seite = C (Kategorie-Rail), unverändert übernommen: die Rail ist
 * entschieden, hier steht nur die Landing zur Debatte.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, Lock, Plane, Search, Sparkles } from 'lucide-react';
import {
  LOCKED_DEALS,
  MIN_PUBLIC_SAVINGS_PERCENT,
  MOCK_CATEGORIES,
  MOCK_USER,
  PUBLIC_DEALS,
  PUBLIC_ORIGINS,
  TOTAL_DEAL_COUNT,
  WEAK_DEALS,
  effectiveCostEur,
  formatEur,
  formatPoints,
  savingsEur,
  savingsPercent,
  type MockDeal,
} from './mock-data';
import { AppC } from './variant-c';

const CABINS = ['Egal', 'Economy', 'Business'] as const;

function DealTile({ deal, locked = false }: { deal: MockDeal; locked?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg ${
        locked ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-baseline justify-between bg-emerald-500/10 px-5 py-3">
        <span className="text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
          −{savingsPercent(deal)}%
        </span>
        <span className="text-sm font-medium text-emerald-700/80 dark:text-emerald-400/80">
          {formatEur(savingsEur(deal))} gespart
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          {deal.origin}
          <span className="h-px w-4 bg-border" />
          {deal.destination}
        </div>
        <h3 className="mt-1 text-xl font-bold tracking-tight">{deal.destinationName}</h3>
        <p className="text-sm text-muted-foreground">
          {deal.cabin} · {deal.airline} · {deal.month}
        </p>

        <div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mit Punkten</span>
            <span className="font-semibold tabular-nums">
              {formatPoints(deal.points ?? 0)} + {formatEur(deal.taxes)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ø Barpreis</span>
            <span className="tabular-nums text-muted-foreground line-through">
              {formatEur(deal.cashAvg)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-muted-foreground">Punkte mit 1,5 ct bewertet</span>
            <span className="font-medium tabular-nums">{formatEur(effectiveCostEur(deal))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingD() {
  const [origin, setOrigin] = useState<string>('Egal');
  const [cabin, setCabin] = useState<(typeof CABINS)[number]>('Egal');

  const results = useMemo(
    () =>
      PUBLIC_DEALS.filter(
        (deal) =>
          (origin === 'Egal' || deal.origin === origin) &&
          (cabin === 'Egal' || deal.cabin === cabin),
      ),
    [cabin, origin],
  );

  /** Was der Filter im nicht-öffentlichen Pool zusätzlich findet */
  const hiddenMatches = useMemo(
    () =>
      [...LOCKED_DEALS, ...WEAK_DEALS].filter(
        (deal) =>
          (origin === 'Egal' || deal.origin === origin) &&
          (cabin === 'Egal' || deal.cabin === cabin),
      ).length,
    [cabin, origin],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Plane className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">FlyMylo</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Anmelden
            </button>
            <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">
              14 Tage testen
            </button>
          </div>
        </div>
      </header>

      {/* Hero wie A — aber die Maske filtert, statt zu suchen */}
      <section className="border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3 text-amber-500" />
            Der erste Punkte-Concierge für den deutschsprachigen Raum
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
            Wohin willst du?
            <br />
            <span className="text-muted-foreground">
              Wir zeigen dir, was es in Punkten kostet.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Diese {TOTAL_DEAL_COUNT} Treffer hat Mylo in den letzten 24 Stunden über
            30 Vielfliegerprogramme gefunden. Such dir raus, was zu dir passt.
          </p>

          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border bg-card p-2 shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex-1 rounded-xl px-4 py-3 text-left hover:bg-muted/60">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ab Flughafen
                </span>
                <select
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  className="w-full bg-transparent font-medium outline-none"
                >
                  <option value="Egal">Alle Abflughäfen</option>
                  {PUBLIC_ORIGINS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>

              <div className="hidden w-px bg-border sm:block" />

              <label className="flex-1 rounded-xl px-4 py-3 text-left hover:bg-muted/60">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Klasse
                </span>
                <select
                  value={cabin}
                  onChange={(event) =>
                    setCabin(event.target.value as (typeof CABINS)[number])
                  }
                  className="w-full bg-transparent font-medium outline-none"
                >
                  {CABINS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'Egal' ? 'Alle Klassen' : option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="hidden w-px bg-border sm:block" />

              <div className="flex flex-1 items-center gap-2 rounded-xl px-4 py-3 text-left">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm tabular-nums text-muted-foreground">
                  {results.length} von {TOTAL_DEAL_COUNT} Treffern
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Filtert die bereits gefundenen Treffer — keine Anmeldung, kein Warten
          </p>
        </div>
      </section>

      {/* Ergebnis: B's Kachelwand */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        {results.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((deal) => (
              <DealTile key={deal.id} deal={deal} />
            ))}
          </div>
        ) : (
          /* Leerzustand — der Filter darf nie in eine Sackgasse laufen */
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <h3 className="text-lg font-semibold">
              Öffentlich liegt dafür gerade nichts vor.
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {hiddenMatches > 0 ? (
                <>
                  Im vollständigen Bestand gibt es{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    {hiddenMatches} Treffer
                  </span>{' '}
                  für diese Auswahl — und im Zugang sucht Mylo zusätzlich live nach
                  freien Award-Plätzen.
                </>
              ) : (
                <>
                  Im Zugang sucht Mylo für diese Strecke live nach freien
                  Award-Plätzen, statt nur den Fundus zu filtern.
                </>
              )}
            </p>
            <button className="mt-6 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              14 Tage testen
            </button>
            <button
              onClick={() => {
                setOrigin('Egal');
                setCabin('Egal');
              }}
              className="ml-3 rounded-xl border px-5 py-2.5 text-sm font-semibold"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}

        {/* Paywall-Kante */}
        <div className="relative mt-4">
          <div className="grid gap-4 blur-[4px] sm:grid-cols-2 lg:grid-cols-3">
            {LOCKED_DEALS.map((deal) => (
              <DealTile key={deal.id} deal={deal} locked />
            ))}
            <DealTile deal={{ ...PUBLIC_DEALS[0], id: 'ghost' }} locked />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-background via-background/95 to-background/40">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                <Lock className="size-4" />
                Noch {TOTAL_DEAL_COUNT - PUBLIC_DEALS.length} Treffer im Zugang
              </div>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Öffentlich zeigen wir die stärksten Funde ab 24 Stunden Alter. Die
                frischen — und die Live-Suche über deine eigenen Programme — sind drin.
              </p>
            </div>
            <button className="rounded-xl bg-foreground px-6 py-3 font-semibold text-background">
              14 Tage kostenlos testen
            </button>
          </div>
        </div>

        {/* Ehrlichkeits-Fußnote: die Schwelle wird offen benannt */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ersparnis = Ø Barpreis dieser Route minus Zuschläge minus Gegenwert der
          eingesetzten Punkte (1,5 ct/Punkt). Öffentlich zeigen wir nur Treffer über{' '}
          {MIN_PUBLIC_SAVINGS_PERCENT} % Ersparnis — Kurzstreckenprämien liegen
          ehrlich gerechnet meist darunter und stehen deshalb nur im Zugang.
        </p>
      </section>

      {/* Zweiter Beweis: Wallet-Wert */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Und was liegt bei dir herum?</h2>
            <p className="mt-4 text-muted-foreground">
              Verbinde dein AwardWallet-Konto — Mylo liest deine Salden aus allen
              Programmen und rechnet sie in Euro um. Danach filtert die Suche oben
              nach dem, was du dir tatsächlich leisten kannst.
            </p>
            <button className="mt-6 inline-flex items-center gap-2 font-semibold">
              Punktewert berechnen
              <ArrowRight className="size-4" />
            </button>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">Beispiel-Portfolio</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">
              {formatEur(MOCK_USER.portfolioValueEur)}
            </p>
            <div className="mt-5 space-y-3">
              {MOCK_USER.accounts.map((account) => (
                <div key={account.program}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{account.program}</span>
                    <span className="font-medium tabular-nums">
                      {formatEur(account.valueEur)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/70"
                      style={{
                        width: `${(account.valueEur / MOCK_USER.portfolioValueEur) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Kategorien-Teaser wie in A */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">
            Was Mylo für dich übernimmt
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_CATEGORIES.map((category) => (
              <div key={category.key} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{category.label}</h3>
                  {category.state !== 'live' && (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.state === 'beta' ? 'Beta' : 'Bald'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{category.tagline}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/*
 * Kein VARIANT_D-Deskriptor an dieser Stelle: Diese Datei ist ein
 * Client-Modul, deshalb wird jeder Export beim Import aus einer Server
 * Component zur Client-Referenz — `VARIANT_D.key` wäre dort undefined und die
 * Variante fiele stillschweigend auf A zurück. Der Deskriptor steht in
 * `page.tsx`.
 */
