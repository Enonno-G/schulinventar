# Installationsanleitung

So wird das Schulinventar auf einem Server der Schule (oder bei einem Hosting-Anbieter in der EU) eingerichtet.
Für das Entwickeln am eigenen Laptop reicht die Anleitung in der [README](../README.md).

## 1. Was der Server braucht

- Linux (z. B. Ubuntu Server) oder Windows mit **Docker** und **Docker Compose**
- mindestens 2 GB Arbeitsspeicher und 20 GB Speicherplatz (Belege und Sicherungen brauchen am meisten)
- für HTTPS: eine Adresse (Domain), unter der der Server erreichbar ist, z. B. `inventar.hakspittal.at`. Die Ports 80
  und 443 müssen frei sein.

## 2. Programm holen

```bash
git clone https://github.com/Enonno-G/schulinventar.git
```

```bash
cd schulinventar
```

## 3. Einstellungen

Die Vorlage kopieren und mit einem Texteditor anpassen:

```bash
cp .env.example .env
```

| Einstellung                     | Was eintragen                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`             | langes Passwort für die Datenbank (nur Buchstaben, Ziffern, `-` und `_`)           |
| `DATABASE_URL`                  | wird nur beim Entwickeln gebraucht, im Betrieb egal                                |
| `SESSION_SECRET`                | lange Zufallszeichenfolge, mindestens 32 Zeichen (Befehl dafür steht in `.env`)    |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | der erste Administrator. Nach der ersten Anmeldung das Passwort in der App ändern. |
| `DOMAIN`                        | Adresse des Servers, z. B. `inventar.hakspittal.at`                                |
| `COOKIE_SECURE`, `TRUST_PROXY`  | beide auf `true`, sobald HTTPS läuft                                               |
| `SESSION_IDLE_MINUTES`          | nach wie vielen Minuten ohne Aktivität man abgemeldet wird (Standard 30)           |
| `UPLOAD_MAX_MB`                 | größte erlaubte Datei beim Hochladen (Standard 10 MB)                              |
| `AUFBEWAHRUNG_JAHRE`            | Aufbewahrungsfrist der Belege, legt der Auftraggeber fest (Standard 7 Jahre)       |
| `SICHERUNG_TAGE`                | wie lange die täglichen Sicherungen aufgehoben werden (Standard 30 Tage)           |

Die Zeilen `SEED_PASSWORD` und `TEST_DATABASE_URL` sind nur für die Entwicklung.

Die Datei `.env` enthält Passwörter. Sie darf nie auf GitHub oder in eine E-Mail.

## 4. Starten

Mit HTTPS (Echtbetrieb):

```bash
docker compose --profile https up -d --build
```

Ohne HTTPS (nur zum Ausprobieren im Schulnetz):

```bash
docker compose up -d --build
```

Dann im Browser `https://<DOMAIN>` (bzw. `http://<Server>:3000`) öffnen und mit `ADMIN_EMAIL` und `ADMIN_PASSWORD`
anmelden. Beim ersten Start legt das Programm alle Tabellen in der Datenbank selbst an.

Es laufen dann vier Container:

| Container   | Aufgabe                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `db`        | Datenbank (PostgreSQL)                                                    |
| `app`       | das Schulinventar                                                         |
| `sicherung` | sichert jeden Tag Datenbank und Belege in den Ordner `sicherungen`        |
| `https`     | Caddy: verschlüsselte Verbindung (HTTPS), holt das Zertifikat automatisch |

Nachsehen, ob alles läuft:

```bash
docker compose ps
```

Meldungen des Programms ansehen:

```bash
docker compose logs -f app
```

### HTTPS nur im Schulnetz

Ist der Server nur im Schulnetz erreichbar (keine Adresse im Internet), kann Caddy kein öffentliches Zertifikat holen.
Dann im [Caddyfile](../Caddyfile) die Zeile `# tls internal` aktivieren (das `#` entfernen). Die Verbindung ist
trotzdem verschlüsselt, der Browser zeigt aber beim ersten Aufruf eine Warnung.

### Sicherer machen

Im Echtbetrieb in `docker-compose.yml` diese beiden Freigaben entfernen, damit man nur über HTTPS hineinkommt:

- beim Container `db` die Zeilen unter `ports:` (Datenbank nur für die Entwicklung erreichbar)
- beim Container `app` die Zeile `- '3000:3000'`

## 5. Erste Schritte nach der Installation

1. Als Administrator anmelden und unter „Passwort ändern“ ein eigenes Passwort setzen.
2. Unter „Benutzer“ die Konten für Sekretariat, Facility-Management und Lehrpersonen anlegen.
3. Unter „SAP-Import“ die Liste aus SAP hochladen. Die Räume werden dabei automatisch angelegt.
4. Für den Export an SAP das Format prüfen (siehe Abschnitt 8).

## 6. Datensicherung

Der Container `sicherung` sichert einmal am Tag:

- die Datenbank nach `sicherungen/datenbank-JJJJ-MM-TT.dump`
- die hochgeladenen Belege nach `sicherungen/belege-JJJJ-MM-TT.tar.gz`

Ältere Sicherungen als `SICHERUNG_TAGE` werden gelöscht. Der Ordner `sicherungen` liegt auf demselben Server. Er
sollte deshalb regelmäßig zusätzlich auf ein anderes Gerät kopiert werden, z. B. auf ein Netzlaufwerk der Schule.

Eine Sicherung sofort machen, z. B. vor einem Update:

```bash
docker compose run --rm sicherung einmal
```

### Sicherung zurückspielen

Achtung: Das ersetzt alle aktuellen Daten durch den Stand der Sicherung. Im Beispiel die Sicherung vom 15.01.2027.

1. App anhalten:

   ```bash
   docker compose stop app
   ```

2. Datenbank zurückspielen:

   ```bash
   docker compose exec -T db pg_restore --clean --if-exists -U schulinventar -d schulinventar < sicherungen/datenbank-2027-01-15.dump
   ```

3. Belege zurückspielen:

   ```bash
   docker compose run --rm --entrypoint sh -v "$(pwd)/sicherungen:/sicherungen" app -c "cd /data && tar -xzf /sicherungen/belege-2027-01-15.tar.gz"
   ```

4. App wieder starten:

   ```bash
   docker compose start app
   ```

## 7. Update auf eine neue Version

```bash
docker compose run --rm sicherung einmal
```

```bash
git pull
```

```bash
docker compose --profile https up -d --build
```

Neue Tabellen oder Spalten legt das Programm beim Start selbst an (Ordner `datenbank/`).

## 8. Format für SAP einstellen

Das genaue Format der SAP-Liste kommt vom Auftraggeber (Pflichtenheft Kap. 4).

- **Import:** Beim ersten Import wählt man aus, welche Spalte der SAP-Liste die Inventarnummer, die Bezeichnung, den
  Raum usw. enthält. Die Zuordnung wird gemerkt und beim nächsten Mal vorausgewählt.
- **Export an SAP:** Spalten, Reihenfolge, Trennzeichen und Datumsformat stehen ganz oben in
  [src/seiten/export.js](../src/seiten/export.js) bei `SAP_FORMAT`. Nach einer Änderung neu bauen und starten
  (Abschnitt 7, ohne `git pull`).
