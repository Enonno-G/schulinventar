# Schulinventar

Schulinventar- und Belegverwaltung mit SAP-Datenaustausch. Diplomarbeit an der BHAK/BHAS Spittal an der Drau,
Schuljahr 2026/27 (Projektleiter Erik Nemeth, Projektmitglied Enzo Gratz, Betreuung Gerald Zebedin).

Die Inventardaten aus SAP werden mit Rechnungen, Lieferscheinen und Garantiedokumenten verknüpft. Die Inventur läuft
Raum für Raum über die Inventarnummer auf dem Strichcode, danach zeigt ein Soll-Ist-Vergleich die Abweichungen.
Änderungen gehen als Datei zurück an SAP.

**Neu im Code?** Zuerst [docs/code-erklaert.md](docs/code-erklaert.md) lesen: wie man reinkommt, wie alles
zusammenspielt und wie man etwas ändert.

## Stand

Sprints laut Zeitplan im Pflichtenheft (Version 1.1, Kap. 6.1).

| Bereich                                                            | Stand                          | Sprint |
| ------------------------------------------------------------------ | ------------------------------ | ------ |
| Grundgerüst, Docker, Datenbank für alle Bereiche                   | erste Version                  | 1      |
| Anmeldung, Rollen, automatische Abmeldung, Passwort                | erste Version                  | 1      |
| Benutzerverwaltung, Raumverwaltung                                 | erste Version                  | 1      |
| Geräteliste mit Suche und Filtern, Detailansicht                   | erste Version                  | 1      |
| Gerät anlegen und bearbeiten, Raumwechsel, Protokoll               | erste Version                  | 1      |
| Belege hochladen und mehreren Geräten zuordnen, Lieferant im Gerät | erste Version                  | 2      |
| Listen als CSV-Datei für Excel herunterladen                       | erste Version                  | 2      |
| SAP-Import                                                         | Platzhalter-Seite, Tabellen da | 3      |
| Inventur, Soll-Ist-Vergleich, Export für SAP                       | Platzhalter-Seite, Tabellen da | 4      |
| Datensicherung, HTTPS im Echtbetrieb                               | offen                          | 4–5    |

Was in den noch offenen Bereichen gebaut werden soll, steht oben in [src/seiten/geplant.js](src/seiten/geplant.js).

## Technik

- **Node.js** mit **Express**: der Server, der die Seiten ausliefert
- **EJS**: Seiten-Vorlagen, normales HTML mit Platzhaltern (Ordner `views/`)
- **PostgreSQL**: die Datenbank, SQL steht direkt im Code
- **multer**: nimmt hochgeladene Dateien (Belege) entgegen
- **Docker Compose**: startet Datenbank und App mit einem Befehl

## Starten

Voraussetzung: [Docker Desktop](https://www.docker.com/products/docker-desktop/) läuft.

1. Einmalig: `.env.example` nach `.env` kopieren und die Passwörter ändern (`SESSION_SECRET` mindestens 32 Zeichen).
2. Starten:

   ```bash
   docker compose up -d --build
   ```

3. <http://localhost:3000> öffnen und mit `ADMIN_EMAIL` und `ADMIN_PASSWORD` aus `.env` anmelden.

Beenden mit `docker compose down` (die Daten bleiben erhalten).

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
  seiten/           eine Datei je Bereich: Geräte, Räume, Belege, Export, Benutzer, Anmelden, geplante Bereiche
  anmeldung.js      Rollen und Rechte
  datenbank.js      Verbindung zur Datenbank
  dateien.js        hochgeladene Belege prüfen und speichern
  csv.js            Listen als CSV-Datei für Excel
  protokoll.js      Änderungsprotokoll
  pruefen.js        Eingaben prüfen
  format.js         Datum und Texte auf Deutsch
  passwort.js       Passwörter sicher speichern
  testdaten.js      Testdaten anlegen
views/              Seiten-Vorlagen (HTML mit Platzhaltern), ein Ordner je Bereich
public/             Aussehen (style.css), Logo, ein kleines Script
datenbank/          Aufbau der Datenbank als SQL
test/               automatische Tests
docs/               Erklärung des Codes und Datenmodell
uploads/            hochgeladene Belege beim Entwickeln (nicht auf GitHub, im Docker-Container: /data/uploads)
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

## Sicherheit

- Passwörter nur als Hash (scrypt), höchstens 10 Fehlversuche bei der Anmeldung in 15 Minuten
- Rechte werden am Server geprüft, nicht nur in der Oberfläche
- Alle Datenbankabfragen mit Platzhaltern `$1, $2, …` (Schutz gegen SQL-Injection)
- Alle Werte in den Vorlagen mit `<%= %>` ausgegeben, das maskiert HTML (Schutz gegen eingeschleuste Skripte)
- Belege: nur PDF, JPG und PNG bis `UPLOAD_MAX_MB`, geprüft wird die Dateiendung und der Anfang des Inhalts. Gespeichert
  wird unverändert unter einem zufälligen Namen, mit Prüfsumme. Löschen ist bis zum Ende der Aufbewahrungsfrist
  (`AUFBEWAHRUNG_JAHRE`) gesperrt.
- CSV-Export: Werte, die mit `=`, `+`, `-` oder `@` beginnen, bekommen ein `'` davor, damit Excel sie nicht als Formel
  ausführt
- Automatische Abmeldung nach `SESSION_IDLE_MINUTES` ohne Aktivität, Sicherheits-Header mit Helmet
- Echtbetrieb nur über HTTPS: einen Reverse Proxy (z. B. Caddy) vor den Container setzen und in `.env`
  `COOKIE_SECURE=true` und `TRUST_PROXY=true` eintragen

## Zusammenarbeit

- Neue Arbeit in einem eigenen Branch, z. B. `feature/sap-import`
- Zusammenführen über einen Pull Request, den das andere Teammitglied ansieht (Vier-Augen-Prinzip)
- Vorher `npm test` ausführen
- Änderungen an der Datenbank nur als neue Datei in `datenbank/` (siehe [docs/datenmodell.md](docs/datenmodell.md))
