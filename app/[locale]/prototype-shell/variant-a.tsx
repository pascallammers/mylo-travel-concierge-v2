/**
 * PROTOTYP (MYLO-30) — Wegwerf-Code, nicht in main folden.
 *
 * VARIANTE A — „Chat bleibt der Ort"
 *
 * These: Der kleinstmögliche Bruch für die 338 Bestandskunden. Die Shell ist
 * kein Dashboard, sondern die heutige Chat-Startseite mit Kontext drumherum.
 * Primäre Affordanz bleibt das Eingabefeld; Kategorien sind Prompt-Starter,
 * die den Chat füllen, keine eigenen Views (Ausnahme: Deals).
 *
 * Landing: Roame-Schule im Aufbau (Suchmaske als Held), point.me-Schule im
 * Beweis (echte Kacheln direkt darunter).
 */

import {
  ArrowRight,
  Bell,
  BedDouble,
  CreditCard,
  Lock,
  MessageSquare,
  Plane,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';
import {
  LOCKED_DEALS,
  MOCK_CATEGORIES,
  MOCK_PROMPTS,
  MOCK_RECENT_CHATS,
  MOCK_USER,
  PUBLIC_DEALS,
  TOTAL_DEAL_COUNT,
  formatEur,
  formatPoints,
  savingsEur,
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
/* Deal-Kachel: kompakte Zeile, Punkte links, Ersparnis rechts                 */
/* -------------------------------------------------------------------------- */

function DealRow({ deal, locked = false }: { deal: MockDeal; locked?: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-foreground/20 ${
        locked ? 'opacity-50' : ''
      }`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Plane className="size-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-semibold">{deal.destinationName}</span>
          <span className="font-mono text-xs text-muted-foreground">
            ab {deal.origin}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {deal.cabin} · {deal.airline} · {deal.month}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {deal.points ? (
          <>
            <div className="font-semibold tabular-nums">
              {formatPoints(deal.points)} Pkt.
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              + {formatEur(deal.taxes)} Steuern
            </div>
          </>
        ) : (
          <div className="font-semibold tabular-nums">{formatEur(deal.cashAvg)}</div>
        )}
      </div>

      {deal.points ? (
        <div className="hidden shrink-0 rounded-lg bg-emerald-500/10 px-3 py-2 text-right sm:block">
          <div className="text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatEur(savingsEur(deal))}
          </div>
          <div className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70">
            gespart
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Landing                                                                     */
/* -------------------------------------------------------------------------- */

export function LandingA() {
  return (
    <div className="min-h-screen bg-background">
      {/* Kopfzeile */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Plane className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">FlyMylo</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#deals" className="hover:text-foreground">Deals</a>
            <a href="#kann" className="hover:text-foreground">Was Mylo kann</a>
            <a href="#preise" className="hover:text-foreground">Preise</a>
          </nav>
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

      {/* Hero mit Suchmaske */}
      <section className="border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3 text-amber-500" />
            Der erste Punkte-Concierge für den deutschsprachigen Raum
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
            Wohin willst du?
            <br />
            <span className="text-muted-foreground">Wir zeigen dir, was es in Punkten kostet.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Mylo durchsucht über 30 Vielfliegerprogramme nach freien Award-Plätzen —
            und rechnet dir vor, was du gegenüber dem Barpreis sparst.
          </p>

          {/* Fake-Suchmaske */}
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border bg-card p-2 shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 rounded-xl px-4 py-3 text-left hover:bg-muted/60">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Von
                </div>
                <div className="font-medium">Frankfurt (FRA)</div>
              </div>
              <div className="hidden w-px bg-border sm:block" />
              <div className="flex-1 rounded-xl px-4 py-3 text-left hover:bg-muted/60">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Nach
                </div>
                <div className="text-muted-foreground">Irgendwohin</div>
              </div>
              <div className="hidden w-px bg-border sm:block" />
              <div className="flex-1 rounded-xl px-4 py-3 text-left hover:bg-muted/60">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Wann
                </div>
                <div className="text-muted-foreground">Flexibel</div>
              </div>
              <button className="flex items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3 font-semibold text-background">
                <Search className="size-4" />
                Suchen
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Kostenlos ausprobieren · Keine Kreditkarte nötig
          </p>
        </div>
      </section>

      {/* Beweis: echte Kacheln */}
      <section id="deals" className="mx-auto max-w-4xl px-4 py-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Das geht gerade ab Deutschland</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Echte Treffer aus den letzten 24 Stunden. Ersparnis gegen den Ø Barpreis
              derselben Route.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {PUBLIC_DEALS.map((deal) => (
            <DealRow key={deal.id} deal={deal} />
          ))}
        </div>

        {/* Paywall-Kante */}
        <div className="relative mt-2">
          <div className="space-y-2 blur-[3px]">
            {LOCKED_DEALS.map((deal) => (
              <DealRow key={deal.id} deal={deal} locked />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-background via-background/90 to-transparent">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4" />
              Noch {TOTAL_DEAL_COUNT - PUBLIC_DEALS.length} weitere Treffer, live aktualisiert
            </div>
            <button className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              14 Tage testen
            </button>
          </div>
        </div>
      </section>

      {/* Kategorien-Teaser */}
      <section id="kann" className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">
            Was Mylo für dich übernimmt
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_CATEGORIES.map((category) => {
              const Icon = ICONS[category.icon];
              return (
                <div key={category.key} className="rounded-2xl border bg-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4" />
                    </div>
                    {category.state !== 'live' && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {category.state === 'beta' ? 'Beta' : 'Bald'}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">{category.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{category.tagline}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="preise" className="border-t">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Deine Punkte sind mehr wert, als du denkst.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Verbinde dein AwardWallet-Konto und Mylo rechnet dir in 30 Sekunden vor,
            was in deinen Salden steckt.
          </p>
          <button className="mt-8 inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 font-semibold text-background">
            14 Tage kostenlos testen
            <ArrowRight className="size-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Eingeloggte Shell                                                           */
/* -------------------------------------------------------------------------- */

export function AppA() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Schmale Topbar — kein Dashboard, nur Kontext */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
            <Plane className="size-3.5" />
          </div>
          <span className="font-bold tracking-tight">FlyMylo</span>
        </div>

        <div className="flex items-center gap-3">
          {/* C-lite als Chip in der Topbar */}
          <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 sm:flex">
            <Sparkles className="size-3.5 text-amber-500" />
            <span className="text-sm">
              <span className="text-muted-foreground">Deine Punkte:</span>{' '}
              <span className="font-semibold tabular-nums">
                {MOCK_USER.portfolioValueRounded}
              </span>
            </span>
          </div>
          <div className="size-8 rounded-full bg-muted" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Hey {MOCK_USER.firstName}, wohin soll's gehen?
          </h1>
          <p className="mt-2 text-muted-foreground">
            Frag mich nach Award-Plätzen, Transferboni oder was deine Meilen wert sind.
          </p>
        </div>

        {/* Eingabefeld bleibt die primäre Affordanz */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="min-h-14 text-muted-foreground">
            Business Class nach Asien im Winter — was geht mit meinen Meilen?
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="flex gap-1.5">
              {MOCK_CATEGORIES.filter((category) => category.state !== 'preview').map(
                (category) => {
                  const Icon = ICONS[category.icon];
                  return (
                    <button
                      key={category.key}
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      <Icon className="size-3.5" />
                      {category.label}
                      {category.state === 'beta' && (
                        <span className="text-[9px] uppercase text-amber-600">Beta</span>
                      )}
                    </button>
                  );
                },
              )}
              {MOCK_CATEGORIES.filter((category) => category.state === 'preview').map(
                (category) => (
                  <button
                    key={category.key}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs font-medium text-muted-foreground/60"
                  >
                    <Lock className="size-3" />
                    {category.label}
                    {category.counter && <span className="tabular-nums">{category.counter}</span>}
                  </button>
                ),
              )}
            </div>
            <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">
              Fragen
            </button>
          </div>
        </div>

        {/* Prompt-Starter */}
        <div className="mt-4 flex flex-wrap gap-2">
          {MOCK_PROMPTS.slice(1).map((prompt) => (
            <button
              key={prompt}
              className="rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Deals als Kontext unter dem Chat, nicht als eigene Welt */}
        <div className="mt-12">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Tag className="size-3.5" />
              Gerade auffällig günstig
            </h2>
            <a href="#" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Alle {TOTAL_DEAL_COUNT} Deals
              <ArrowRight className="size-3.5" />
            </a>
          </div>
          <div className="space-y-2">
            {PUBLIC_DEALS.slice(0, 3).map((deal) => (
              <DealRow key={deal.id} deal={deal} />
            ))}
          </div>
        </div>

        {/* Verlauf */}
        <div className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="size-3.5" />
            Zuletzt
          </h2>
          <div className="flex flex-wrap gap-2">
            {MOCK_RECENT_CHATS.map((chat) => (
              <button
                key={chat}
                className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {chat}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export const VARIANT_A = {
  key: 'A',
  name: 'Chat bleibt der Ort',
  Landing: LandingA,
  App: AppA,
};
