# Mylo Enhancement Brainstorming

> **Datum:** 15. Januar 2026  
> **Ziel:** Mylo soll mehr über den Kunden wissen und proaktiver agieren

---

## Aktueller Stand

### Was Mylo bereits über den Nutzer weiß

| Feature | Beschreibung | Status |
|---------|--------------|--------|
| **AwardWallet** | Punktestände (Amex, Meilen, Hotel-Punkte) | 🚧 In Arbeit |
| **Supermemory** | Manuell gespeicherte Erinnerungen | ✅ Aktiv |
| **Custom Instructions** | Nutzer-definierte Anweisungen | ✅ Aktiv |
| **Session States** | Letzte Flug-Anfragen pro Chat | ✅ Aktiv |
| **Knowledge Base** | Internes Wissen (nicht nutzer-spezifisch) | ✅ Aktiv |

---

## Ideen für mehr Kontext

### 1. Automatisches Nutzer-Profil

Ein zentrales `userProfile` in der Datenbank mit:

- **Heimatflughafen** - automatisch aus häufigsten Abflügen lernen
- **Bevorzugte Kabine** - Business/Economy aus Suchverhalten ableiten
- **Präferierte Airlines** - Lufthansa, Swiss, etc.
- **Reisestil** - Abenteuer vs. Luxus vs. Budget
- **Allergien/Diät** - wichtig für Hotel/Restaurant-Empfehlungen
- **Reisebegleiter** - allein, Paar, Familie mit Kindern

**Beispiel-Schema:**
```typescript
interface UserProfile {
  homeAirport: string;           // "FRA"
  preferredCabin: "economy" | "premium_economy" | "business" | "first";
  preferredAirlines: string[];   // ["LH", "LX", "OS"]
  travelStyle: "budget" | "comfort" | "luxury" | "adventure";
  dietaryRestrictions: string[]; // ["vegetarian", "gluten-free"]
  typicalTravelParty: "solo" | "couple" | "family" | "group";
  familyMembers?: { name: string; age?: number }[];
}
```

---

### 2. Punkte-Intelligence mit AwardWallet

Wenn wir die Punktestände haben, können wir:

#### Proaktive Empfehlungen
- **"Du hast 120.000 Amex-Punkte - damit könntest du Business nach Thailand fliegen"**
- Automatische Berechnung, welche Destinationen mit aktuellen Punkten erreichbar sind

#### Automatische Benachrichtigungen
- Wenn ein guter Award-Flug verfügbar ist, der zu den Punkten passt
- Lookout-Integration: "Benachrichtige mich wenn Business nach BKK unter 80k Meilen verfügbar ist"

#### Punkte-Ablauf-Warnungen
- **"Deine Miles & More Meilen verfallen in 3 Monaten"**
- Rechtzeitige Erinnerung zur Nutzung oder Verlängerung

#### Transfer-Empfehlungen
- **"Transferiere zu Avianca für 30% Bonus diesen Monat"**
- Aktuelle Transfer-Partner-Boni tracken und empfehlen

#### Sweet-Spot Finder
- Automatisch die besten Award-Redemptions für verfügbare Punkte finden
- "Mit deinen 90k United Meilen kommst du nach Europa in Business für nur 60k"

---

### 3. Reise-Kalender Integration

#### Google Calendar Sync
- Automatisch erkennen wann Urlaube geplant sind
- Freie Zeiträume für Reisevorschläge nutzen

#### Automatische Lookouts
- Basierend auf Kalender-Events: "Urlaub 15.-30. August" → automatische Flugsuche starten
- Proaktiv: "Für deinen Sommerurlaub habe ich günstige Flüge gefunden"

#### Konflikte erkennen
- **"Du hast am 15.12 schon einen Termin"**
- Warnung bei Buchungsversuchen während bestehender Termine

---

### 4. Vergangene Reisen & Präferenzen lernen

#### Neue `travelHistory` Tabelle

```typescript
interface TravelHistoryEntry {
  destination: string;
  departureDate: Date;
  returnDate: Date;
  airline?: string;
  cabin?: string;
  hotel?: string;
  rating?: number;        // 1-5 Sterne Bewertung
  notes?: string;
  source: "manual" | "email" | "calendar" | "booking";
}
```

#### Anwendungsfälle
- **Muster erkennen:** "Du warst schon 3x in Thailand im Januar - soll ich wieder nach Deals schauen?"
- **Vermeidung:** "Du warst letztes Jahr in Bali und fandest es zu voll - vielleicht Lombok?"
- **Hotel-Präferenzen:** "Im Park Hyatt warst du sehr zufrieden - soll ich dort wieder suchen?"

---

### 5. Proaktiver Concierge (Push statt Pull)

#### Deal-Alerts
- Basierend auf Nutzer-Präferenzen automatisch nach Deals suchen
- "Business Class nach Bangkok für 1.200€ - 40% unter Durchschnitt!"

#### Erweiterte Lookouts
- Wiederkehrende Suchen: "Jeden Montag nach günstigen Business-Flügen nach Asien suchen"
- Preis-Schwellen: "Benachrichtige mich wenn unter 1.500€"

#### Newsletter-Digest
- Wöchentliche Zusammenfassung der besten Deals für den Nutzer
- Personalisiert basierend auf Präferenzen und Punktestand

#### Preis-Tracking
- Bestimmte Routen überwachen
- Historische Preise zeigen: "Dieser Flug ist 20% günstiger als üblich"

---

### 6. Kontext-reichere Gespräche

Bei jeder Anfrage automatisch Kontext injizieren:

```markdown
## Nutzer-Kontext für Mylo

- **Heimatflughafen:** FRA (Frankfurt)
- **Punkte-Guthaben:**
  - American Express: 120.000 Punkte
  - Miles & More: 50.000 Meilen
  - Marriott Bonvoy: 80.000 Punkte
- **Bevorzugte Kabine:** Business Class
- **Letzte Suche:** Phuket im März 2026
- **Reisestil:** Luxus, bevorzugt 5-Sterne Hotels
- **Reisebegleiter:** Paar (2 Erwachsene)
- **Allergien:** Keine
```

#### Implementierung
- Vor jedem Chat-Request den Kontext aus DB laden
- Als System-Prompt-Erweiterung einfügen
- Caching für Performance

---

### 7. Multi-Traveler Support

#### Familienmitglieder mit eigenen Profilen
- Partner, Kinder, Eltern als Reisebegleiter anlegen
- Alter der Kinder für Preisberechnungen

#### Gruppen-Suchen
- **"Suche Flüge für mich und meine Frau"**
- Automatisch 2 Passagiere, bevorzugte Sitze nebeneinander

#### Punkte-Pool
- Familien-Punkte zusammenrechnen
- "Zusammen habt ihr 200.000 Punkte - genug für 2x Business nach Asien"

---

### 8. Integrations-Ideen

| Integration | Nutzen | Komplexität |
|-------------|--------|-------------|
| **TripIt** | Bestehende Reisepläne importieren | Mittel |
| **Booking/Hotels.com** | Hotel-Präferenzen & Historie | Hoch |
| **Airline Apps** | Status-Level, Upgrades, gebuchte Flüge | Hoch |
| **Kreditkarten-APIs** | Automatische Punkte-Syncs | Sehr hoch |
| **Google Flights** | Preis-Alerts importieren | Mittel |
| **Flightradar24** | Live-Tracking gebuchter Flüge | Niedrig |

---

## Priorisierungs-Vorschlag

### Phase 1: Kurzfristig (1-2 Wochen)
- ✅ AwardWallet Integration abschließen
- 🎯 Punkte-Intelligence: Einfache Empfehlungen basierend auf Punktestand
- 🎯 Kontext-Injection bei Anfragen (Punkte + letzte Suchen)

### Phase 2: Mittelfristig (1-2 Monate)
- 🎯 Automatisches Nutzer-Profil mit Präferenzen
- 🎯 Verbesserte Lookouts mit Preis-Schwellen
- 🎯 Travel History Tracking (manuell)

### Phase 3: Langfristig (3-6 Monate)
- 🎯 Proaktiver Concierge mit Deal-Alerts
- 🎯 Kalender-Integration
- 🎯 Multi-Traveler Support
- 🎯 Externe Integrationen (TripIt, etc.)

---

## Offene Fragen

1. **Datenschutz:** Wie viel automatisches Tracking ist akzeptabel?
2. **Onboarding:** Wie fragen wir Präferenzen ab ohne zu nerven?
3. **Push-Notifications:** Welcher Kanal? (E-Mail, App, WhatsApp?)
4. **Monetarisierung:** Welche Features sind Premium?

---

## Nächste Schritte

- [ ] AwardWallet Integration fertigstellen
- [ ] Nutzer-Profil Schema definieren
- [ ] Kontext-Injection im Chat implementieren
- [ ] Punkte-basierte Empfehlungen entwickeln
