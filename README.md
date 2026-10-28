# Schulinventar

Schulinventar- und Belegverwaltung mit SAP-Datenaustausch. Diplomarbeit an der BHAK/BHAS Spittal an der Drau,
Schuljahr 2026/27 (Projektleiter Erik Nemeth, Projektmitglied Enzo Gratz, Betreuung Gerald Zebedin).

Die Inventardaten aus SAP werden mit Rechnungen, Lieferscheinen und Garantiedokumenten verknüpft. Die Inventur läuft
Raum für Raum über die Inventarnummer auf dem Strichcode, danach zeigt ein Soll-Ist-Vergleich die Abweichungen.
Änderungen gehen als Datei zurück an SAP.

**Neu im Code?** Zuerst [docs/code-erklaert.md](docs/code-erklaert.md) lesen: wie man reinkommt, wie alles
zusammenspielt und wie man etwas ändert.

## Dokumente

| Dokument                                          | Für wen                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| [Benutzerhandbuch](docs/benutzerhandbuch.md)      | alle, die mit dem Programm arbeiten, nach Rollen geordnet |
| [Installationsanleitung](docs/installation.md)    | wer das Programm auf dem Schulserver einrichtet           |
| [Testprotokoll](docs/testprotokoll.md)            | Abnahme mit dem Auftraggeber (Testfälle T1–T8)            |
| [Der Code einfach erklärt](docs/code-erklaert.md) | wer am Code arbeitet                                      |
| [Datenmodell](docs/datenmodell.md)                | Aufbau der Datenbank                                      |

## Stand

Umgesetzt sind alle Anforderungen aus dem Pflichtenheft (Version 1.1, Kap. 4 und 5). Was bei der Testphase mit echten
Daten noch angepasst werden muss, steht unter [Offene Punkte](#offene-punkte).

| Pflichtenheft                                             | Umsetzung                                                 | Sprint |
| --------------------------------------------------------- | --------------------------------------------------------- | ------ |
| 4.1 Import aus SAP (CSV oder Excel)                       | Seite „SAP-Import“: Spaltenzuordnung, Vorschau, Übernahme | 3      |
| 4.2 Formular für zusätzliche Eingaben                     | Geräteformular, Seite „Belege“                            | 1–2    |
| 4.3 Verarbeitung (Prüfungen)                              | beim Import und bei jeder Eingabe                         | 1–3    |
| 4.4 Speicherung in der DB, Änderungsprotokoll             | PostgreSQL, Tabelle `protokoll`                           | 1      |
| 4.5 Anzeige in der Web-App (Liste, Filter, Raum, Detail)  | Seiten „Geräte“ und „Räume“                               | 1      |
| 4.6 Export als CSV für Excel                              | „Als CSV herunterladen“ bei jeder Liste, Seite „Export“   | 2      |
| 4.7 Export im Format für SAP                              | Seite „Export“, Abschnitt „Export für SAP“                | 4      |
| 4.8 Raumverwaltung                                        | Seite „Räume“, Raumwechsel mit Datum                      | 1      |
| 4.9 Soll-Ist-Vergleich                                    | Seite „Soll-Ist-Vergleich“                                | 4      |
| 4.10 Benutzerverwaltung und Anmeldung                     | Seite „Benutzer“, vier Rollen                             | 1      |
| 4.11 Inventur mit Strichcode (Eingabe der Inventarnummer) | Seite „Inventur“, auch mit Handscanner                    | 4      |
| 4.12 KANN: Inventur mit Kamera-Scanner                    | Knopf „Mit Kamera scannen“ (Chrome auf Android)           | 4      |
| 4.13 KANN: Erinnerung bei ablaufender Garantie            | Hinweis und Filter in der Geräteliste (ohne E-Mail)       | 4      |
| 4.14 KANN: Ausleihe von Geräten                           | Seite „Ausleihe“, Ausleihen beim Gerät                    | 4      |
| 5.4 Sicherheit, HTTPS, automatische Datensicherung        | Docker: Container `sicherung` und `https`                 | 4      |

### Offene Punkte

- **Format der SAP-Liste:** Sobald die anonymisierte SAP-Liste vom Auftraggeber da ist, beim Import die Spalten
  zuordnen (wird gemerkt) und das Format des SAP-Exports oben in [src/seiten/export.js](src/seiten/export.js)
  anpassen.
- **Aufbewahrungsfrist** der Belege mit dem Auftraggeber klären (`AUFBEWAHRUNG_JAHRE`, derzeit 7 Jahre).
- **Server oder Hosting** mit der Schule klären, dann nach [docs/installation.md](docs/installation.md) einrichten.
- **Testphase und Abnahme** mit echten Daten im Jänner 2027, Ergebnisse in [docs/testprotokoll.md](docs/testprotokoll.md).

## Technik

- **Node.js** mit **Express**: der Server, der die Seiten ausliefert
- **EJS**: Seiten-Vorlagen, normales HTML mit Platzhaltern (Ordner `views/`)
- **PostgreSQL**: die Datenbank, SQL steht direkt im Code
- **multer**: nimmt hochgeladene Dateien entgegen (Belege, SAP-Liste)
- **read-excel-file**: liest Excel-Dateien (.xlsx) beim SAP-Import
- **Docker Compose**: startet Datenbank, App, Datensicherung und (im Echtbetrieb) HTTPS mit **Caddy**

## Starten

Voraussetzung: [Docker Desktop](https://www.docker.com/products/docker-desktop/) läuft.

1. Einmalig: `.env.example` nach `.env` kopieren und die Passwörter ändern (`SESSION_SECRET` mindestens 32 Zeichen).
2. Starten:

   ```bash
   docker compose up -d --build
   ```

3. <http://localhost:3000> öffnen und mit `ADMIN_EMAIL` und `ADMIN_PASSWORD` aus `.env` anmelden.

Beenden mit `docker compose down` (die Daten bleiben erhalten). Für den Schulserver mit HTTPS und Datensicherung:
[docs/installation.md](docs/installation.md).

## Entwickeln

Beim Entwickeln läuft nur die Datenbank im Container, die App direkt auf dem Laptop. Dann wird bei jeder Änderung am
Code automatisch neu gestartet. Voraussetzung: [Node.js](https://nodejs.org) 22.9 oder neuer.

```bash
npm install
```

```bash
docker compose stop app
```

```bash
docker compose up -d db
```

```bash
npm run dev
```

| Befehl                       | Zweck                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| `npm run dev`                | App starten, startet bei Änderungen am Code automatisch neu  |
| `npm run testdaten`          | 30 Räume, 500 Geräte und je Rolle einen Testbenutzer anlegen |
| `npm run testdaten -- 10000` | 10.000 Geräte für den Performance-Test                       |
| `npm test`                   | automatische Tests                                           |
| `npm run format`             | Code einheitlich formatieren                                 |

Testbenutzer: `admin@test.local`, `rechnungswesen@test.local`, `facility@test.local`, `lesen@test.local`, Passwort
`SEED_PASSWORD` aus `.env`.

### Tests

Die Tests in `test/app.test.js` brauchen eine eigene Testdatenbank. Einmal anlegen:

```bash
docker compose exec db createdb -U schulinventar schulinventar_test
```

Dann in `.env` die Zeile `TEST_DATABASE_URL` aktivieren (das `#` am Anfang entfernen) und `npm test` ausführen.

## Ordner

```text
src/
  start.js          Programm starten
  app.js            welche Adresse wohin führt, Sicherheit, Sitzungen
  seiten/           eine Datei je Bereich: Geräte, Räume, Belege, Ausleihe, Inventur, Soll-Ist,
                    SAP-Import, Export, Benutzer, Anmelden
  anmeldung.js      Rollen und Rechte
  datenbank.js      Verbindung zur Datenbank
  sap-liste.js      SAP-Liste (CSV oder Excel) lesen und Zeile für Zeile prüfen
  dateien.js        hochgeladene Belege prüfen und speichern
  csv.js            CSV-Dateien schreiben und lesen
  protokoll.js      Änderungsprotokoll
  pruefen.js        Eingaben prüfen
  format.js         Datum und Texte auf Deutsch
  passwort.js       Passwörter sicher speichern
  testdaten.js      Testdaten anlegen
views/              Seiten-Vorlagen (HTML mit Platzhaltern), ein Ordner je Bereich
public/             Aussehen (style.css), Logo, kleine Scripts (Bestätigen, Kamera-Scanner)
datenbank/          Aufbau der Datenbank als SQL
sicherung/          Script für die tägliche Datensicherung
test/               automatische Tests und eine Beispiel-Excel-Liste
docs/               Handbuch, Installation, Testprotokoll, Erklärung des Codes, Datenmodell
Caddyfile           Einstellungen für HTTPS
uploads/            hochgeladene Belege beim Entwickeln (nicht auf GitHub, im Docker-Container: /data/uploads)
sicherungen/        die Datensicherungen (nicht auf GitHub)
```

## Rollen und Rechte

Ansehen dürfen alle angemeldeten Benutzer. Geprüft wird immer am Server ([src/anmeldung.js](src/anmeldung.js)).

| Recht                          | Administrator | Sekretariat und Rechnungswesen |   Facility-Management    | Lesezugriff |
| ------------------------------ | :-----------: | :----------------------------: | :----------------------: | :---------: |
| Benutzer verwalten             |       ✓       |                                |                          |             |
| Räume anlegen, ändern, löschen |       ✓       |                                |            ✓             |             |
| Gerät anlegen                  |       ✓       |               ✓                |                          |             |
| Gerät bearbeiten               |       ✓       |               ✓                | nur Raum und Anmerkungen |             |
| Belege hochladen               |       ✓       |               ✓                |                          |             |
| SAP-Import und -Export         |       ✓       |               ✓                |                          |             |
| Inventur                       |       ✓       |                                |            ✓             |             |
| Geräte ausleihen               |       ✓       |               ✓                |            ✓             |             |

## Sicherheit

- Passwörter nur als Hash (scrypt), höchstens 10 Fehlversuche bei der Anmeldung in 15 Minuten
- Rechte werden am Server geprüft, nicht nur in der Oberfläche
- Alle Datenbankabfragen mit Platzhaltern `$1, $2, …` (Schutz gegen SQL-Injection)
- Alle Werte in den Vorlagen mit `<%= %>` ausgegeben, das maskiert HTML (Schutz gegen eingeschleuste Skripte)
- Belege: nur PDF, JPG und PNG bis `UPLOAD_MAX_MB`, geprüft wird die Dateiendung und der Anfang des Inhalts. Gespeichert
  wird unverändert unter einem zufälligen Namen, mit Prüfsumme. Löschen ist bis zum Ende der Aufbewahrungsfrist
  (`AUFBEWAHRUNG_JAHRE`) gesperrt.
- SAP-Import: nur `.csv`, `.txt` und `.xlsx`, ebenfalls am Inhalt geprüft. Geändert wird erst nach der Vorschau.
- CSV-Export: Werte, die mit `=`, `+`, `-` oder `@` beginnen, bekommen ein `'` davor, damit Excel sie nicht als Formel
  ausführt (nicht beim Export für SAP, dort müssen die Werte unverändert bleiben)
- Automatische Abmeldung nach `SESSION_IDLE_MINUTES` ohne Aktivität, Sicherheits-Header mit Helmet
- Echtbetrieb nur über HTTPS (Container `https` mit Caddy) und mit täglicher Datensicherung (Container `sicherung`),
  siehe [docs/installation.md](docs/installation.md)
- Datenschutz: gespeichert werden nur Name, E-Mail-Adresse und Rolle der Benutzer, bei der Ausleihe zusätzlich, wer
  ein Gerät bis wann hat

## Zusammenarbeit

- Neue Arbeit in einem eigenen Branch, z. B. `feature/sap-import`
- Zusammenführen über einen Pull Request, den das andere Teammitglied ansieht (Vier-Augen-Prinzip)
- Vorher `npm test` ausführen
- Änderungen an der Datenbank nur als neue Datei in `datenbank/` (siehe [docs/datenmodell.md](docs/datenmodell.md))
