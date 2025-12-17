## Kontext
Der aktuelle Flight-Tracking-Flow nutzt Amadeus `v2/schedule/flights`, setzt aber im Code den `flight_status` hart auf `scheduled` und verwirft Live-Felder (ETD/ETA/ATD/ATA, Terminal/Gate, Delay). Dadurch sieht der Endnutzer oft nur "Scheduled", selbst wenn der Flug bereits unterwegs ist.

## Befund im Code
- `lib/tools/flight-tracker.ts`
  - Status war hart auf `scheduled` gesetzt.
  - Terminal/Gate/Delay wurden als `null` zurückgegeben.
  - Es wurde nur ein Timing-Wert genutzt, nicht die Qualifier (STD/ETD/ATD, STA/ETA/ATA).

## Ziel
- Live-Timings verwenden (Best-known: ATD/ETD/STD und ATA/ETA/STA)
- Delay in Minuten berechnen
- Status dynamisch ableiten: `scheduled` | `active` | `landed`
- Terminal/Gate soweit vorhanden aus der Response übernehmen
- Optional: Umschaltbar zwischen Test- und Prod-Amadeus via `AMADEUS_ENV`
