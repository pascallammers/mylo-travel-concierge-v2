# Flight Deals Recherche fuer MYLO

> Stand: 13. Maerz 2026
> Kontext: Tiefgehende Recherche zu RatePunk, Flight Data APIs, AI Deal Score und Affiliate-Monetarisierung

---

## 1. RatePunk - Analyse

### Unternehmen

- **Firma**: Yard Venture, UAB (Vilnius, Litauen)
- **Gruender**: Justinas (Justin) Albertynas (Co-Founder & oeffentliches Gesicht)
- **Gegruendet**: ca. Juni 2020
- **Mitarbeiter**: 12-26
- **Durchschnittsgehalt**: 5.077 EUR/Monat
- **Umsatz 2024**: 1.303.861 EUR (~$1.4M)
- **Nettoverlust 2024**: -535.403 EUR (noch nicht profitabel)
- **ARR**: ca. $400K, $50K MRR (Stand 2023/2024)

### Akquisition

- 2024 von **Kilo** (ehemals Kilo Health) akquiriert
- Kilo: 450 Mitarbeiter, 234 Mio. EUR Jahresumsatz, Vilnius
- Portfolio: Bioma, Pulsetto, Go Health, Moerie, Agava, RatePunk

### Verbindung zu AirGuru

- **AirGuru (UAB Oro Guru)** - litauische Reiseagentur, gegruendet 2013
- Eng verbundenes Unternehmen mit RatePunk (gleiche Mitarbeiter in Stellenanzeigen)
- AirGuru's Travel-Expertise dient vermutlich als Deal-Curation-Grundlage

### Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Backend | Node.js, TypeScript, PostgreSQL, Redis, MongoDB |
| Analytics | ClickHouse (Data Warehouse) |
| Frontend | React, Next.js |
| Mobile | iOS App (4.7/5, 3K Ratings), Android (seit Juli 2025) |
| Infrastruktur | Google Cloud Platform, Firebase |
| Payments | Stripe, PayPal |
| E-Mail | Brevo, Omnisend |
| Extensions | Chrome, Safari, Firefox, Opera, Edge |

### Wie kommen sie an Flugdaten?

RatePunk ist ein **Deal-Aggregator/Curator**, keine Echtzeit-Suchmaschine.

**Primaere Datenquellen:**
- **Affiliate-APIs** von Aggregatoren (Kiwi.com, Kayak) - diese decken ihrerseits hunderte Airlines ab
- **Eigene Scraping/Monitoring-Systeme** fuer zusaetzliche Quellen
- "Third-party integrations and high-performance data workflows" (aus Stellenausschreibungen)

**Die "+243 more" Behauptung ist Marketing:**
- Sie scannen NICHT 250+ Airlines einzeln
- Kiwi.com allein deckt 750+ Carrier ab, Kayak ebenfalls hunderte
- Technisch korrekt (indirekt), aber vereinfacht dargestellt

### Preismodell

| Tier | Preis | Features |
|------|-------|----------|
| Free | $0 | Browser-Extension (Hotels), limitierte Alerts |
| Premium Club | $23.99/Jahr | Economy Deals, woechentlich, international |
| Elite Club | $49.99/Jahr | Business/First Class, Premium Economy, Points&Miles |

**Hinter der Paywall (Elite):**
- Business Class / First Class Deals
- Premium Economy Deals
- Points & Miles Deals
- Alaska/Hawaii/US Territories Deals
- Meet & Greet Service
- $50 Hotel-Voucher

**Pricing-Strategie:**
- Aggressive Fake-Urgency-Timer
- Stark uebertriebene Streichpreise ($229.99 -> $49.99)
- Haeufige Rabattaktionen

### AI Deal Score

- Gelauncht am **30. September 2025**
- Score von **0-100%** - bewertet Gesamtqualitaet, nicht nur Preis
- Faktoren: Gepaeckregeln, Airline-Zuverlaessigkeit, Abflugzeiten, Layover-Qualitaet, Saisonalitaet, versteckte Kosten
- **"AI Deal Insights"**: Textuelle Erklaerung warum der Score so ausfaellt
- Technisch: Wahrscheinlich regelbasiertes System mit ML-Komponenten + ClickHouse fuer Analytics

### Monetarisierung

1. **Subscriptions** (Haupteinnahme): Premium/Elite Club
2. **Affiliate-Revenue**: Kayak Affiliates (CPC/CPA), Kiwi.com Affiliates
3. **Hotel-Buchungen**: Eigene Hotel-Buchungen (neuere Entwicklung, hoehere Margen)

---

## 2. Amadeus API - Status

### KRITISCH: Self-Service wird am 17.07.2026 abgeschaltet!

- **Februar 2026**: Offizielle Bestaetigung der Abschaltung
- **Maerz 2026**: Registrierung neuer Nutzer pausiert
- **17. Juli 2026**: Vollstaendige Abschaltung aller Self-Service API-Keys

**Was bleibt:** Nur Enterprise Portal (kommerzieller Vertrag, Mindestvolumen, individuelle Preisgestaltung).

**Fazit:** Keine Option mehr fuer Startups/kleine Projekte.

---

## 3. Flight Data APIs - Bewertung

### Tier 1: Primaere Empfehlung

#### Travelpayouts (BESTE OPTION)

| Eigenschaft | Details |
|-------------|---------|
| Kosten | Komplett kostenlos |
| Historische Daten | JA - Preistrends, 7 Tage gecacht |
| Affiliate eingebaut | Aviasales (40% Rev Share), Kiwi.com (3% CPA), Trip.com, etc. |
| Rate Limits | 600 Queries/Minute |
| Zugang | Einfache Registrierung, sofort |

**API-Endpoints:**
- `/v1/prices/cheap` - Guenstigste Tickets
- `/v1/prices/direct` - Guenstigste Direktfluege
- `/v3/search_by_price_range` - Suche nach Preisbereichen
- GraphQL-Zugang fuer erweiterte Abfragen
- Deep Link Generator API fuer Affiliate-Links

**Einschraenkung:** Kiwi.com API ueber Travelpayouts erst ab 50.000 MAU.

### Tier 2: Ergaenzend

#### Skyscanner API

| Eigenschaft | Details |
|-------------|---------|
| Kosten | Kostenlos (50% Revenue Share) |
| Auszahlung | GBP 0.07-0.30 pro Click-Out (Fluege) |
| Datenqualitaet | Echtzeit + gecacht, 1.200+ Partner |
| Zugang | Bewerbung noetig, individuell geprueft |
| Historische Daten | Indicative Pricing (gecacht), keine echten Zeitreihen |

#### KAYAK Affiliate Network

| Eigenschaft | Details |
|-------------|---------|
| Kosten | Kostenlos (bis zu 50% Revenue Share) |
| Integration | Deep Links, Widgets, Whitelabel, API |
| Cookie | 30 Tage |
| Zugang | Bewerbung unter affiliates.kayak.com |
| Tracking | Ueber Impact |

#### SerpAPI (Google Flights)

| Eigenschaft | Details |
|-------------|---------|
| Kosten | $25/Mo (1K), $75/Mo (5K), $275/Mo (30K Suchen) |
| Datenqualitaet | Echtzeit Google Flights Scraping |
| Affiliate | Nein (nur Daten) |
| Historische Daten | Nein (aber eigene DB aufbaubar) |

### Tier 3: Langfristig

#### Duffel API

| Eigenschaft | Details |
|-------------|---------|
| Kosten | $3/Buchung + 1% Managed Content |
| Airlines | 300+ (NDC, GDS, LCC) |
| Zugang | Self-Service, sofort |
| Geeignet fuer | Eigene Buchungen (nicht fuer Deal-Anzeige) |

#### FlightAPI.io

| Eigenschaft | Details |
|-------------|---------|
| Kosten | $49-199/Monat |
| Airlines | 700+ |
| Affiliate | Nein |

### Nicht geeignet

| API | Grund |
|-----|-------|
| Amadeus Self-Service | Wird am 17.07.2026 abgeschaltet |
| Sabre/Travelport | $5.000+ Setup, Enterprise-Vertraege noetig |
| AviationStack | Liefert Flugstatus, keine Preisdaten |
| Kiwi.com Tequila direkt | Zugang stark eingeschraenkt seit Mai 2024 |
| Google Flights API | Existiert nicht (QPX Express 2018 eingestellt) |

---

## 4. AI Deal Score - Technische Umsetzung

### Wie die Grossen es machen

| App | Methode | Daten | Accuracy |
|-----|---------|-------|----------|
| Google Flights | 50+ ML-Modelle, 100+ Faktoren | 10 Mrd+ Datenpunkte, ITA Matrix | 94% |
| Hopper | ML Buy/Wait-Vorhersage | 1 Mrd+ Preise/Tag, GDS | ~83% (real) |
| Going.com | Standardabweichungen | Millionen Datenpunkte | Nicht publiziert |
| RatePunk | Regelbasiert + ML | Aggregator-APIs | Nicht publiziert |

### Going.com Methode (empfohlen als Vorbild)

Der statistisch solideste, oeffentlich dokumentierte Ansatz:

- Aktuellen Preis gegen **Mittelwert + Standardabweichung** der Route vergleichen
- Durchschnittlicher Going-Deal: **2.2 Std.-Abw. unter Mittel** = guenstiger als 95% aller Preise
- Top 15%: -2.60 Std.-Abw.
- Top 10%: -2.80 Std.-Abw.
- Top 1%: -3.64 Std.-Abw.
- Scores sind **routenspezifisch** (gleicher Preis kann je nach Route anders bewertet werden)

### Vorgeschlagener MYLO AI Deal Score

```
Gesamt-Score = Preis-Score (60%) + Value-Score (40%)

Preis-Score:
  - Historischen Durchschnitt + Std.-Abw. pro Route berechnen
  - Percentil-Rang des aktuellen Preises bestimmen
  - In 0-100% Score umrechnen

Value-Score:
  - Airline-Reputation (Puenktlichkeit, Service)
  - Gepaeckregeln (inkl. versteckte Kosten)
  - Layover-Qualitaet (Dauer, Flughafen)
  - Abflugzeit (Bequemlichkeit)
  - Anzahl Stops
```

### Top-Features fuer Scoring

1. **Vorlaufzeit** (Tage bis Abflug) - staerkster Einzelpraediktor
2. **Route** (Origin-Destination Paar)
3. **Saisonalitaet** (Monat/Woche des Jahres)
4. **Wochentag** (Abflug und Buchung)
5. **Airline/Carrier**
6. **Anzahl Stops**
7. **Flugdauer**
8. **Kabineklasse**
9. **Historischer Durchschnittspreis**
10. **Tageszeit des Abflugs**

### Error Fare Detection

**Technische Ursachen:**
- Waehrungskonvertierungsfehler (doppelte Konvertierung)
- Dezimalstellenfehler ($400 statt $4.000)
- Fehlende Fuel Surcharges
- Fare Class Misconfiguration
- AI-Pricing-Tool Glitches (2025: 16 Mistake Fares, doppelt so viele wie 2024)

**Detection-Methode:**
- Preis > 3-4 Standardabweichungen unter Mittel = moeglicher Error Fare
- Anomaly Detection (Isolation Forest, Z-Score)
- Cross-Referencing: OTA-Preis vs. Airline-Direktpreis
- Error Fares bestehen typischerweise 1-24 Stunden

### Machbarkeit fuer MYLO

**Option A: Sofort-Start (empfohlen)**
- Travelpayouts Data API fuer historische Preisvergleiche
- Einfache Statistik (Mittelwert, Std.-Abw., Percentile)
- Zeitaufwand: 2-4 Wochen
- Kosten: $0 (Travelpayouts ist kostenlos)

**Option B: Eigene Datensammlung (parallel)**
- Echtzeit-Preise regelmaessig abfragen und speichern
- Nach 2-3 Monaten: Solider Score fuer hochfrequente Routen
- Nach 6-12 Monaten: Saisonale Muster sichtbar

**Option C: Echtes ML (spaeter)**
- XGBoost/LightGBM trainieren (R2 bis 0.98 moeglich)
- Erst relevant fuer Preisvorhersagen ("wird der Preis fallen?")
- Braucht 6+ Monate eigene Daten

**Geschaetzte MVP-Kosten: $200-500/Monat**
- Datenpipeline: Serverless Functions (Vercel/AWS Lambda)
- Storage: PostgreSQL/Convex
- API-Kosten: $0-200/Monat
- ML-Modell: Zunaechst nicht noetig

---

## 5. Affiliate-Programme - Detail

### Uebersicht Einnahmen

| Programm | Modell | Einnahme pro Aktion |
|----------|--------|---------------------|
| KAYAK | Revenue Share (Click-Out) | $0.05-0.40 pro Click-Out |
| Skyscanner | Revenue Share (Click-Out) | GBP 0.07-0.30 pro Click-Out |
| Kiwi.com | CPA (3% auf Buchung) | ca. $11-14 pro Buchung |
| Aviasales/Travelpayouts | Revenue Share 40% | eCPC ca. $0.12 |
| Direkte Airlines (CJ/Awin) | CPA | $5-25 pro Buchung |
| Booking.com (Hotels) | Revenue Share | 25-40% der Booking.com-Provision |

### Revenue-Hochrechnung fuer MYLO

| MAU | Click-Throughs (20%) | Revenue/Monat (geschaetzt) |
|-----|---------------------|---------------------------|
| 10.000 | 2.000 | $200-500 |
| 50.000 | 10.000 | $1.000-2.500 |
| 100.000 | 20.000 | $2.000-5.000 |

### Branchenweite Benchmarks

- Typische Affiliate-Provisionen Travel: 2-6% des Buchungswerts
- Conversion Rate Travel-Affiliate: 1-7% (Kiwi: 6.8%, Branchenschnitt: 1-3%)
- 74% der Reise-Einnahmen kommen aus Online-Buchungen

### Travelpayouts im Detail

- **Aviasales**: 40% Revenue Share, eCPC $0.12
- **Kiwi.com**: 3% Provision, eCPC $0.08 (ab 50K MAU)
- **Trip.com**: Variabel
- **CheapOair**: Variabel
- **Omio** (Zuege/Busse/Fluege)
- Data API kostenlos, Token-basiert (X-Access-Token Header)
- KI-Tool "Drive" fuer automatische Content-Monetarisierung
- Auszahlung: PayPal, Bankueberweisung, monatlich

### Airlines mit Affiliate-Programmen (ueber CJ/Awin)

- Qatar Airways, Emirates, Turkish Airlines, AirAsia
- Etihad Airways, Singapore Airlines
- Lufthansa Group (nicht immer aktiv/offen)
- Typische Provisionen: $5-25 pro Buchung oder 1-5% des Buchungswerts

---

## 6. Rechtliche Aspekte (DE/EU)

### Kennzeichnungspflicht

- Affiliate-Links als **"Anzeige"** oder **"Werbung"** kennzeichnen
- Grundlage: Medienstaatsvertrag (Trennungsgebot)
- Direkt beim Link/Angebot, nicht versteckt
- Verstoss: Abmahnungen und Bussgelder moeglich

### DSGVO

- Tracking-Cookies: **Opt-In erforderlich** (DSGVO + TTDSG)
- Datenschutzerklaerung um Affiliate-Tracking ergaenzen
- AV-Vertrag mit Affiliate-Netzwerken kann erforderlich sein
- App-basiertes Tracking (Advertising IDs): Einwilligung noetig

### Empfehlungen

1. Deals als "Anzeige"/"Werbung" kennzeichnen
2. Cookie-Consent implementieren
3. Datenschutzerklaerung ergaenzen
4. Transparenz bei Weiterleitung zu Drittanbietern
5. Impressumspflicht in der App

---

## 7. Konkurrenz-Analyse

| App | Ansatz | Datenquellen | Monetarisierung | Besonderheit |
|-----|--------|-------------|-----------------|--------------|
| **RatePunk** | Deal-Curation + AI Score | Kiwi.com, Kayak APIs | Subscriptions + Affiliate | Browser-Extension + App |
| **Hopper** | ML Buy/Wait Prediction | GDS (Amadeus, Sabre) | Buchungs-Provisionen, Price Freeze | 1 Mrd+ Preise/Tag |
| **Google Flights** | 50+ ML-Modelle | Eigene Infra, ITA Matrix | Meta-Search | Price Insights, Heatmap |
| **Going.com** | Std.-Abw. + Human Curation | Eigene Scanning-Infra | Subscription ($49-199/Jahr) | Mistake Fare Alerts |
| **Skiplagged** | Hidden City Ticketing | GDS (Sabre, Amadeus) | Buchungs-Provisionen | Airlines klagen dagegen |
| **SecretFlying** | Community + Scanning | Community-Reports | Werbung + Affiliate | 30-60 Min Error Fare Detection |

---

## 8. Empfohlene Strategie fuer MYLO

### Phase 1: Sofort-Start

1. **Travelpayouts** einrichten (kostenlos)
2. **KAYAK Affiliate Network** beantragen
3. Historische Preisdaten sammeln ab Tag 1
4. Simpler Deal-Score (Percentil-Ranking)
5. Economy Deals anzeigen

### Phase 2: Ab 50.000 MAU

6. Kiwi.com/Tequila API direkt integrieren
7. Skyscanner Referral API einbinden
8. Eigenes ML-Modell trainieren
9. Error Fare Detection als Premium-Feature
10. Business Class Deals freischalten

### Phase 3: Skalierung

11. Direkte Airline-Partnerschaften (CJ/Awin)
12. Hotels-Affiliate (Booking.com) als Cross-Selling
13. Eigene Verhandlungen mit Premium-Airlines

### Vorgeschlagene Paket-Zuordnung

| Feature | 19 EUR | 47 EUR | 97 EUR |
|---------|--------|--------|--------|
| Economy Deals | - | Ja | Ja |
| AI Deal Score | - | Ja | Ja |
| Unbegrenzte Deal-Alerts | - | Ja | Ja |
| Business/First Class | - | - | Ja |
| Error Fare Alerts | - | - | Ja |
| Points & Miles Deals | - | - | Ja |
| Premium Economy | - | - | Ja |

---

## Quellen

- ratepunk.com, App Store Listing
- affiliates.kayak.com
- developers.skyscanner.net
- travelpayouts.com, support.travelpayouts.com
- partners.kiwi.com / Tequila-Dokumentation
- duffel.com
- serpapi.com
- GlobeNewswire (RatePunk AI Deal Score Announcement, 30.09.2025)
- Founderoo, Starter Story (RatePunk Revenue/Financials)
- rekvizitai.vz.lt (Yard Venture, UAB Finanzdaten)
- Going.com Blog (Deal Scoring Methodology)
- Amadeus Developer Portal (Shutdown Notice)
- BTS transtats.bts.gov (Historical Flight Data)
- backlinko.com, impact.com, affiliatewp.com (Branchenberichte 2025/2026)
