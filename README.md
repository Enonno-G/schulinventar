# Schulinventar

Schulinventar- und Belegverwaltung mit SAP-Datenaustausch. Diplomarbeit an der BHAK/BHAS Spittal an der Drau,
Schuljahr 2026/27 (Projektleiter Erik Nemeth, Projektmitglied Enzo Gratz, Betreuung Gerald Zebedin).

Die Inventardaten aus SAP werden mit Rechnungen, Lieferscheinen und Garantiedokumenten verknüpft. Die Inventur
läuft Raum für Raum über die Inventarnummer auf dem Strichcode, danach zeigt ein Soll-Ist-Vergleich die
Abweichungen. Änderungen gehen als Datei zurück an SAP.

## Stand

| Bereich                                                    | Stand                     | Sprint  |
| ---------------------------------------------------------- | ------------------------- | ------- |
| Grundgerüst, Docker, Datenbankschema für alle Bereiche     | erste Version             | 1       |
| Anmeldung, Rollen, automatische Abmeldung, Passwort ändern | erste Version             | 2       |
| Benutzerverwaltung (Administrator)                         | erste Version             | 2       |
| Raumverwaltung und Raumansicht                             | erste Version             | 2       |
| Geräteliste mit Suche und Filtern, Detailansicht           | erste Version             | 2 bis 3 |
| Gerät anlegen und bearbeiten, Raumwechsel mit Datum        | erste Version             | 3       |
| Änderungsprotokoll                                         | erste Version             | 3       |
| SAP-Import                                                 | Gerüst, Endpunkte geplant | 3       |
| Belege hochladen und zuordnen                              | Gerüst, Tabellen fertig   | 4       |
| Inventur und Soll-Ist-Vergleich                            | Gerüst, Tabellen fertig   | 4       |
| Export CSV/Excel und SAP                                   | Gerüst                    | 4       |
| Datensicherung, HTTPS im Echtbetrieb                       | offen                     | 4 bis 5 |

Was die Gerüste genau tun sollen, steht jeweils oben in `server/src/modules/<bereich>/routes.js`.
Diese Endpunkte antworten derzeit mit `501` und dem geplanten Sprint.

## Technik

- Backend: Node.js mit Express, PostgreSQL (Zugriff mit `pg`, SQL von Hand), Eingabeprüfung mit Zod
- Oberfläche: React mit Vite, React Router
- Betrieb: Docker Compose mit zwei Containern (`app` und `db`)
- Tests: eingebauter Test-Runner von Node.js (`node --test`)

## Voraussetzungen

- [Node.js](https://nodejs.org) 22.9 oder neuer (empfohlen: aktuelle LTS-Version)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/). Unter Windows braucht Docker Desktop das
  Windows-Subsystem für Linux. Falls es fehlt, in einer Eingabeaufforderung als Administrator `wsl --install`
  ausführen und den Computer neu starten.

## Schnellstart mit Docker

1. `.env.example` nach `.env` kopieren.
2. In `.env` mindestens `POSTGRES_PASSWORD` (auch in `DATABASE_URL`), `SESSION_SECRET` (mindestens 32 Zeichen)
   und `ADMIN_PASSWORD` ändern.
3. Starten:

   ```bash
   docker compose up --build
   ```

4. <http://localhost:3000> öffnen und mit `ADMIN_EMAIL` und `ADMIN_PASSWORD` anmelden.

## Entwicklung

Die Datenbank läuft im Docker-Container, Server und Oberfläche direkt auf dem Laptop. Änderungen am Code sind
damit sofort sichtbar.

```bash
npm install
```

```bash
docker compose up -d db
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Danach <http://localhost:5173> öffnen. `npm run db:seed` legt 30 Räume, 500 Geräte und je Rolle einen Testbenutzer
an (Adressen und Passwort siehe `.env.example`). Für den Performance-Test mit 10.000 Geräten:
`npm run db:seed -- 10000`.

| Befehl               | Zweck                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| `npm run dev`        | Server (Port 3000) und Oberfläche (Port 5173) mit automatischem Neuladen |
| `npm test`           | Tests ausführen                                                          |
| `npm run lint`       | Code mit ESLint prüfen                                                   |
| `npm run format`     | Code mit Prettier einheitlich formatieren                                |
| `npm run build`      | Oberfläche für den Betrieb bauen (`client/dist`)                         |
| `npm run db:migrate` | Datenbankschema aktualisieren (passiert auch beim Start automatisch)     |
| `npm run db:seed`    | Testdaten anlegen                                                        |

### Tests mit Datenbank

Die API-Tests in `server/test/api.test.js` laufen gegen eine eigene Testdatenbank und werden sonst übersprungen.
Einmal anlegen:

```bash
docker compose exec db createdb -U schulinventar schulinventar_test
```

Dann in `.env` die Zeile `TEST_DATABASE_URL` aktivieren und `npm test` ausführen.

## Projektstruktur

```text
server/
  src/
    index.js            Start: Datenbank abwarten, Schema aktualisieren, Server starten
    app.js              Express-App: Sicherheit, Sitzungen, Routen
    config.js           Einstellungen aus .env
    db/                 Verbindung, Migrationen, Testdaten
    lib/                Hilfsfunktionen (Passwörter, Rollen, Protokoll, SQL, Prüfung)
    middleware/         Anmeldung prüfen, Fehlermeldungen
    modules/            ein Ordner je Bereich aus dem Pflichtenheft
  test/
client/
  src/
    pages/              eine Datei je Seite
    components/         wiederverwendbare Bausteine
    api.js, auth.jsx    Verbindung zum Server, Anmeldung
docs/datenmodell.md     ER-Diagramm und Regeln in der Datenbank
```

## Rollen und Berechtigungen

Lesen dürfen alle angemeldeten Benutzer. Geprüft wird immer am Server (`server/src/lib/permissions.js`), die
Oberfläche blendet Knöpfe nur zusätzlich aus.

| Recht                          | Administrator | Sekretariat und Rechnungswesen |   Facility-Management    | Lesezugriff |
| ------------------------------ | :-----------: | :----------------------------: | :----------------------: | :---------: |
| Benutzer verwalten             |       ✓       |                                |                          |             |
| Räume anlegen, ändern, löschen |       ✓       |                                |            ✓             |             |
| Gerät anlegen                  |       ✓       |               ✓                |                          |             |
| Gerät bearbeiten               |       ✓       |               ✓                | nur Raum und Anmerkungen |             |
| Belege hochladen               |       ✓       |               ✓                |                          |             |
| SAP-Import, SAP-Export         |       ✓       |               ✓                |                          |             |
| Inventur durchführen           |       ✓       |                                |            ✓             |             |

## Sicherheit

- Passwörter nur als Hash (scrypt), höchstens 10 Fehlversuche bei der Anmeldung in 15 Minuten
- Sitzung in der Datenbank, Cookie nur für den Server lesbar (`HttpOnly`, `SameSite=Strict`)
- Automatische Abmeldung nach `SESSION_IDLE_MINUTES` ohne Aktivität
- Alle Datenbankabfragen mit Parametern (Schutz gegen SQL-Injection), Sicherheits-Header mit Helmet
- Echtbetrieb nur über HTTPS: Reverse Proxy (z. B. Caddy oder nginx) vor den Container setzen und
  `COOKIE_SECURE=true` sowie `TRUST_PROXY=true` eintragen

## Zusammenarbeit

- Neue Arbeit immer in einem eigenen Branch, z. B. `feature/sap-import`
- Zusammenführen nur über einen Pull Request, den das andere Teammitglied ansieht (Vier-Augen-Prinzip)
- Vor dem Pull Request: `npm run lint` und `npm test`
- Änderungen am Datenbankschema nur als neue Migration (siehe `docs/datenmodell.md`)
