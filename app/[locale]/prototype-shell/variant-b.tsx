/**
 * PROTOTYP (MYLO-30) — Wegwerf-Code, nicht in main folden.
 *
 * VARIANTE B — „Dashboard First"
 *
 * These: Der Wert steht vor der Interaktion. Nach dem Login sieht der Nutzer
 * zuerst, was er besitzt (C-lite als Held), dann was er damit tun kann
 * (Kachel-Grid), dann was gerade günstig ist (Deal-Strom). Der Chat ist eine
 * Kachel unter anderen plus ein persistenter Einstieg unten rechts.
 *
 * Landing: point.me-Schule pur — keine Suchmaske, keine Erzählung, sondern
 * sofort die Beweiswand aus echten Kacheln mit Portal-Vergleich.
 */

import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BedDouble,
  CreditCard,
  Lock,
  MessageSquare,
  Plane,
  Sparkles,
  Tag,
} from 'lucide-react';
import {
  LOCKED_DEALS,
  MOCK_CATEGORIES,
  MOCK_USER,
  PUBLIC_DEALS,
  TOTAL_DEAL_COUNT,
  effectiveCostEur,
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
/* Deal-Karte: Ersparnis ist das größte Element                                */
/* -------------------------------------------------------------------------- */

function DealCardB({ deal, locked = false }: { deal: MockDeal; locked?: boolean }) {
  const percent = savingsPercent(deal);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg ${
        locked ? 'opacity-60' : ''
      }`}
    >
      {/* Kopf mit Ersparnis-Band */}
      {deal.points ? (
        <div className="flex items-baseline justify-between bg-emerald-500/10 px-5 py-3">
          <span className="text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            −{percent}%
          </span>
          <span className="text-sm font-medium text-emerald-700/80 dark:text-emerald-400/80">
            {formatEur(savingsEur(deal))} gespart
          </span>
        </div>
      ) : (
        <div className="flex items-baseline justify-between bg-muted px-5 py-3">
          <span className="text-2xl font-bold tabular-nums">{formatEur(deal.cashAvg)}</span>
          <span className="text-sm text-muted-foreground">Barpreis</span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          {deal.origin}
          <span className="h-px w-4 bg-border" />
          {deal.destination}
        </div>
        <h3 className="mt-1 text-xl font-bold tracking-tight">{deal.destinationName}</h3>
        <p className="text-sm text-muted-foreground">
          {deal.country} · {deal.month}
        </p>

        {/* Portal-Vergleich — die eigentliche Übersetzungsleistung */}
        <div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mit Punkten</span>
            <span className="font-semibold tabular-nums">
              {deal.points ? `${formatPoints(deal.points)} + ${formatEur(deal.taxes)}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ø Barpreis</span>
            <span
              className={`tabular-nums text-muted-foreground ${
                deal.points ? 'line-through' : ''
              }`}
            >
              {formatEur(deal.cashAvg)}
            </span>
          </div>
          {deal.points ? (
            <div className="flex items-center justify-between border-t pt-2 text-xs">
              <span className="text-muted-foreground">
                Punkte bewertet mit 1,5 ct → effektiv
              </span>
              <span className="font-medium tabular-nums">
                {formatEur(effectiveCostEur(deal))}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
            {deal.cabin}
          </span>
          <span className="text-xs text-muted-foreground">
            {deal.program ?? deal.airline}
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Landing — Beweiswand                                                        */
/* -------------------------------------------------------------------------- */

export function LandingB() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Plane className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">FlyMylo</span>
          </div>
          <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">
            14 Tage testen
          </button>
        </div>
      </header>

      {/* Minimaler Hero — die Kacheln sind das Argument */}
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-8">
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Das kosten diese Flüge gerade in Punkten.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Keine Anmeldung nötig. Alle Treffer stammen aus den letzten 24 Stunden und
          werden gegen den durchschnittlichen Barpreis derselben Route gerechnet.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            {TOTAL_DEAL_COUNT} aktive Treffer
          </span>
          <span>30+ Vielfliegerprogramme</span>
          <span>Ab FRA · MUC · BER · ZRH · VIE</span>
        </div>
      </section>

      {/* Beweiswand */}
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLIC_DEALS.map((deal) => (
            <DealCardB key={deal.id} deal={deal} />
          ))}
        </div>

        {/* Paywall-Kante */}
        <div className="relative mt-4">
          <div className="grid gap-4 blur-[4px] sm:grid-cols-2 lg:grid-cols-3">
            {LOCKED_DEALS.map((deal) => (
              <DealCardB key={deal.id} deal={deal} locked />
            ))}
            <DealCardB deal={{ ...PUBLIC_DEALS[0], id: 'ghost' }} locked />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-background via-background/95 to-background/40">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                <Lock className="size-4" />
                Noch {TOTAL_DEAL_COUNT - PUBLIC_DEALS.length} Treffer
              </div>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Öffentlich zeigen wir die sechs ältesten Funde. Die frischen — und alle
                First- und Business-Treffer — sind im Zugang.
              </p>
            </div>
            <button className="rounded-xl bg-foreground px-6 py-3 font-semibold text-background">
              14 Tage kostenlos testen
            </button>
          </div>
        </div>
      </section>

      {/* Zweiter Beweis: der Wallet-Wert */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Und was liegt bei dir herum?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Verbinde dein AwardWallet-Konto — Mylo liest deine Salden aus allen
              Programmen und rechnet sie in Euro um. Die meisten Nutzer unterschätzen
              ihr Punktevermögen um mehr als die Hälfte.
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

      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Ab 9,99 € im Monat</h2>
        <p className="mt-4 text-muted-foreground">
          14 Tage testen, danach entscheiden. Kein Free-Account, keine Werbung,
          keine weiterverkauften Daten.
        </p>
        <button className="mt-8 rounded-xl bg-foreground px-6 py-3 font-semibold text-background">
          Jetzt starten
        </button>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Eingeloggte Shell — Dashboard                                               */
/* -------------------------------------------------------------------------- */

export function AppB() {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
              <Plane className="size-3.5" />
            </div>
            <span className="font-bold tracking-tight">FlyMylo</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium">
              Neuer Chat
            </button>
            <div className="size-8 rounded-full bg-muted" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* C-lite als Held */}
        <section className="rounded-3xl border bg-card p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Guten Morgen, {MOCK_USER.firstName}. Dein Punktevermögen ist aktuell wert:
              </p>
              <p className="mt-2 text-6xl font-bold tracking-tight tabular-nums">
                {formatEur(MOCK_USER.portfolioValueEur)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Über {MOCK_USER.accounts.length} Programme · zuletzt vor 2 Stunden
                synchronisiert
              </p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">
                Was kann ich damit fliegen?
              </button>
              <button className="rounded-xl border px-5 py-3 text-sm font-semibold">
                Aufschlüsselung
              </button>
            </div>
          </div>

          {/* Balken pro Programm */}
          <div className="mt-8 flex h-3 overflow-hidden rounded-full">
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
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {MOCK_USER.accounts.map((account) => (
              <span key={account.program}>
                {account.program} · {formatEur(account.valueEur)}
              </span>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Kategorie-Kacheln */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Womit soll Mylo helfen?
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Chat ist eine Kachel — aber die größte */}
              <div className="sm:col-span-2 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
                      <MessageSquare className="size-5" />
                    </div>
                    <h3 className="text-lg font-bold">Hey Mylo</h3>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Frag frei heraus — Award-Suche, Transferboni, Reiseplanung.
                      Mylo kennt deine Salden.
                    </p>
                  </div>
                  <ArrowUpRight className="size-5 text-muted-foreground" />
                </div>
              </div>

              {MOCK_CATEGORIES.filter((category) => category.key !== 'deals').map(
                (category) => {
                  const Icon = ICONS[category.icon];
                  const isPreview = category.state === 'preview';
                  return (
                    <div
                      key={category.key}
                      className={`rounded-2xl border bg-card p-5 shadow-sm ${
                        isPreview ? 'border-dashed' : ''
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div
                          className={`flex size-9 items-center justify-center rounded-lg ${
                            isPreview ? 'bg-muted text-muted-foreground' : 'bg-muted'
                          }`}
                        >
                          {isPreview ? <Lock className="size-4" /> : <Icon className="size-4" />}
                        </div>
                        {category.state === 'beta' && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            Beta
                          </span>
                        )}
                        {category.counter && (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                            {category.counter}
                          </span>
                        )}
                      </div>
                      <h3 className={`font-semibold ${isPreview ? 'text-muted-foreground' : ''}`}>
                        {category.label}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{category.tagline}</p>
                      {isPreview && (
                        <p className="mt-3 text-xs font-medium text-muted-foreground">
                          Kommt im Herbst · vormerken
                        </p>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </section>

          {/* Deal-Strom in der Seitenspalte */}
          <aside>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Deals für dich
              </h2>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Alle {TOTAL_DEAL_COUNT}
              </a>
            </div>
            <div className="space-y-3">
              {PUBLIC_DEALS.slice(0, 3).map((deal) => (
                <div key={deal.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{deal.destinationName}</p>
                      <p className="text-xs text-muted-foreground">
                        ab {deal.origin} · {deal.month}
                      </p>
                    </div>
                    {deal.points && (
                      <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                        −{savingsPercent(deal)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold tabular-nums">
                    {deal.points
                      ? `${formatPoints(deal.points)} Pkt. + ${formatEur(deal.taxes)}`
                      : formatEur(deal.cashAvg)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ø Barpreis {formatEur(deal.cashAvg)}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export const VARIANT_B = {
  key: 'B',
  name: 'Dashboard First',
  Landing: LandingB,
  App: AppB,
};
