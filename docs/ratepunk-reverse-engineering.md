# RatePunk Deep Research: Reverse-Engineering der Flight-Deal-Mechanik

> **Erstellt:** Januar 2026  
> **Zweck:** Analyse der Funktionsweise von RatePunk.com zur Implementierung aehnlicher Features in Mylo Travel Concierge

---

## Inhaltsverzeichnis

1. [Unternehmensueberblick](#1-unternehmensueberblick)
2. [Wie funktioniert die Deal-Beschaffung?](#2-wie-funktioniert-die-deal-beschaffung)
3. [Deal-Typen](#3-deal-typen-die-sie-finden)
4. [Technische Architektur](#4-technische-architektur)
5. [Business-Modell](#5-business-modell)
6. [Implementierung fuer Mylo](#6-wie-du-das-fuer-deine-saas-umsetzen-kannst)
7. [Kosten-Schaetzung](#7-api-kosten-schaetzung)
8. [Wichtige Erkenntnisse](#8-wichtige-erkenntnisse)
9. [Konkurrenz-Analyse](#9-konkurrenz-analyse)

---

## 1. Unternehmensueberblick

| Attribut | Wert |
|----------|------|
| **Gruendungsjahr** | 2022 |
| **Tech-Stack** | Next.js 15 (React Server Components) |
| **Nutzer** | 50.000+ laut eigenen Angaben |
| **Hosting** | Vercel (erkennbar an `dpl_` Deployment-IDs) |
| **CMS** | Firebase/Google Cloud Storage fuer Blog-Bilder |

### Produkte

- **Flight Deals Subscription** - Kernprodukt ($23.99/Jahr)
- **Browser Extension** - Hotel-Preisvergleich (Freemium)
- **Mobile App** - Deal-Alerts
- **Dashboard** - Personalisierte Deal-Uebersicht

---

## 2. Wie funktioniert die Deal-Beschaffung?

### A) Datenquellen

RatePunk nutzt hoechstwahrscheinlich eine **Kombination aus mehreren Quellen**:

| Quelle | Beschreibung | API-Kosten | Link |
|--------|--------------|------------|------|
| **Amadeus API** | Groesster GDS-Anbieter, 400+ Airlines | Freemium, dann nutzungsbasiert | [developers.amadeus.com](https://developers.amadeus.com) |
| **Kiwi.com Tequila API** | Virtual Interlining (750+ Carrier) | $20/Monat + Usage | [tequila.kiwi.com](https://tequila.kiwi.com) |
| **Skyscanner API** | Metasearch Engine | Affiliate-basiert | [partners.skyscanner.net](https://partners.skyscanner.net) |
| **Travelpayouts** | Affiliate API fuer Flight-Deals | Provisionsbasiert | [travelpayouts.com](https://www.travelpayouts.com) |
| **Google Flights (ITA Matrix)** | Preis-Referenz | Kein offizieller API-Zugang | - |

### B) Der "24/7 Scanning"-Algorithmus

```
┌─────────────────────────────────────────────────────────────┐
│                    DEAL DETECTION PIPELINE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. DATEN-AGGREGATION (alle 15-60 Minuten)                  │
│     ├── API-Anfragen an Amadeus, Kiwi, etc.                 │
│     ├── Routen: Top 500 Strecken pro Region                 │
│     └── Flexible Daten: +/- 3 Tage                          │
│                                                              │
│  2. ANOMALIE-ERKENNUNG                                       │
│     ├── Vergleich mit 30-Tage Preis-Historie                │
│     ├── Threshold: Preis < 70% vom Durchschnitt             │
│     └── Error Fare Detection: Preis < 50% vom Minimum       │
│                                                              │
│  3. QUALITY SCORING (0-100)                                  │
│     ├── Ersparnis-Prozent (40%)                             │
│     ├── Airline-Qualitaet (20%)                             │
│     ├── Reisezeit/Stopps (20%)                              │
│     └── Verfuegbarkeit/Plaetze (20%)                        │
│                                                              │
│  4. PERSONALISIERUNG                                         │
│     ├── User-Abflughaefen matchen                           │
│     ├── Praeferierte Destinationen                          │
│     └── Budget-Range                                         │
│                                                              │
│  5. DISTRIBUTION                                             │
│     ├── Email-Alerts (2x taeglich)                          │
│     ├── Dashboard-Update (real-time)                        │
│     └── Push-Notifications (Mobile)                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### C) Wie sie "Hidden Deals" finden

1. **Error Fares erkennen:**
   - Tippfehler (z.B. $120 statt $1200)
   - Waehrungsfehler (USD als EUR gebucht)
   - Fehlende Fuel Surcharges
   - System-Glitches bei Airlines

2. **Timing ausnutzen:**
   - Airlines releasen Sitze in Wellen
   - Preise aendern sich nachts (weniger Nachfrage)
   - Flash Sales starten oft Dienstag/Mittwoch

3. **Virtual Interlining (ueber Kiwi):**
   - Kombiniert Tickets verschiedener Airlines
   - Oft 30-50% guenstiger als normale Roundtrips

---

## 3. Deal-Typen die sie finden

| Deal-Typ | Beschreibung | Haeufigkeit | Ersparnis |
|----------|--------------|-------------|-----------|
| **Error Fares** | Tippfehler, Waehrungsfehler | Selten (1-2x/Monat) | 50-90% |
| **Flash Sales** | Airline-Aktionen | Regelmaessig | 20-50% |
| **Positioning Flights** | Einweg-Deals von Airlines | Haeufig | 30-60% |
| **Hidden City** | Guenstigere Verbindungsfluege | Rechtlich heikel | 20-40% |
| **Virtual Interlining** | Kombinierte Tickets | Ueber Kiwi.com | 30-50% |
| **Fuel Dump** | Routing-Tricks | Komplex | 30-70% |

### Beispiel-Deals (aus RatePunk Blog)

- New York → Los Angeles: **$200** (normal $600) = 67% Ersparnis
- USA → Paris: **$378** roundtrip
- USA → Hawaii: **$119** roundtrip
- USA → Iceland: **$387** roundtrip
- USA → London: **$473** roundtrip

---

## 4. Technische Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RATEPUNK SYSTEM ARCHITEKTUR                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      DATA SOURCES LAYER                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │ │
│  │  │ Amadeus  │  │  Kiwi    │  │Skyscanner│  │Travelpay │       │ │
│  │  │   API    │  │   API    │  │   API    │  │   API    │       │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │ │
│  └───────┼─────────────┼─────────────┼─────────────┼─────────────┘ │
│          │             │             │             │                │
│          └─────────────┴──────┬──────┴─────────────┘                │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐ │
│  │                    INGESTION LAYER                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │ │
│  │  │  Cron Jobs   │  │ Message Queue│  │  Rate Limit  │          │ │
│  │  │ (15-60 min)  │  │   (Redis?)   │  │   Handler    │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐ │
│  │                   PROCESSING LAYER                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │ │
│  │  │ Price History│  │  Anomaly     │  │  Deal Score  │          │ │
│  │  │   Tracker    │  │  Detection   │  │  Calculator  │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐ │
│  │                    STORAGE LAYER                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │ │
│  │  │  PostgreSQL  │  │    Redis     │  │ Cloud Storage│          │ │
│  │  │   (Deals)    │  │   (Cache)    │  │   (Assets)   │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐ │
│  │                   APPLICATION LAYER                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │ │
│  │  │   Next.js    │  │    API       │  │   Worker     │          │ │
│  │  │  (Frontend)  │  │  (Backend)   │  │  (Cron/BG)   │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐ │
│  │                   DISTRIBUTION LAYER                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │ │
│  │  │    Email     │  │  Dashboard   │  │    Mobile    │          │ │
│  │  │   (Sendgrid) │  │   (Web App)  │  │  (Push/App)  │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech-Stack Details

| Komponente | Technologie | Hinweise |
|------------|-------------|----------|
| Frontend | Next.js 15 | App Router, React Server Components |
| Hosting | Vercel | Erkennbar an Deployment-IDs |
| CMS | Headless (Firebase?) | Blog-Bilder auf Google Cloud Storage |
| Analytics | Google Tag Manager | GTM-T5W9G5WS |
| Font | Poppins | Custom Variable Font |

---

## 5. Business-Modell

### Revenue Streams

| Stream | Preis | Beschreibung |
|--------|-------|--------------|
| **Flight Deals Subscription** | $23.99/Jahr | Kernprodukt, Email-Alerts |
| **Browser Extension Premium** | $0.99-4.99/Monat | Hotel-Preisvergleich Features |
| **Browser Extension Pro** | $19.99-89.99/Jahr | Erweiterte Features |
| **Affiliate Provisionen** | 1-5% pro Buchung | Wenn User ueber RatePunk buchen |
| **Hotel Wholesale** | Marge auf Rates | Eigenstaendige Buchungsplattform |

### Unit Economics (Geschaetzt)

```
Annahmen:
- 50.000 Nutzer
- 10% zahlen Premium ($23.99/Jahr)
- Affiliate Conversion: 5% der Nutzer buchen
- Durchschnittlicher Ticketpreis: $500
- Affiliate Commission: 2%

Einnahmen:
- Subscriptions: 5.000 × $23.99 = $119.950/Jahr
- Affiliates: 2.500 × $500 × 2% = $25.000/Jahr
- Extension: ~$20.000/Jahr (geschaetzt)

Total: ~$165.000/Jahr (sehr konservativ)
```

---

## 6. Wie du das fuer deine SaaS umsetzen kannst

### Option A: API-basierte Loesung (Empfohlen)

**Vorteile:** Legal, zuverlaessig, skalierbar, wartungsarm

#### Empfohlene APIs

1. **Amadeus Flight Offers Search** (Primaer)
   - Beste Abdeckung (400+ Airlines)
   - Freemium-Tier verfuegbar
   - Offizielle GDS-Daten
   - [Documentation](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search)

2. **Kiwi.com Tequila API** (Sekundaer)
   - Virtual Interlining
   - Guenstige kombinierte Tickets
   - $20/Monat Basiskosten
   - [Documentation](https://tequila.kiwi.com/portal/docs/tequila_api)

3. **Travelpayouts** (Affiliate)
   - Keine API-Kosten
   - Provisionsbasiert
   - Gute Abdeckung
   - [Documentation](https://www.travelpayouts.com/developers/api)

#### Beispiel-Architektur fuer Mylo

```typescript
// lib/services/flight-deals/types.ts
export interface FlightDeal {
  id: string
  origin: string           // IATA Code (z.B. "JFK")
  destination: string      // IATA Code (z.B. "CDG")
  departureDate: Date
  returnDate?: Date
  price: number
  currency: string
  normalPrice: number      // Historischer Durchschnitt
  savingsPercent: number
  airline: string
  dealScore: number        // 0-100
  dealType: 'error_fare' | 'flash_sale' | 'normal_deal'
  expiresAt?: Date
  bookingUrl: string
  source: 'amadeus' | 'kiwi' | 'travelpayouts'
}

export interface UserDealPreferences {
  userId: string
  originAirports: string[]      // ["JFK", "EWR", "LGA"]
  preferredDestinations?: string[]
  maxPrice?: number
  minSavingsPercent?: number    // z.B. 30 = mindestens 30% Ersparnis
  alertFrequency: 'realtime' | 'daily' | 'weekly'
}
```

```typescript
// lib/services/flight-deals/deal-detector.ts
export class FlightDealDetector {
  private priceHistory: PriceHistoryService
  
  /**
   * Berechnet Deal-Score basierend auf mehreren Faktoren
   */
  calculateDealScore(flight: FlightOffer, history: PriceHistory): number {
    const avgPrice = history.averagePrice
    const minPrice = history.minimumPrice
    const currentPrice = flight.price
    
    // Ersparnis vs. Durchschnitt (0-40 Punkte)
    const savingsVsAvg = Math.max(0, (avgPrice - currentPrice) / avgPrice)
    const savingsScore = Math.min(40, savingsVsAvg * 100)
    
    // Ersparnis vs. Minimum (0-30 Punkte) - Error Fare Indicator
    const savingsVsMin = Math.max(0, (minPrice - currentPrice) / minPrice)
    const errorFareScore = Math.min(30, savingsVsMin * 150)
    
    // Airline Qualitaet (0-15 Punkte)
    const airlineScore = this.getAirlineQualityScore(flight.airline)
    
    // Reisezeit/Stopps (0-15 Punkte)
    const convenienceScore = this.getConvenienceScore(flight)
    
    return Math.round(savingsScore + errorFareScore + airlineScore + convenienceScore)
  }
  
  /**
   * Erkennt Error Fares
   */
  isErrorFare(flight: FlightOffer, history: PriceHistory): boolean {
    // Error Fare wenn:
    // 1. Preis < 50% vom historischen Minimum
    // 2. ODER Preis < 30% vom Durchschnitt
    const isPriceTooLow = flight.price < history.minimumPrice * 0.5
    const isMassiveDiscount = flight.price < history.averagePrice * 0.3
    
    return isPriceTooLow || isMassiveDiscount
  }
}
```

```typescript
// lib/services/flight-deals/aggregator.ts
export class FlightDealAggregator {
  private amadeus: AmadeusClient
  private kiwi: KiwiClient
  private detector: FlightDealDetector
  
  /**
   * Scannt alle konfigurierten Routen nach Deals
   */
  async scanForDeals(routes: Route[]): Promise<FlightDeal[]> {
    const deals: FlightDeal[] = []
    
    for (const route of routes) {
      // Parallel von mehreren Quellen fetchen
      const [amadeusFlights, kiwiFlights] = await Promise.all([
        this.amadeus.searchFlights(route),
        this.kiwi.searchFlights(route)
      ])
      
      // Preis-Historie laden
      const history = await this.priceHistory.get(route)
      
      // Deals erkennen
      const allFlights = [...amadeusFlights, ...kiwiFlights]
      for (const flight of allFlights) {
        const score = this.detector.calculateDealScore(flight, history)
        
        // Nur echte Deals (Score > 60)
        if (score >= 60) {
          deals.push(this.toFlightDeal(flight, score, history))
        }
      }
    }
    
    return deals.sort((a, b) => b.dealScore - a.dealScore)
  }
}
```

### Option B: Scraping (Nicht empfohlen)

| Pro | Contra |
|-----|--------|
| Kostenlos | Rechtlich problematisch |
| Alle Daten | Airlines blocken aktiv |
| | Wartungsintensiv |
| | Instabil |

---

## 7. API-Kosten Schaetzung

### Szenario: 10.000 aktive User

| Posten | Kosten/Monat | Details |
|--------|--------------|---------|
| **Amadeus API** | $500-1.500 | ~200k Requests/Monat |
| **Kiwi API** | $50-200 | Backup-Quelle |
| **Redis Cache** | $50-100 | Upstash oder selbst-gehostet |
| **PostgreSQL** | $50-200 | Neon, Supabase, oder PlanetScale |
| **Background Jobs** | $50-100 | Vercel Cron, Inngest, oder selbst |
| **Email Service** | $50-100 | Sendgrid, Resend |
| **TOTAL** | **$750-2.200/Monat** | |

### Break-Even Analyse

```
Kosten: ~$1.500/Monat = $18.000/Jahr

Break-Even bei $23.99/Jahr Subscription:
$18.000 / $23.99 = 751 zahlende Nutzer

Bei 10% Conversion Rate:
751 / 0.1 = 7.510 Gesamt-Nutzer noetig
```

---

## 8. Wichtige Erkenntnisse

### Was RatePunk richtig macht

1. **Fokus auf Personalisierung** - Nur relevante Deals fuer den User
2. **Qualitaet vor Quantitaet** - Nicht alle Deals, nur die besten
3. **Einfache Preisstruktur** - $23.99/Jahr ist ein No-Brainer
4. **Multi-Channel** - Email + Dashboard + App + Extension
5. **Trust-Building** - Featured in Forbes, Washington Post, etc.

### Was du anders machen kannst (fuer Mylo)

1. **In-App Integration** - Keine separate Subscription, Teil von Mylo
2. **Kontext-basierte Deals** - Basierend auf geplanten Reisen
3. **Loyalty-Integration** - Deals die zu Punkten passen (AwardWallet!)
4. **AI-Assistenz** - "Mylo, finde mir einen guenstigen Flug nach Paris"

### Technische Learnings

| Aspekt | Erkenntnis |
|--------|------------|
| **AI/ML** | Wird ueberbewertet - einfache Anomalie-Erkennung reicht |
| **Timing** | Deals halten oft nur 2-6 Stunden - schnelle Detection wichtig |
| **Caching** | Aggressives Caching spart API-Kosten |
| **Rate Limiting** | APIs haben strenge Limits - Queue-System noetig |

---

## 9. Konkurrenz-Analyse

| Service | Preis | Fokus | Staerken | Schwaechen |
|---------|-------|-------|----------|------------|
| **RatePunk** | $23.99/Jahr | Flight Deals | Guenstig, einfach | Nur Deals, keine Buchung |
| **Going (Scott's)** | $49-199/Jahr | Premium Deals | Beste Qualitaet | Teuer |
| **Dollar Flight Club** | $69/Jahr | US-fokussiert | Gute Community | Limited international |
| **Secret Flying** | Kostenlos | Error Fares | Gratis | Keine Personalisierung |
| **Thrifty Traveler** | $99/Jahr | Premium + Miles | Punkte-Deals | Komplex |

### Differenzierung fuer Mylo

```
┌─────────────────────────────────────────────────────────────┐
│                    MYLO DIFFERENTIATOR                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RatePunk/Going/etc:                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Flight Deal → Email Alert → User bucht separat      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Mylo Vision:                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Geplante Reise → AI findet Deal → Mylo bucht        │  │
│  │  + Loyalty Points integriert                         │  │
│  │  + Hotel + Aktivitaeten automatisch                  │  │
│  │  + Concierge-Service fuer alles                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  = End-to-End Travel Experience, nicht nur Deals            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Naechste Schritte fuer Implementierung

### Phase 1: Foundation (2 Wochen)

- [ ] Amadeus Developer Account erstellen
- [ ] Basis-Integration mit Flight Offers Search API
- [ ] Datenmodell fuer Deals und Price History
- [ ] Einfaches Cron-Job Setup

### Phase 2: Deal Detection (2 Wochen)

- [ ] Price History Tracking implementieren
- [ ] Anomalie-Detection Algorithmus
- [ ] Deal Scoring System
- [ ] Dashboard-Integration in Mylo

### Phase 3: Personalisierung (2 Wochen)

- [ ] User Preferences Schema
- [ ] Matching-Algorithmus
- [ ] In-App Notifications
- [ ] AwardWallet Integration (Punkte-optimierte Deals)

### Phase 4: Polish (1 Woche)

- [ ] Performance-Optimierung
- [ ] Error Handling
- [ ] Monitoring/Alerting
- [ ] A/B Testing Setup

---

## Ressourcen

### APIs

- [Amadeus for Developers](https://developers.amadeus.com/)
- [Kiwi.com Tequila API](https://tequila.kiwi.com/)
- [Travelpayouts API](https://www.travelpayouts.com/developers/api)
- [Skyscanner Affiliate API](https://partners.skyscanner.net/)

### Inspiration

- [Secret Flying](https://www.secretflying.com/) - Error Fare Aggregator
- [Going.com](https://www.going.com/) - Premium Flight Deals
- [Dollar Flight Club](https://dollarflightclub.com/) - US Flight Deals
- [Thrifty Traveler](https://thriftytraveler.com/) - Points + Cash Deals

### Tools

- [ITA Matrix](https://matrix.itasoftware.com/) - Preis-Recherche
- [Google Flights](https://www.google.com/flights) - Preis-Tracking
- [FlyerTalk](https://www.flyertalk.com/) - Error Fare Community

---

*Dokument erstellt durch Deep Research von Ratepunk.com - Januar 2026*
