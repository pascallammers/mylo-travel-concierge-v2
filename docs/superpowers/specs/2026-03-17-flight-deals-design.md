# MYLO Flight Deals — Design Spec

> Erstellt: 2026-03-17
> Status: Approved

---

## Ziel

Eigene Flight-Deals-Seite in MYLO, inspiriert von RatePunk. User sehen guenstige Flugangebote ab ihrem Abflughafen, sortiert nach Deal-Qualitaet, mit Affiliate-Monetarisierung und gestaffelten Premium-Features.

---

## Voraussetzungen

- **3-Tier-Abo-System:** Das aktuelle Abo-System ist binaer (Pro/kein Pro). Fuer das Tier-Gating muss die Subscription-Logik auf 3 Stufen (Entdecker/Reise-Profi/Meilen-Experte) erweitert werden. Bis das umgesetzt ist, kann Phase 1 mit einem einfacheren 2-Level-Gating starten (eingeloggt = Economy Deals, Pro = alle Features).
- **Travelpayouts Account:** Registrierung + API-Token beantragen (kostenlos).

---

## 1. Datenquelle & Scanning-Pipeline

### Travelpayouts API (primaer)

- Kostenlose API mit Affiliate eingebaut (Aviasales 40% Rev Share)
- 600 Queries/Minute Rate Limit
- Endpoints: `/v1/prices/cheap`, `/v1/prices/direct`
- Deep Link Generator API fuer Affiliate-Links

### Scan-Mechanismus

- **Frequenz:** Alle 2 Stunden via Qstash Cron
- **Routen-Auswahl (Hybrid):**
  - Basis-Set: ~100 populaere Routen ab DACH-Flughaefen (FRA, MUC, DUS, VIE, ZRH, BER, HAM etc.) zu beliebten Zielen
  - Dynamisch: Routen, die User als Praeferenz gespeichert haben (Abflughafen + Wunschziele)
  - Neue Routen werden automatisch hinzugefuegt, wenn mehrere User Interesse zeigen
- **Pipeline:** Qstash Cron -> Next.js API Route -> Travelpayouts API -> Preis in DB speichern -> Deal-Score berechnen -> Deals mit Score > 60% in `flightDeals` speichern

### Eigene Preishistorie

- Jeder Scan-Durchlauf speichert alle abgefragten Preise in `priceHistory`
- Dient als Grundlage fuer den Deal-Score (Vergleich gegen historischen Durchschnitt + Standardabweichung)
- Je laenger MYLO laeuft, desto praeziser werden die Scores
- Alte Daten werden nicht geloescht — saisonale Muster werden sichtbar
- **Wachstumsrate:** ~100 Routen x 12 Scans/Tag = ~1.200 Zeilen/Tag (~438k/Jahr). Bei Skalierung auf User-Routen entsprechend mehr. Composite-Index auf `(origin, destination, scannedAt)` ist Pflicht.

---

## 2. Datenbank-Schema (neue Tabellen)

Alle Tabellen folgen bestehenden Codebase-Patterns: `text` + `generateId()` fuer PKs, `real` fuer Preise (Cent-Genauigkeit reicht), `json` fuer Arrays, `text` fuer Foreign Keys.

### `flightDeals`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | text (generateId) | Primary Key |
| origin | varchar(3) | IATA Code Abflughafen |
| destination | varchar(3) | IATA Code Zielflughafen |
| destinationName | text | Stadt/Land Name |
| departureDate | timestamp | Fruehestes Abflugdatum |
| returnDate | timestamp | Optionales Rueckflugdatum (nullable) |
| price | real | Aktueller Dealpreis |
| currency | varchar(3) | Waehrung |
| averagePrice | real | Historischer Durchschnitt fuer diese Route |
| priceDifference | real | Ersparnis in absoluter Waehrung |
| priceChangePercent | real | Ersparnis in Prozent |
| dealScore | integer | 0-100, Percentil-Ranking |
| airline | text | Airline Name |
| stops | integer | Anzahl Zwischenstopps |
| flightDuration | integer | Flugdauer in Minuten |
| cabinClass | text | economy / premium_economy / business / first |
| tripType | text | roundtrip / oneway |
| affiliateLink | text | Travelpayouts Deep Link |
| categories | json | Tags: ["last-minute", "trending", "beach", ...] |
| source | text | travelpayouts |
| expiresAt | timestamp | Deal laeuft ab wenn Abflugdatum vorbei oder 72h nach letzter Preisbestaetigung |
| createdAt | timestamp | Erstellt am |
| updatedAt | timestamp | Zuletzt aktualisiert |

**Indexes:** `(origin, expiresAt)`, `(dealScore)`

### `priceHistory`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | text (generateId) | Primary Key |
| origin | varchar(3) | IATA Code |
| destination | varchar(3) | IATA Code |
| price | real | Preis zum Zeitpunkt |
| currency | varchar(3) | Waehrung |
| cabinClass | text | Kabinenklasse |
| source | text | Datenquelle |
| scannedAt | timestamp | Zeitpunkt des Scans |

**Indexes:** `(origin, destination, scannedAt)` — Pflicht fuer Score-Berechnung

### `dealRoutes`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | text (generateId) | Primary Key |
| origin | varchar(3) | IATA Code |
| destination | varchar(3) | IATA Code (nullable fuer "Anywhere") |
| priority | integer | Scan-Prioritaet (1=hoch) |
| source | text | basis / user-generated |
| userCount | integer | Anzahl User mit dieser Praeferenz |
| lastScannedAt | timestamp | Letzter Scan |
| isActive | boolean | Aktiv scannen |
| createdAt | timestamp | Erstellt am |

**Indexes:** `(isActive, priority)`

### `userDealPreferences`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | text (generateId) | Primary Key |
| userId | text | FK zu user |
| originAirports | json | Bevorzugte Abflughaefen ["DUS", "CGN"] |
| preferredDestinations | json | Wunschziele (optional) |
| cabinClass | text | Bevorzugte Klasse |
| maxPrice | real | Budget-Obergrenze (optional) |
| emailDigest | text | none / weekly / daily |
| createdAt | timestamp | Erstellt am |
| updatedAt | timestamp | Zuletzt aktualisiert |

### Deal-Ablaufregeln

Ein Deal laeuft ab wenn:
1. Das Abflugdatum vorbei ist, ODER
2. 72 Stunden seit dem letzten Scan vergangen sind, der den Preis bestaetigt hat (d.h. der naechste Scan hat einen hoeheren Preis oder die Route ist nicht mehr verfuegbar)

---

## 3. AI Deal Score

### Berechnung (Percentil-Ranking)

```
1. Alle historischen Preise fuer die Route (Origin + Destination) aus priceHistory laden
2. Durchschnitt (mean) und Standardabweichung (stddev) berechnen
3. Z-Score = (mean - currentPrice) / stddev
4. Score = Percentil-Rang des Z-Scores (0-100%)
```

- Score > 90%: Aussergewoehnlicher Deal
- Score 70-90%: Sehr guter Deal
- Score 60-70%: Guter Deal
- Score < 60%: Wird nicht als Deal angezeigt

### Einschraenkung Phase 1

- Rein preisbasiert (keine Multi-Faktor-Bewertung)
- Bei wenig Daten (< 10 Datenpunkte fuer eine Route): Fallback auf Travelpayouts-Durchschnitt
- AI Deal Insights (textuelle Erklaerung) kommen spaeter

---

## 4. Frontend — Deal-Seite

### Route

`/[locale]/deals` — eigener Menuepunkt in der Navigation

### Filter-Leiste

- Abflughafen (aus User-Profil vorbelegt, aenderbar)
- Zielort (Anywhere / bestimmte Stadt oder Region)
- Datum/Zeitraum (Anytime / Monat waehlen)
- Reisende + Klasse
- Round-trip / One-way
- Stops (Any / Nonstop / Max 1)

### Kategorie-Tags

Last-Minute, Trending, Beach, City Break, Nature, Family, Business, Wellness

### Deal-Liste

- Sortierung: Preisdifferenz ($), Preisaenderung (%), Preis (aufsteigend)
- Jeder Deal zeigt:
  - Zielort + Land
  - Reisemonat
  - Preisdifferenz (z.B. -584 EUR)
  - Preisaenderung in % (z.B. -73%)
  - Originalpreis (durchgestrichen) + Dealpreis
- Aufklappbar: Airline, Stops, Flugdauer, Abflugzeiten

### CTAs pro Deal

- **Primaer:** "Buchen" -> Affiliate-Link (Travelpayouts/Aviasales)
- **Sekundaer:** "In Mylo suchen" -> Oeffnet Flugsuche im Chat mit vorausgefuellter Route (Duffel)

---

## 5. Tier-Gating

| Feature | Kein Abo / Nicht eingeloggt | Entdecker (19 EUR) | Reise-Profi (47 EUR) | Meilen-Experte (97 EUR) |
|---------|---------------------------|-------------------|---------------------|------------------------|
| Deal-Seite sichtbar | Teaser (Top 5, Preise sichtbar, Login-CTA) | Ja | Ja | Ja |
| Economy Deals anzeigen | Nein | Ja | Ja | Ja |
| Preis + Preisdifferenz | Ja (Top 5) | Ja | Ja | Ja |
| AI Deal Score | Nein | Nein | Ja | Ja |
| AI Deal Insights | Nein | Nein | Ja (spaeter) | Ja (spaeter) |
| Erweiterte Filter | Nein | Nein | Ja | Ja |
| Email-Digest | Nein | Nein | Woechentlich | Taeglich |
| Business/First Class Deals | Nein | Nein | Nein | Ja |
| Error Fare Alerts (Phase 2) | Nein | Nein | Nein | Ja |

### Upgrade-Trigger

- Entdecker sieht Deal-Score als verschwommenes/gesperrtes Element mit "Upgrade fuer AI Deal Score"
- Business/First Class Deals werden als Teaser angezeigt mit Lock-Icon
- Email-Digest Option zeigt "Ab Reise-Profi verfuegbar"

---

## 6. Email-Digest

### Reise-Profi (woechentlich)

- Versand: Montags um 08:00 Uhr
- Inhalt: Top-10 Economy Deals passend zu User-Praeferenzen
- Umsetzung: Qstash Cron -> API Route -> Resend

### Meilen-Experte (taeglich)

- Versand: Taeglich um 08:00 Uhr
- Inhalt: Top-10 Deals inkl. Business/First Class + Error Fares
- Umsetzung: Qstash Cron -> API Route -> Resend

### Email-Template

- Responsive HTML-Email via Resend
- Pro Deal: Zielort, Preis, Ersparnis, Deal-Score (nur Reise-Profi+), Affiliate-Link
- Unsubscribe-Link in jeder Email

---

## 7. Affiliate-Monetarisierung

### Travelpayouts Integration

- Affiliate-Token (X-Access-Token) in alle API-Anfragen
- Deep Links ueber Travelpayouts Deep Link Generator API
- Aviasales: 40% Revenue Share
- Tracking: Click-Through-Rate pro Deal in eigener DB

### Rechtliche Anforderungen (DE/EU)

- Deals mit Affiliate-Link als "Anzeige" kennzeichnen (Medienstaatsvertrag)
- Cookie-Consent fuer Affiliate-Tracking-Cookies (DSGVO + TTDSG)
- Datenschutzerklaerung um Affiliate-Tracking ergaenzen
- Transparenz bei Weiterleitung zu Drittanbietern

---

## 8. Technische Architektur

### Bestehende Infrastruktur (wird wiederverwendet)

- **Neon PostgreSQL + Drizzle ORM** — neue Tabellen im bestehenden Schema
- **Upstash Redis** — Cache fuer Deal-Abfragen
- **Qstash** — Cron-Jobs fuer Scanning + Email-Digest
- **Resend** — Email-Versand
- **Next.js App Router** — Server Components fuer Deal-Seite
- **18.700+ Airport Database** — Bereits vorhanden fuer IATA-Aufloesung

### Neue Komponenten

- `lib/api/travelpayouts-client.ts` — API Client
- `lib/services/deal-scanner.ts` — Scanning-Pipeline + Deal-Score-Berechnung
- `lib/services/deal-email.ts` — Email-Digest-Logik
- `app/[locale]/deals/page.tsx` — Deal-Seite (Server Component)
- `app/[locale]/deals/components/` — Filter, Deal-Cards, etc.
- `app/api/cron/scan-deals/route.ts` — Cron-Endpoint fuer Scanning (Auth via `CRON_SECRET` Bearer Token, wie bestehende Cron-Routes)
- `app/api/cron/deal-digest/route.ts` — Cron-Endpoint fuer Email-Digest (Auth via `CRON_SECRET`)
- DB-Migration fuer neue Tabellen

### Datenfluss

```
Qstash Cron (alle 2h)
  -> /api/cron/scan-deals
    -> dealRoutes laden (Basis + User-generiert)
    -> Travelpayouts API pro Route abfragen
    -> Preise in priceHistory speichern
    -> Deal-Score berechnen (vs. historischer Durchschnitt)
    -> Deals mit Score > 60% in flightDeals speichern/aktualisieren
    -> Abgelaufene Deals entfernen

Qstash Cron (taeglich/woechentlich)
  -> /api/cron/deal-digest
    -> User mit Email-Digest-Praeferenz laden
    -> Top-Deals passend zu User-Praeferenzen filtern
    -> Email via Resend senden

User oeffnet /deals
  -> Server Component laedt Deals aus DB (mit Redis-Cache)
  -> Filtert nach User-Abflughafen + Praeferenzen
  -> Zeigt Deal-Liste mit Tier-Gating
  -> Klick auf "Buchen" -> Affiliate-Link
  -> Klick auf "In Mylo suchen" -> Chat mit vorausgefuellter Route
```
