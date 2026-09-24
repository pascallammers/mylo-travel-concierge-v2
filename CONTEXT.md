# Kontext & Glossar

Die Sprache dieses Projekts. Kein Spec, keine Implementierungsdetails — nur Begriffe und was sie
genau bedeuten. Wenn ein Begriff hier steht, wird er im Code, in Tickets und im UI so verwendet.

## Punktebewertung

Der Satz, mit dem ein Punkt oder eine Meile in Euro umgerechnet wird. Das Feld, in dem die meisten
Missverständnisse entstehen — „was ist eine Meile wert" hat je nach Kontext fünf verschiedene
Antworten, deshalb sind hier drei getrennte Begriffe nötig.

### Reisewert

Der Cent-Betrag, den ein Punkt bei **geschickter Prämieneinlösung** erzielt. Abhängig von der
Klasse (Economy niedriger als Business, Business niedriger als First). Für Miles & More etwa
0,7 ct in Economy und 1,7 ct in Business.

Das ist der **obere Anker**. Er wird angesetzt, wenn gefragt wird, was ein Bestand als Reise wert
ist — und er ist der Betrag, der von einer Deal-Ersparnis abgezogen wird.

### Wert ohne Plan

Der Cent-Betrag der **schlechtesten realistischen Einlösung**: Worldshop, Zahlungsausgleich,
Hotelbuchung über das Programm. Für Miles & More etwa 0,3 ct.

Das ist der **untere Anker**. Bewusst nicht „Auszahlung" genannt: Programme wie Flying Blue und
Marriott Bonvoy haben gar keinen Auszahlungsweg, ihr Wert ohne Plan wäre sonst null.

### Bewertungssatz

Der konkrete, datierte Wert eines Programms in **Euro-Cent** — nicht US-Cent. Ein Bewertungssatz
gilt immer ab einem Datum und bis zu einem Datum; er wird nie überschrieben, sondern durch eine
neue Zeile abgelöst. Ohne Datum ist eine Zahl kein Bewertungssatz.

## Bestände

### Programm

Eine Punktewährung — Miles & More, Amex Membership Rewards, Flying Blue. Ein Programm hat einen
Reisewert und einen Wert ohne Plan.

Ein Programm ist **nicht** dasselbe wie ein `provider_code`: AwardWallet liefert mehrere Codes für
dieselbe Währung (`klm` und `airfrance` sind beide Flying Blue). Die Zuordnung ist **n:1**, viele
Codes auf ein Programm.

### Bewertbares Konto

Ein Loyalty-Konto, dessen Programm in der Allowlist steht **und** dessen Saldo bekannt ist.
Über das Programm entscheidet **ausschließlich** die Allowlist — nie das Feld `balance_unit`, das
in Produktion falsch befüllt ist (Hotelpunkte erscheinen dort als „nights").

Ein Konto, das nicht bewertbar ist, wird **ausgewiesen**, nie geschätzt. Ein erfundener Satz auf
Statusmeilen angewandt erzeugt eine Zahl, die niemand halten kann.

Wem das Konto gehört, wer den Saldo eingetragen hat und wie alt er ist, ändert an der
Bewertbarkeit **nichts**: Konten anderer Inhaber, handgepflegte Salden und alte Salden zählen voll.
Der Nutzer hat sie selbst in sein AwardWallet gelegt.

### Nicht lesbares Konto

Ein Konto, dessen Saldo **unbekannt** ist, weil AwardWallet sich nicht einloggen oder die Seite des
Programms nicht lesen konnte. Unbekannt ist nicht null: ein nicht lesbares Konto ist fehlender
Wert, kein leeres Konto. Repariert wird es bei AwardWallet, nie bei MYLO.

Ein Konto, bei dem AwardWallet fehlerfrei gelesen hat und das Programm schlicht keinen Saldo
führt, ist **kein** nicht lesbares Konto.

### Handgepflegter Saldo

Ein Saldo, den der Nutzer bei AwardWallet selbst eingetippt hat, statt ihn vom Programm lesen zu
lassen. Er zählt voll und wird am Konto als „von dir eingetragen" gekennzeichnet.

### Wertzahl

Die Gegenüberstellung von Wert ohne Plan und Reisewert über alle bewertbaren Konten eines Nutzers.
Zwei Zahlen, keine. Sie behauptet nicht, was die Punkte „wert sind" — sie zeigt die Spanne
zwischen planloser und geschickter Einlösung.

Ohne ein einziges bewertbares Konto gibt es **keine** Wertzahl — auch keine von null Euro. Null
wäre eine Behauptung über Konten, deren Saldo niemand kennt.

## Deals

Ein Deal ist ein gescannter Flugpreis, der unter dem liegt, was die Strecke üblicherweise kostet.
Es gibt zwei Arten, und sie sind nicht vergleichbar — ihre Prozentzahlen messen Verschiedenes.

### Bar-Deal

Ein Flug, der **in Euro** unter dem Ø Barpreis seiner Strecke liegt. Gemessen, kein Bewertungssatz
im Spiel: „459 € statt Ø 505 €". Ein Bar-Deal führt zu einer Buchungsseite.

### Prämien-Deal

Ein Flug, der **in Punkten plus Zuschlag** zu haben ist und dessen Ersparnis über den Reisewert
der eingesetzten Punkte gerechnet wird. Ein Prämien-Deal gehört immer zu genau einem Programm —
„120.000 Punkte" ohne Programm ist keine Angabe. Er führt nicht zu einer Buchungsseite, sondern
zur Prämiensuche.

### Ersparnis

Ø Barpreis − Zuschläge − **Reisewert der eingesetzten Punkte**.

Weil der Reisewert selbst der Durchschnitt einer geschickten Einlösung ist, misst die Ersparnis
**nicht** „gespart gegenüber bar", sondern **„besser als eine übliche Einlösung derselben
Punkte"**. Ein durchschnittlich guter Award ergibt rechnerisch null Ersparnis. Diese Lesart ist
die einzige, die nicht zirkulär ist — und sie verbietet die Beschriftung „X % gespart".

### Ø Barpreis

Das Mittel der gemessenen Barpreise einer Strecke **in derselben Klasse** über die letzten 90 Tage.
Ohne mindestens drei Messungen gibt es keinen Ø Barpreis — und ohne Ø Barpreis keine Ersparnis.
Ein Meilenpreis ist nie ein Barpreis, auch wenn er in derselben Tabelle steht.

### Güte-Siegel

Die Kennzahl, die *neben* einer Deal-Kachel steht: bei Prämien-Deals der **Cent-Wert pro Punkt**
dieses Treffers neben dem üblichen Reisewert („2,4 ct pro Punkt · üblich 1,7"). Es sortiert und
drosselt, es ist nicht der Preis. Der Preis steht auf der Kachel als **beide Währungen
nebeneinander** („4.000 € bar — oder 600 € + 120.000 Punkte").

Die Ersparnis als Prozentzahl bleibt intern; sie erscheint nicht auf der Kachel.

### Öffentliche Wand

Die Deal-Kacheln, die ohne Login sichtbar sind. Sie ist **gedrosselt** über Stärke (nur Treffer
über der Schwelle), Frische (erst einen Tag nach Fund) und Detailtiefe (Monat statt Datum) —
nie über Menge. Eine leere Wand nennt, wie viele Treffer im Zugang liegen.

### Frische-Vorsprung

Die 24 Stunden, in denen ein Deal nur im Zugang sichtbar ist, bevor er auf die öffentliche Wand
darf. Im Zugang trägt ein solcher Deal das Etikett „Neu · nur für Mitglieder"; einen Countdown
gibt es nicht.

### Erreichbares Programm

Ein Programm, in dem ein Nutzer einen Prämien-Deal tatsächlich bezahlen kann: weil ein
DACH-Transferweg hineinführt (Amex DE, PAYBACK) **oder** weil er dort selbst einen bekannten Saldo
hat. Erreichbarkeit ist damit eine Eigenschaft von Programm **und** Nutzer, nicht des Programms
allein. Auf der öffentlichen Wand zählt nur der Transferweg. Deals aus nicht erreichbaren
Programmen stehen im Zugang eingeklappt und ohne Güte-Siegel.

### Zuletzt gesehen

Der Zeitpunkt, zu dem ein Scan den Deal zuletzt gefunden hat. Ein Deal ist ein Fund, keine
Zusage: ob der Sitz noch da ist, sagt erst die Prämiensuche. Findet ein Scan der Strecke den Deal
nicht mehr, ist er kein Deal mehr, unabhängig von seinem Ablaufdatum.

## Oberfläche

### Bereich

Eine eigenständige Ansicht der Plattform mit eigener Route — Flüge, Deals, Hey Mylo, Alerts,
Karten. Ein Bereich ist **kein Tab im Chat**: Er hat eine URL, einen eigenen Zustand und lässt sich
verlinken.

Der Chat ist ein Bereich unter anderen, nicht mehr die Anwendung selbst. Default-Bereich nach dem
Login ist **Flüge**.

### Rail

Die dauerhaft sichtbare Navigation über alle Bereiche. Auf dem Desktop links als Spalte, auf dem
Telefon als untere Leiste mit vier Positionen plus „Mehr".

Die Rail zeigt **auch gesperrte Bereiche** — mit Schloss und Zähler („Alerts 0/5"). Das ist
Absicht: Sie ist Verkaufsfläche, nicht nur Wegweiser. Eine Rail, die nur zeigt, was schon
freigeschaltet ist, hat ihren halben Zweck verloren.

Die Rail **ersetzt** die frühere Chat-Sidebar; sie steht nicht daneben. Die Chat-Historie ist
seither ein Artefakt des Bereichs Hey Mylo.

### Rail-Kopf

Der obere Abschnitt der Rail, in dem die Wertzahl steht. Ohne verbundenes Loyalty-Konto steht dort
die Verbinden-Aufforderung — **in derselben Fläche, im selben Rahmen**, nie eine graue
Beispielzahl. Die Fläche ist der Wert des Features; sie darf nicht kollabieren, weil der
Leerzustand der Regelfall ist.

### Vorschau-Bereich

Ein Bereich, dessen Funktion noch nicht gebaut ist, der aber in der Rail steht und **anklickbar**
ist. Der Klick führt auf eine echte Route, die das Feature erklärt und „Benachrichtige mich"
anbietet.

Ein Vorschau-Bereich ist damit ein **Nachfragebeleg**, keine Baustelle: Wer klickt und einträgt,
sagt vor dem Bau, welches Feature die nächste Welle anführt.

## Zugang

### Modul

Ein einzeln buchbarer Bereich der Plattform, deckungsgleich mit einer Kategorie der Rail: Flüge,
Deals, Hey Mylo, Hotels, Alerts, Kreditkarten. Jedes Modul ist allein buchbar, es gibt keine
Mindestbuchung; ein Kunde hat eine Menge von Modulen, keine Stufe.

**Hey Mylo** ist die Chat-Oberfläche über alle Module, kein eigener Inhalt. Was der Chat kann, sind
genau die Werkzeuge der gebuchten Module; fehlt ein Modul, nennt der Chat es, statt es zu umgehen.

Ein Modul kann ein anderes **voraussetzen**, solange es keine eigene Fläche hat: Hotels setzt Hey
Mylo voraus, bis eine Hotel-Maske existiert.

**Kreditkarten** ist ein Modul ohne Preis: in jedem Abo enthalten, weil es über Provision verdient.

Ein Modul kann **Beta** sein: Das Etikett steht auf Kachel und Preisseite, und das Modul ist nicht
einzeln buchbar, bis es live ist. Solange es Beta ist, ist es in dem Modul enthalten, das es
voraussetzt: Wer Hey Mylo hat, hat die Hotelsuche ohne Aufpreis. Wer ohnehin alle Module hat
(Altbestand, Trial), hat es sowieso. Live wird ein Beta-Modul erst mit einer eigenen Fläche, denn
erst dann bietet es mehr als das Werkzeug des Anbieters im Chat.

### Werkzeug

Eine einzelne Fähigkeit des Chats, etwa eine Barpreis-Suche oder ein Transfer-Vergleich. Jedes
Werkzeug gehört zu genau **einem** Modul; der Chat nutzt ein Werkzeug nur, wenn der Kunde das Modul
hat. Ob ein Werkzeug angeboten wird, ist eine Entscheidung pro Werkzeug, nie ein Schalter für alle.

Ein Werkzeug, das nicht mehr angeboten wird, ist **stillgelegt**. Es verschwindet nicht stumm: Der
Chat nennt bei einer Anfrage danach den Grund und den Ersatz in der Plattform. Alte Gespräche, in
denen das Werkzeug geantwortet hat, bleiben lesbar.

### Fehlschlag und Ausfall

Ein **Fehlschlag** ist ein Werkzeug-Aufruf, der kein Ergebnis geliefert hat — gleich, ob der
Anbieter nicht erreichbar war, die Sitzung fehlte oder die Antwort nicht lesbar war. Ein Fehlschlag
ist immer als solcher gespeichert; ein Text, der dem Chat den Fehler erklärt, ist **kein** Ergebnis
und zählt nie als Erfolg.

Ein **Ausfall** ist ein Werkzeug, das in den letzten 24 Stunden bei mindestens drei Aufrufen
ausschliesslich Fehlschläge hatte. Ein Ausfall wird gemeldet, nicht nur gezählt.

### Bundle

Eine benannte, günstigere Menge von Modulen, die als Ganzes gebucht wird. Ein Bundle ist ein
Verkaufsobjekt, kein eigener Funktionsumfang: Was der Kunde nutzen kann, sind immer die Module
darin, und ein Bundle ändert kein Kontingent.

Ein Bundle existiert erst, wenn alle seine Module existieren. Eine Preisstufe ohne Inhalt wird
nicht gezeigt.

### Kontingent

Die Menge, die ein Modul von einer zählbaren Funktion erlaubt — Award-Suchen pro Tag,
Chat-Nachrichten pro Kalendermonat, Alerts gleichzeitig. Ein Kontingent wird in der Einheit
genannt, die der Kunde versteht: eine Roundtrip- oder Flex-Date-Suche ist **eine** Suche, egal
wie viele Abfragen sie auslöst. Tokens sind nie ein Kontingent.

Ein erreichtes Kontingent sperrt nur die eine Funktion, nie die Plattform. Der Zähler in der
Rail zeigt das Kontingent, bevor die Funktion gebaut ist („Alerts 0/5").

### Bestandsschutz

Der Preis, den ein Kunde behält, der vor dem Modul-Katalog gekauft hat: **alle Module, auch
künftige**, zum damaligen Preis, solange das Abo nicht unterbrochen wird. Endet nur durch Kündigung
des Kunden — **nie** durch eine Zahlungsstörung, die in der Nachfrist behoben wird, und nie durch
MYLO.

„Founding Member" ist das Etikett für den Bestandsschutz, kein eigenes Leistungspaket. Ein Founding
Member bucht nichts dazu, weil es nichts gibt, das er nicht hat.

### Trial

Vierzehn Tage mit hinterlegter Zahlungsmethode, in denen **alle Module** offen sind, mit einem
eigenen, kleinen Chat-Kontingent. Die Modulwahl trifft der Kunde beim Abschluss; sie gilt ab dem
ersten bezahlten Tag, nicht in der Trial. Eine Trial ist **kein Free-Account**: Sie hat ein Ende und
eine Karte dahinter. Was keine Karte hat, ist die öffentliche Wand.

### Altbestand

Die Abos, die vor dem Modul-Katalog über ThriveCart abgeschlossen wurden und dort **dauerhaft**
weiterlaufen. Ein Altbestands-Abo wird weder umgezogen noch von MYLO gekündigt; es endet nur, wenn
der Kunde selbst kündigt. Der Altbestand hat **alle Module** zum Bestandspreis und ist damit die
konkrete Form des Bestandsschutzes.

