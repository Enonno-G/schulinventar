#!/bin/sh
# Automatische Datensicherung – Pflichtenheft Kap. 5 „Sicherheit und Datensicherung“
#
# Läuft im Container „sicherung“ (siehe docker-compose.yml). Einmal am Tag werden gesichert:
#   - die Datenbank         -> sicherungen/datenbank-JJJJ-MM-TT.dump
#   - die hochgeladenen Belege -> sicherungen/belege-JJJJ-MM-TT.tar.gz
# Sicherungen, die älter als SICHERUNG_TAGE sind, werden gelöscht.
# Der Ordner „sicherungen“ liegt neben docker-compose.yml und sollte zusätzlich auf ein anderes Gerät kopiert werden.
#
# Wiederherstellen: siehe docs/installation.md, Abschnitt „Sicherung zurückspielen“.

set -e
ZIEL=/sicherungen
TAGE="${SICHERUNG_TAGE:-30}"

sichern() {
  DATUM=$(date +%Y-%m-%d)
  echo "Sicherung $DATUM startet …"
  # pg_dump liest die Zugangsdaten aus PGHOST, PGUSER, PGPASSWORD und PGDATABASE
  pg_dump --format=custom --file="$ZIEL/datenbank-$DATUM.dump"
  tar -czf "$ZIEL/belege-$DATUM.tar.gz" -C /data uploads
  # Alte Sicherungen löschen
  find "$ZIEL" -name 'datenbank-*.dump' -mtime +"$TAGE" -delete
  find "$ZIEL" -name 'belege-*.tar.gz' -mtime +"$TAGE" -delete
  echo "Sicherung $DATUM fertig."
}

if [ "$1" = "einmal" ]; then
  sichern # nur eine Sicherung, z. B. vor einem Update: docker compose run --rm sicherung einmal
  exit 0
fi

while true; do
  sichern
  sleep 86400 # 24 Stunden warten
done
