/**
 * PROTOTYP (MYLO-30) — Wegwerf-Code, nicht in main folden.
 *
 * VARIANTE C — „Kategorie-Rail"
 *
 * These: FlyMylo ist eine Anwendung mit Bereichen, kein Chat und kein
 * Dashboard. Links eine dauerhaft sichtbare Rail mit allen Kategorien
 * (inklusive der gesperrten mit Zähler — Verkaufsfläche statt Baustelle),
 * rechts der Bereich selbst. Der Chat ist eine Rail-Position unter anderen.
 * Default-Bereich ist „Flüge" mit der Award-Suchmaske, weil das das stärkste
 * Asset ist.
 *
 * Landing: erzählende Split-Ansicht — links der Wertversprechen-Strang mit
 * Punkte-Rechner, rechts ein mitlaufender Deal-Strom.
 */

import {
  ArrowRight,
  Bell,
  BedDouble,
  CalendarDays,
  CreditCard,
  Lock,
  MessageSquare,
  Plane,
  Search,
  Settings,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';
import {
  LOCKED_DEALS,
  MOCK_CATEGORIES,
  MOCK_USER,
  PUBLIC_DEALS,
  TOTAL_DEAL_COUNT,
  formatEur,
  formatPoints,
  savingsEur,
  savingsPercent,
  type MockDeal,
} from './mock-data';

const ICONS = {
  plane: Plane,
  tag: Tag,
  bed: BedDouble,
  creditCard: CreditCard,
  bell: Bell,
  sparkles: Sparkles,
};

/* -------------------------------------------------------------------------- */
/* Deal-Zeile im Tabellenstil — dicht, viele auf einmal                        */
/* -------------------------------------------------------------------------- */

function DealLine({
  deal,
  locked = false,
  compact = false,
}: {
  deal: MockDeal;
  locked?: boolean;
  /** Schmale Spalte (Landing-Strom): mittlere Spalten fallen weg */
  compact?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-4 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40 ${
        compact ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,2fr)_1fr_1fr_auto]'
      } ${locked ? 'opacity-50' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">
            {deal.originName} → {deal.destinationName}
          </span>
          <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {deal.cabin}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {deal.airline} · {deal.month} · {deal.stops === 0 ? 'Direkt' : `${deal.stops} Stopp`}
        </p>
        {compact && (
          <p className="mt-1 text-xs tabular-nums">
            {deal.points ? (
              <>
                <span className="font-medium">{formatPoints(deal.points)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  + {formatEur(deal.taxes)} · Ø Barpreis {formatEur(deal.cashAvg)}
                </span>
              </>
            ) : (
              <span className="font-medium">{formatEur(deal.cashAvg)}</span>
            )}
          </p>
        )}
      </div>

      {!compact && (
        <>
          <div className="text-sm tabular-nums">
            {deal.points ? (
              <>
                <div className="font-medium">{formatPoints(deal.points)}</div>
                <div className="text-xs text-muted-foreground">
                  {deal.program} + {formatEur(deal.taxes)}
                </div>
              </>
            ) : (
              <div className="font-medium">{formatEur(deal.cashAvg)}</div>
            )}
          </div>

          <div className="text-sm tabular-nums text-muted-foreground">
            {formatEur(deal.cashAvg)}
            <div className="text-xs">Ø Barpreis</div>
          </div>
        </>
      )}

      <div className="text-right">
        {deal.points ? (
          <>
            <div className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
              −{savingsPercent(deal)}%
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatEur(savingsEur(deal))}
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Barpreis-Deal</span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Landing — erzählender Split                                                 */
/* -------------------------------------------------------------------------- */

export function LandingC() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Plane className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">FlyMylo</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Anmelden
            </button>
            <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">
              Testen
            </button>
          </div>
        </div>
      </header>

      {/* Split-Hero: Versprechen links, laufender Beweis rechts */}
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight">
            Du hast wahrscheinlich einen Urlaub auf dem Konto.
            <span className="block text-muted-foreground">Du weißt es nur nicht.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Miles &amp; More, Amex, Flying Blue, Bonvoy — die Punkte liegen verteilt herum
            und niemand rechnet sie zusammen. Mylo tut es, und sagt dir dann, wohin sie
            dich bringen.
          </p>

          {/* Mini-Rechner als Einstieg */}
          <div className="mt-8 rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium">Grob geschätzt: Wie viele Meilen hast du?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['unter 50.000', '50–150.000', '150–300.000', 'über 300.000'].map(
                (bucket, index) => (
                  <button
                    key={bucket}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      index === 1 ? 'border-foreground bg-foreground text-background' : ''
                    }`}
                  >
                    {bucket}
                  </button>
                ),
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">Das sind etwa</span>
              <span className="text-3xl font-bold tabular-nums">1.500 – 2.200 €</span>
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 font-semibold text-background">
              Genauen Wert berechnen
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Laufender Deal-Strom */}
        <div className="rounded-3xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-semibold">Gerade gefunden</span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {TOTAL_DEAL_COUNT} aktive Treffer
            </span>
          </div>

          <div>
            {PUBLIC_DEALS.map((deal) => (
              <DealLine key={deal.id} deal={deal} compact />
            ))}
          </div>

          <div className="relative border-t">
            <div className="blur-[3px]">
              {LOCKED_DEALS.map((deal) => (
                <DealLine key={deal.id} deal={deal} locked compact />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-card/70">
              <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm">
                <Lock className="size-3.5" />
                {TOTAL_DEAL_COUNT - PUBLIC_DEALS.length} weitere im Zugang
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kategorien als Erzählung */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sechs Bereiche, ein Konto
          </p>
          <h2 className="mt-2 max-w-2xl text-balance text-3xl font-bold tracking-tight">
            Von der ersten Idee bis zum bestätigten Award-Platz.
          </h2>

          <div className="mt-10 divide-y border-y">
            {MOCK_CATEGORIES.map((category) => {
              const Icon = ICONS[category.icon];
              return (
                <div
                  key={category.key}
                  className="flex items-center gap-5 py-5"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{category.label}</h3>
                      {category.state === 'beta' && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                          Beta
                        </span>
                      )}
                      {category.state === 'preview' && (
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          Bald
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{category.tagline}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">14 Tage testen</h2>
        <p className="mt-4 text-muted-foreground">
          Danach ab 9,99 € im Monat. Kein Free-Account — dafür auch keine Werbung
          und keine weiterverkauften Daten.
        </p>
        <button className="mt-8 rounded-xl bg-foreground px-6 py-3 font-semibold text-background">
          Zugang starten
        </button>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Eingeloggte Shell — Rail + Bereich                                          */
/* -------------------------------------------------------------------------- */

export function AppC() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
            <Plane className="size-3.5" />
          </div>
          <span className="font-bold tracking-tight">FlyMylo</span>
        </div>

        {/* C-lite in der Rail — dauerhaft sichtbar */}
        <div className="border-b p-4">
          <p className="text-xs text-muted-foreground">Dein Punktevermögen</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatEur(MOCK_USER.portfolioValueEur)}
          </p>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full">
            {MOCK_USER.accounts.map((account, index) => (
              <div
                key={account.program}
                className={
                  ['bg-foreground', 'bg-foreground/70', 'bg-foreground/45', 'bg-foreground/25'][
                    index
                  ]
                }
                style={{
                  width: `${(account.valueEur / MOCK_USER.portfolioValueEur) * 100}%`,
                }}
              />
            ))}
          </div>
          <button className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            Aufschlüsselung ansehen →
          </button>
        </div>

        {/* Kategorien */}
        <nav className="flex-1 space-y-0.5 p-2">
          {MOCK_CATEGORIES.map((category, index) => {
            const Icon = ICONS[category.icon];
            const isActive = index === 0;
            const isPreview = category.state === 'preview';
            return (
              <button
                key={category.key}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-background shadow-sm'
                    : isPreview
                      ? 'text-muted-foreground/60'
                      : 'text-muted-foreground hover:bg-background/60'
                }`}
              >
                {isPreview ? <Lock className="size-4" /> : <Icon className="size-4" />}
                <span className="flex-1 text-left">{category.label}</span>
                {category.state === 'beta' && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">
                    Beta
                  </span>
                )}
                {category.counter && (
                  <span className="rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    {category.counter}
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-2 h-px bg-border" />

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background/60">
            <MessageSquare className="size-4" />
            <span className="flex-1 text-left">Hey Mylo</span>
          </button>
        </nav>

        <div className="border-t p-2">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-background/60">
            <Settings className="size-4" />
            Einstellungen
          </button>
        </div>
      </aside>

      {/* Bereich */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <h1 className="font-semibold">Flüge</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              AwardWallet synchronisiert · vor 2 Std.
            </span>
            <div className="size-8 rounded-full bg-muted" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {/* Award-Suchmaske als Kern des Bereichs */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="rounded-xl border px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Von
                </div>
                <div className="text-sm font-medium">Frankfurt (FRA)</div>
              </div>
              <div className="rounded-xl border px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Nach
                </div>
                <div className="text-sm font-medium">Bangkok (BKK)</div>
              </div>
              <div className="rounded-xl border px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="size-3" />
                  Zeitraum
                </div>
                <div className="text-sm font-medium">Nov 2026 · ±3 Tage</div>
              </div>
              <button className="flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 font-semibold text-background">
                <Search className="size-4" />
                Suchen
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
              <span className="text-muted-foreground">Filter:</span>
              {['Business', 'Direktflug', 'Meine Programme', '2 Reisende'].map((filter) => (
                <button
                  key={filter}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-muted-foreground hover:text-foreground"
                >
                  {filter === '2 Reisende' && <Users className="size-3" />}
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Deals im selben Bereich, als Tabelle */}
          <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                Auffällig günstig ab deinen Flughäfen
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {TOTAL_DEAL_COUNT} Treffer
              </span>
            </div>
            {PUBLIC_DEALS.map((deal) => (
              <DealLine key={deal.id} deal={deal} />
            ))}
          </div>

          {/* Fluchtweg zum Chat, immer sichtbar */}
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-dashed p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <p className="font-semibold">Nichts Passendes dabei?</p>
                <p className="text-sm text-muted-foreground">
                  Beschreib Mylo einfach, was du suchst — im Klartext.
                </p>
              </div>
            </div>
            <button className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              Hey Mylo
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export const VARIANT_C = {
  key: 'C',
  name: 'Kategorie-Rail',
  Landing: LandingC,
  App: AppC,
};
