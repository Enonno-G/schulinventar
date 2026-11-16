# Benutzerhandbuch

Das Schulinventar verwaltet alle Geräte der Schule mit ihren Rechnungen, Lieferscheinen und Garantiedokumenten.
Es läuft im Browser am PC, am Tablet und am Handy. Eine Installation ist nicht nötig.

**Wichtig:** SAP bleibt das führende System. Das Schulinventar ist kein amtlicher Vermögensnachweis. Bei
Widersprüchen gilt der Stand in SAP.

## Inhalt

1. [Anmelden](#1-anmelden)
2. [Wer darf was?](#2-wer-darf-was)
3. [Für alle: Geräte suchen und ansehen](#3-für-alle-geräte-suchen-und-ansehen)
4. [Sekretariat und Rechnungswesen](#4-sekretariat-und-rechnungswesen)
5. [Facility-Management](#5-facility-management)
6. [Administrator](#6-administrator)
7. [Häufige Fragen](#7-häufige-fragen)

## 1. Anmelden

1. Die Adresse des Schulinventars im Browser öffnen (bekommen Sie vom Administrator).
2. E-Mail-Adresse und Passwort eingeben, „Anmelden“ klicken.
3. Beim ersten Mal oben rechts auf **Passwort ändern** klicken und ein eigenes Passwort wählen (mindestens 10 Zeichen).

Nach 30 Minuten ohne Aktivität werden Sie automatisch abgemeldet. Melden Sie sich an fremden Geräten immer mit
**Abmelden** (oben rechts) ab.

## 2. Wer darf was?

Ansehen dürfen alle. Was Sie ändern dürfen, hängt von Ihrer Rolle ab. Knöpfe, die Sie nicht benutzen dürfen, werden
nicht angezeigt.

| Aufgabe                                     | Administrator | Sekretariat und Rechnungswesen | Facility-Management | Lesezugriff |
| ------------------------------------------- | :-----------: | :----------------------------: | :-----------------: | :---------: |
| Geräte suchen, ansehen, Listen exportieren  |       ✓       |               ✓                |          ✓          |      ✓      |
| Gerät anlegen, Kaufdaten ergänzen           |       ✓       |               ✓                |                     |             |
| Raum eines Geräts ändern, Schäden vermerken |       ✓       |               ✓                |          ✓          |             |
| Rechnungen und Lieferscheine hochladen      |       ✓       |               ✓                |                     |             |
| SAP-Import und Export für SAP               |       ✓       |               ✓                |                     |             |
| Räume anlegen und ändern                    |       ✓       |                                |          ✓          |             |
| Inventur                                    |       ✓       |                                |          ✓          |             |
| Geräte ausleihen                            |       ✓       |               ✓                |          ✓          |             |
| Benutzer verwalten                          |       ✓       |                                |                     |             |

## 3. Für alle: Geräte suchen und ansehen

### Ein Gerät finden

1. Im Menü auf **Geräte** klicken.
2. Ins Suchfeld die Inventarnummer (steht beim Strichcode auf dem Gerät), die Seriennummer oder einen Teil der
   Bezeichnung eingeben, z. B. „Beamer“, und **Suchen** klicken.
3. Mit den Feldern **Raum**, **Gerätetyp** und **Garantie endet bis** grenzen Sie die Liste weiter ein.
4. Auf die Inventarnummer klicken, um alles zu einem Gerät zu sehen.

### Was die Detailansicht eines Geräts zeigt

- **Stammdaten:** Inventarnummer, Typ, Seriennummer, Raum, ob das Gerät aus SAP kommt, letzte Inventur
- **Kauf und Garantie:** Kaufdatum, Garantie bis, Lieferant, Anmerkungen (z. B. Schäden)
- **Belege:** Rechnung, Lieferschein und Garantiedokument. Ein Klick auf den Dateinamen öffnet die Datei.
- **Ausleihe:** ob und an wen das Gerät gerade ausgeliehen ist
- **Raumwechsel** und **Änderungsprotokoll:** wer wann was geändert hat

### Alle Geräte eines Raumes

Im Menü auf **Räume** klicken und den Raum auswählen.

### Garantie läuft bald ab

Endet bei Geräten die Garantie in den nächsten 30 Tagen, steht oben in der Geräteliste ein Hinweis. Ein Klick auf
**Anzeigen** listet diese Geräte auf. Sie können auch in der Geräteliste das Häkchen **Garantie endet in den nächsten 30
Tagen** setzen.

### Listen für Excel herunterladen

Jede Liste hat den Knopf **Als CSV herunterladen**. Die Datei öffnet sich mit einem Doppelklick in Excel. Es werden
immer alle Geräte heruntergeladen, die zu den gesetzten Filtern passen, nicht nur die aktuelle Seite. Weitere Listen
finden Sie im Menü unter **Export**.

### Soll-Ist-Vergleich ansehen

Im Menü auf **Soll-Ist-Vergleich** klicken (Erklärung in Abschnitt 5).

## 4. Sekretariat und Rechnungswesen

### Liste aus SAP importieren

So kommen die Geräte aus SAP ins Schulinventar, ohne sie abzutippen.

1. In SAP die Anlagenliste als Excel-Datei (.xlsx) oder CSV-Datei speichern.
2. Im Menü auf **SAP-Import** klicken, die Datei auswählen, **Hochladen und prüfen** klicken.
3. **Welche Spalte enthält was?** Bei jedem Feld die passende Spalte der Liste auswählen. Pflicht sind
   Inventarnummer, Bezeichnung und Raumnummer. Dann **Zuordnung anwenden** klicken. Die Auswahl wird gemerkt und beim
   nächsten Import vorausgewählt. Unter „So sieht die Datei aus“ sehen Sie die ersten Zeilen der Liste.
4. **Vorschau:** Das Programm zeigt, wie viele Geräte neu sind, sich ändern, gleich bleiben oder fehlerhaft sind.
   - Fehlerhafte Zeilen (z. B. fehlender Raum, ungültiges Datum, doppelte Inventarnummer) werden mit Zeilennummer und
     Grund aufgelistet und nicht übernommen. Korrigieren Sie sie in SAP oder in der Datei und importieren Sie die Liste
     danach noch einmal.
   - Räume, die es noch nicht gibt, werden automatisch angelegt.
5. **Übernehmen** klicken. Erst jetzt wird etwas geändert. Mit **Abbrechen** bleibt alles, wie es war.

Gut zu wissen:

- Dieselbe Liste kann man beliebig oft importieren, es entsteht kein Gerät doppelt.
- Daten, die Sie im Schulinventar ergänzt haben (z. B. Seriennummer, Kaufdatum, Belege), bleiben erhalten.
- Steht ein Gerät bei uns in einem anderen Raum als in SAP (weil es umgestellt wurde), bleibt unser Raum. Die
  Abweichung geht mit dem Export an SAP zurück.

### Gerät von Hand anlegen

Für Geräte, die (noch) nicht in SAP stehen: **Geräte** → **Gerät anlegen**. Pflicht sind Inventarnummer, Bezeichnung
und Raum. Datumsfelder haben einen Kalender, Gerätetyp und Lieferant schlagen beim Tippen vorhandene Werte vor.

### Kaufdaten ergänzen

Beim Gerät auf **Bearbeiten** klicken und Kaufdatum, Inbetriebnahme, Garantie bis, Lieferant und Anmerkungen
ergänzen. Ein neuer Lieferant wird automatisch angelegt.

### Rechnung, Lieferschein oder Garantiedokument hochladen

1. Beim Gerät auf **Beleg hochladen** klicken (oder im Menü **Belege** → **Beleg hochladen**).
2. Die Art wählen (Rechnung, Lieferschein, Garantiedokument, Sonstiges) und das Belegdatum eintragen.
3. **Inventarnummern:** Die Nummer des Geräts ist schon eingetragen. Gehört die Rechnung zu mehreren Geräten (z. B. 20
   PCs), alle Nummern eintragen: eine pro Zeile oder mit Komma getrennt. Mit einem Handscanner einfach ein Etikett
   nach dem anderen scannen.
4. Die Datei auswählen: PDF, JPG oder PNG, höchstens 10 MB. Am Handy kann man auch direkt ein Foto machen.
5. **Hochladen** klicken.

Andere Dateien (z. B. .exe, .doc, .json) werden mit einer Meldung abgelehnt. Belege werden unverändert gespeichert
und können während der Aufbewahrungsfrist nicht gelöscht werden. Wurde ein Beleg dem falschen Gerät zugeordnet, öffnen
Sie den Beleg (Menü **Belege**) und klicken bei diesem Gerät auf **Zuordnung entfernen**. Dort können Sie den Beleg auch
weiteren Geräten zuordnen.

### Export für SAP

Nach einer Inventur oder nach Raumänderungen müssen die Änderungen in SAP eingetragen werden.

1. Im Menü auf **Export** klicken. Im Abschnitt **Export für SAP** stehen alle Geräte, deren Raum bei uns anders ist als
   in SAP, die noch nicht in SAP stehen oder die seit dem letzten SAP-Import inventiert wurden.
2. **Datei für SAP herunterladen** klicken. Die Datei enthält Inventarnummer, Raumnummer und Inventurdatum.
3. Eine berechtigte Person spielt die Datei in SAP ein.
4. Danach die neue Liste aus SAP wieder importieren (siehe oben). Dann sind SAP und Schulinventar gleich.

## 5. Facility-Management

### Gerät in einen anderen Raum bringen

Beim Gerät auf **Bearbeiten** klicken, den neuen Raum auswählen und speichern. Der Raumwechsel wird mit Datum
gespeichert. Im selben Formular können Sie unter **Anmerkungen** Schäden oder Reparaturen vermerken.

### Räume verwalten

**Räume** → **Raum anlegen**: Raumnummer (Pflicht, wie in SAP), Bezeichnung und Stockwerk. Ein Raum kann nur gelöscht
werden, wenn ihm keine Geräte mehr zugeordnet sind.

### Inventur

Die Inventur läuft Raum für Raum, so einfach wie an der Supermarktkasse.

1. Im Menü auf **Inventur** klicken. Gibt es noch keine laufende Inventur: einen Namen eingeben (z. B. „Inventur 2027“)
   und **Inventur starten** klicken.
2. In der Raumliste beim Raum, in dem Sie gerade sind, auf **Erfassen** klicken.
3. Für jedes Gerät die Inventarnummer vom Strichcode-Etikett eintippen und **Enter** drücken. Das Feld ist danach sofort
   wieder leer für das nächste Gerät.
   - **Handscanner:** Einfach scannen, der Scanner drückt Enter selbst.
   - **Handy oder Tablet:** Wenn der Knopf **Mit Kamera scannen** angezeigt wird (z. B. Chrome auf Android), die Kamera
     auf den Strichcode halten. Die Kamera bleibt für das nächste Gerät eingeschaltet, bis Sie **Kamera aus** drücken.
4. Oben erscheint nach jedem Gerät eine Rückmeldung:
   - grün: Das Gerät gehört in diesen Raum.
   - rot: Das Gerät gehört laut SAP in einen anderen Raum, oder die Inventarnummer ist nicht im System. Es wird
     trotzdem erfasst und erscheint im Soll-Ist-Vergleich.
5. Rechts steht, welche Geräte laut SAP in diesem Raum sein sollten und noch nicht gefunden wurden.
6. Falsch eingegeben? Bei der Nummer auf **Entfernen** klicken.
7. Mit der Auswahl **Raum** oben in den nächsten Raum wechseln.
8. Wenn alle Räume erledigt sind: In der Raumliste auf **Inventur abschließen** klicken. Dann wird bei allen gefundenen
   Geräten das Inventurdatum gespeichert, und Geräte aus anderen Räumen werden in den Raum gebucht, in dem sie gefunden
   wurden.

Ein Gerät ohne Strichcode oder mit beschädigtem Etikett: Inventarnummer aus der Geräteliste suchen und eintippen.

### Soll-Ist-Vergleich

Im Menü auf **Soll-Ist-Vergleich**. Er zeigt für eine Inventur drei Listen:

- **Fehlen:** Laut SAP in einem Raum, der inventiert wurde, aber nirgends gefunden.
- **In einem anderen Raum gefunden:** Raum laut SAP und Raum, in dem das Gerät gefunden wurde.
- **Nicht in SAP:** Inventarnummer ist unbekannt, oder das Gerät wurde nur im Schulinventar angelegt.

Räume, in denen noch nichts erfasst wurde, stehen extra im Hinweis oben. Ihre Geräte zählen erst als fehlend, wenn dort
mindestens ein Gerät erfasst wurde. Mit **Als CSV herunterladen** bekommen Sie die Liste für Excel, z. B. für die
Korrektur in SAP.

### Geräte ausleihen

1. Das Gerät suchen und öffnen.
2. Unter **Ausleihe** den Namen der Lehrperson und das Rückgabedatum eintragen, **Ausleihen** klicken.
3. Bei der Rückgabe beim Gerät (oder im Menü **Ausleihe**) auf **Zurückgegeben** klicken.

Im Menü **Ausleihe** stehen alle ausgeliehenen Geräte. Überfällige sind rot markiert.

## 6. Administrator

### Benutzer anlegen

**Benutzer** → **Benutzer anlegen**: Name, E-Mail-Adresse, Rolle und ein Start-Passwort (mindestens 10 Zeichen).
Teilen Sie das Passwort der Person persönlich mit und bitten Sie sie, es nach der ersten Anmeldung zu ändern.

### Benutzer ändern oder sperren

Beim Benutzer auf **Bearbeiten** klicken. Rolle ändern, Passwort zurücksetzen (Feld **Neues Passwort** ausfüllen) oder
das Häkchen **Konto ist aktiv** entfernen. Ein deaktiviertes Konto ist sofort abgemeldet und kann sich nicht mehr anmelden. Es muss immer
mindestens ein aktiver Administrator bleiben.

### Betrieb

Installation, Datensicherung, Wiederherstellung und Updates stehen in der [Installationsanleitung](installation.md).

## 7. Häufige Fragen

**Ich habe mein Passwort vergessen.** Der Administrator setzt unter **Benutzer** → **Bearbeiten** ein neues.

**Ich sehe einen Menüpunkt nicht.** Ihre Rolle darf diese Aufgabe nicht erledigen (siehe Abschnitt 2).

**Die CSV-Datei zeigt in Excel alles in einer Spalte.** Excel ist auf ein anderes Trennzeichen eingestellt. In Excel
über **Daten** → **Aus Text/CSV** öffnen und als Trennzeichen „Semikolon“ wählen.

**Die Kamera startet nicht.** Der Browser muss den Zugriff auf die Kamera erlauben, und die Seite muss über HTTPS
geöffnet sein. Funktioniert es nicht, die Nummer eintippen oder einen Handscanner verwenden.

**Ein Gerät steht im Soll-Ist-Vergleich unter „Anderer Raum“, obwohl die Inventur abgeschlossen ist.** Das bleibt so,
bis die Änderung in SAP eingetragen und die neue SAP-Liste importiert wurde (Abschnitt 4, Export für SAP).
