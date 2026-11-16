# Testprotokoll

Pflichtenheft Kap. 6.4 (Qualität) und Kap. 7.3 (Abnahme): Jede MUSS-Anforderung wird mit mindestens einem Testfall
geprüft. Das Projekt gilt als abgeschlossen, wenn alle MUSS-Anforderungen umgesetzt sind und die Testfälle T1–T8
bestanden sind. Die Abnahme erfolgt durch den Auftraggeber (Ansprechpartner Gerald Zebedin) und wird schriftlich
bestätigt.

Es gibt zwei Arten von Tests:

- **Automatische Tests** prüfen das Programm bei jedem `npm test` mit Testdaten (siehe [README](../README.md#tests)).
  Sie laufen in einer eigenen Testdatenbank.
- **Abnahme** mit dem Auftraggeber in der Testphase (Sprint 5, Jänner 2027) mit echten, anonymisierten Daten.
  Die Spalten dafür sind unten leer und werden bei der Abnahme ausgefüllt.

## Abnahme-Testfälle T1–T8

| Nr. | Testfall                                                                | Erwartetes Ergebnis                                                                                     | Automatischer Test (`test/app.test.js`)                                        | Ergebnis automatisch (28.10.2026) | Abnahme: Datum | Abnahme: Ergebnis | Anmerkung |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | -------------- | ----------------- | --------- |
| T1  | Import einer SAP-Beispielliste mit ca. 100–500 Geräten                  | Alle Geräte sind übernommen, fehlerhafte Zeilen werden angezeigt.                                       | „T1: SAP-Liste importieren, fehlerhafte Zeilen werden angezeigt“ (120 Geräte)  | bestanden                         |                |                   |           |
| T2  | Dieselbe Liste ein zweites Mal importieren                              | Es entstehen keine doppelten Einträge.                                                                  | „T2: dieselbe Liste noch einmal importieren …“                                 | bestanden                         |                |                   |           |
| T3  | Rechnung hochladen und mehreren Geräten zuordnen                        | Die Rechnung ist bei allen Geräten abrufbar.                                                            | „T3: Rechnung hochladen und mehreren Geräten zuordnen“                         | bestanden                         |                |                   |           |
| T4  | Gerät über die Inventarnummer suchen                                    | Das Gerät wird samt Raum und Dokumenten angezeigt.                                                      | „T4: Gerät anlegen und über Inventarnummer oder Seriennummer finden“           | bestanden                         |                |                   |           |
| T5  | Inventur eines Raumes: ein Gerät fehlt, ein fremdes Gerät ist vorhanden | Der Soll-Ist-Vergleich zeigt beide Abweichungen richtig an.                                             | „T5: Inventur eines Raumes – ein Gerät fehlt, ein fremdes Gerät ist vorhanden“ | bestanden                         |                |                   |           |
| T6  | Export für SAP nach einem Raumwechsel                                   | Die Datei enthält Inventarnummer, neue Raumnummer und Inventurdatum und ist in Excel fehlerfrei lesbar. | „T6: Export für SAP nach einem Raumwechsel“                                    | bestanden                         |                |                   |           |
| T7  | Anmeldung mit der Rolle Lesezugriff                                     | Ändern und Löschen ist nicht möglich.                                                                   | „T7: Lesezugriff kann nichts ändern oder löschen“ und weitere Rechte-Tests     | bestanden                         |                |                   |           |
| T8  | Upload einer unzulässigen Datei (z. B. .exe, .json, .script)            | Der Upload wird mit einer verständlichen Meldung abgelehnt.                                             | „T8: unzulässige Dateien werden mit verständlicher Meldung abgelehnt“          | bestanden                         |                |                   |           |

## So werden T1–T8 bei der Abnahme durchgeführt

Vorbereitung: Programm auf dem Testserver installiert ([Installationsanleitung](installation.md)), je Rolle ein
Benutzer angelegt, anonymisierte SAP-Liste und eine Beispielrechnung als PDF liegen bereit.

| Nr. | Schritte                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Als Rechnungswesen: SAP-Import → Liste hochladen → Spalten zuordnen → Vorschau prüfen (Anzahl neu, fehlerhafte Zeilen mit Grund) → Übernehmen. In der Geräteliste die Anzahl vergleichen.          |
| T2  | Dieselbe Liste noch einmal hochladen. Vorschau zeigt 0 neu und 0 geändert. Übernehmen. Anzahl in der Geräteliste ist gleich.                                                                       |
| T3  | Als Rechnungswesen: Gerät öffnen → Beleg hochladen → Rechnung, Inventarnummern von drei Geräten eintragen, PDF wählen → Hochladen. Bei allen drei Geräten die Rechnung öffnen.                     |
| T4  | Als Lesezugriff: Geräte → Inventarnummer eines Geräts mit Beleg suchen → Gerät öffnen. Raum und Beleg werden angezeigt.                                                                            |
| T5  | Als Facility-Management: Inventur starten → einen Raum wählen → alle Geräte bis auf eines erfassen, dazu ein Gerät aus einem anderen Raum → Soll-Ist-Vergleich: 1 fehlt, 1 in anderem Raum.        |
| T6  | Inventur aus T5 abschließen. Als Rechnungswesen: Export → Datei für SAP herunterladen → in Excel öffnen. Das fremde Gerät steht mit dem neuen Raum und dem Inventurdatum drin.                     |
| T7  | Als Lesezugriff anmelden. Es gibt keine Knöpfe zum Anlegen, Bearbeiten, Löschen oder Hochladen. Direkter Aufruf z. B. von `/geraete/neu` zeigt „Kein Zugriff“.                                     |
| T8  | Als Rechnungswesen: Beleg hochladen mit einer .exe-, .json- und .script-Datei sowie einer in .pdf umbenannten .exe-Datei. Jedes Mal erscheint eine verständliche Meldung, nichts wird gespeichert. |

## Weitere automatische Tests

Neben T1–T8 prüfen die automatischen Tests unter anderem:

| Bereich                    | Was geprüft wird                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Anmeldung                  | ohne Anmeldung kein Zugriff, falsches Passwort, Abmelden, deaktiviertes Konto ist sofort abgemeldet               |
| Eingaben prüfen (Kap. 4.3) | Pflichtfelder, ungültige Daten (z. B. 31.02.), Garantie vor Kaufdatum, doppelte Inventar- und Raumnummer          |
| Sicherheit                 | eingeschleuste Skripte werden unschädlich angezeigt, Passwort nur als Hash, Protokoll ist unveränderbar           |
| Raumverwaltung (Kap. 4.8)  | Raumwechsel mit Datum, Raum mit Geräten kann nicht gelöscht werden                                                |
| Belege                     | zu große Datei, unbekannte Inventarnummer, Zuordnung entfernen, Löschschutz in der Aufbewahrungsfrist             |
| SAP-Import                 | Excel-Datei mit Titelzeile und Excel-Datum, Umlaute aus alten Windows-Dateien, geänderte SAP-Daten, falsche Datei |
| Inventur                   | Rückmeldung beim Scannen, Abschluss speichert Inventurdatum und Raum, danach keine Erfassung mehr möglich         |
| Export                     | CSV mit Strichpunkt, deutschem Datum und Schutz gegen Excel-Formeln, Geräteliste mit Filtern                      |
| KANN-Anforderungen         | Ausleihe (nicht doppelt, Rückgabe), Garantie endet in den nächsten 30 Tagen                                       |

Zusätzlich von Hand geprüft (Oktober 2026): Datensicherung mit dem Container `sicherung` und Zurückspielen der Sicherung
in eine leere und in eine bestehende Datenbank.

## Nichtfunktionale Anforderungen (Kap. 5)

Bei der Abnahme zusätzlich prüfen:

| Anforderung                                                   | Wie prüfen                                                    | Ergebnis |
| ------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| Bedienbar am PC, Tablet und Handy                             | Geräteliste, Gerät und Inventur am Handy öffnen               |          |
| Listen bei 1000 Geräten in unter 2 Sekunden                   | `npm run testdaten -- 10000`, Geräteliste und Suche aufrufen  |          |
| Gerät nach dem Scannen in unter 5 Sekunden erfasst            | Inventur mit Handscanner                                      |          |
| Löschen und andere nicht umkehrbare Aktionen werden bestätigt | Raum löschen, Beleg-Zuordnung entfernen, Inventur abschließen |          |
| Verschlüsselte Verbindung (HTTPS)                             | Adresse mit `https://` aufrufen, Schloss-Symbol im Browser    |          |
| Automatische Abmeldung                                        | 30 Minuten nichts tun, dann ist man abgemeldet                |          |
| Tägliche Sicherung                                            | am nächsten Tag im Ordner `sicherungen` nachsehen             |          |

## Bestätigung der Abnahme

| Rolle           | Name           | Datum | Unterschrift |
| --------------- | -------------- | ----- | ------------ |
| Auftraggeber    | Gerald Zebedin |       |              |
| Projektleiter   | Erik Nemeth    |       |              |
| Projektmitglied | Enzo Gratz     |       |              |
