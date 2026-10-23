-- Aufbau der Datenbank (alle Tabellen) für das Schulinventar.
-- Pflichtenheft Kap. 4 „Speicherung in der DB“: Soll-Stand (SAP) und Ist-Stand (Inventur) getrennt,
-- jede Änderung mit Zeitpunkt und Benutzer, hochgeladene Dateien unverändert.
-- Übersicht als Diagramm: docs/datenmodell.md
--
-- Diese Datei wird beim ersten Start automatisch ausgeführt (siehe src/datenbank.js).
-- Spätere Änderungen an den Tabellen NIE hier eintragen, sondern in einer neuen Datei 002_….sql.

-- Setzt die Spalte geaendert_am bei jeder Änderung automatisch auf die aktuelle Zeit
CREATE FUNCTION geaendert_am_setzen() RETURNS trigger AS $$
BEGIN
  NEW.geaendert_am = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Benutzer und Anmeldung -----------------------------------------------------

CREATE TABLE benutzer (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             text NOT NULL,
  email            text NOT NULL,
  rolle            text NOT NULL DEFAULT 'lesen'
                   CHECK (rolle IN ('admin', 'rechnungswesen', 'facility', 'lesen')),
  passwort_hash    text NOT NULL,               -- nie das Passwort selbst, nur der Hash
  aktiv            boolean NOT NULL DEFAULT true,
  letzte_anmeldung timestamptz,
  angelegt_am      timestamptz NOT NULL DEFAULT now(),
  geaendert_am     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX benutzer_email_eindeutig ON benutzer (lower(email));
CREATE TRIGGER benutzer_geaendert BEFORE UPDATE ON benutzer
  FOR EACH ROW EXECUTE FUNCTION geaendert_am_setzen();

-- Wer gerade angemeldet ist. Aufbau ist vom Paket connect-pg-simple vorgegeben.
CREATE TABLE sitzungen (
  sid    varchar NOT NULL PRIMARY KEY,
  sess   json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX sitzungen_ablauf ON sitzungen (expire);


-- Räume und Geräte -----------------------------------------------------------

CREATE TABLE raeume (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nummer       text NOT NULL UNIQUE,            -- Raumnummer, in SAP verpflichtend
  bezeichnung  text,
  stockwerk    text,
  angelegt_am  timestamptz NOT NULL DEFAULT now(),
  geaendert_am timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER raeume_geaendert BEFORE UPDATE ON raeume
  FOR EACH ROW EXECUTE FUNCTION geaendert_am_setzen();

CREATE TABLE lieferanten (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  angelegt_am timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE geraete (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventarnummer    text NOT NULL UNIQUE,       -- steht auch im Strichcode auf dem Gerät
  bezeichnung       text NOT NULL,
  typ               text,                       -- z. B. PC, Beamer, Drucker, Tisch
  seriennummer      text,
  raum_id           integer NOT NULL REFERENCES raeume (id) ON DELETE RESTRICT, -- aktueller Raum
  anschaffungsdatum date,
  kaufdatum         date,
  inbetriebnahme    date,
  garantie_bis      date,
  lieferant_id      integer REFERENCES lieferanten (id),
  anmerkungen       text,                       -- z. B. Schäden oder Reparaturen
  herkunft          text NOT NULL DEFAULT 'manuell' CHECK (herkunft IN ('sap', 'manuell')),
  -- Soll-Stand laut letztem SAP-Import. Diese Spalten ändert nur der Import.
  sap_raumnummer    text,
  sap_daten         jsonb,                      -- alle Werte der Zeile aus der SAP-Liste
  sap_importiert_am timestamptz,
  letzte_inventur   date,                       -- für den Export an SAP
  angelegt_am       timestamptz NOT NULL DEFAULT now(),
  geaendert_am      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geraete_raum ON geraete (raum_id);
CREATE INDEX geraete_typ ON geraete (typ);
CREATE INDEX geraete_garantie ON geraete (garantie_bis);
CREATE TRIGGER geraete_geaendert BEFORE UPDATE ON geraete
  FOR EACH ROW EXECUTE FUNCTION geaendert_am_setzen();

-- Jeder Raumwechsel mit Zeitpunkt. Die Raumnummern werden mitgespeichert,
-- damit man sie auch nach dem Löschen eines Raumes noch lesen kann.
CREATE TABLE raumwechsel (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geraet_id       integer NOT NULL REFERENCES geraete (id) ON DELETE CASCADE,
  von_raum_id     integer REFERENCES raeume (id) ON DELETE SET NULL,
  von_raumnummer  text,
  nach_raum_id    integer REFERENCES raeume (id) ON DELETE SET NULL,
  nach_raumnummer text NOT NULL,
  anlass          text NOT NULL DEFAULT 'manuell' CHECK (anlass IN ('manuell', 'import', 'inventur')),
  benutzer_id     integer REFERENCES benutzer (id),
  zeitpunkt       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raumwechsel_geraet ON raumwechsel (geraet_id, zeitpunkt DESC);


-- Belege: Rechnungen, Lieferscheine, Garantiedokumente (ab Sprint 4) ----------

CREATE TABLE belege (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  art             text NOT NULL CHECK (art IN ('rechnung', 'lieferschein', 'garantie', 'sonstiges')),
  dateiname       text NOT NULL,                -- Name beim Hochladen
  gespeichert_als text NOT NULL UNIQUE,         -- Name im Upload-Ordner, Datei bleibt unverändert
  dateityp        text NOT NULL CHECK (dateityp IN ('application/pdf', 'image/jpeg', 'image/png')),
  groesse_bytes   integer NOT NULL,
  pruefsumme      text NOT NULL,                -- belegt, dass die Datei nicht verändert wurde
  belegdatum      date,
  aufbewahren_bis date,                         -- bis dahin nicht löschbar
  hochgeladen_von integer REFERENCES benutzer (id),
  hochgeladen_am  timestamptz NOT NULL DEFAULT now()
);

-- Ein Beleg kann zu mehreren Geräten gehören (z. B. 20 PCs auf einer Rechnung)
CREATE TABLE geraet_belege (
  geraet_id integer NOT NULL REFERENCES geraete (id) ON DELETE CASCADE,
  beleg_id  integer NOT NULL REFERENCES belege (id) ON DELETE CASCADE,
  PRIMARY KEY (geraet_id, beleg_id)
);

-- Belege innerhalb der Aufbewahrungsfrist können nicht gelöscht werden (Pflichtenheft Kap. 5)
CREATE FUNCTION belege_loeschschutz() RETURNS trigger AS $$
BEGIN
  IF OLD.aufbewahren_bis IS NOT NULL AND OLD.aufbewahren_bis >= current_date THEN
    RAISE EXCEPTION 'Der Beleg ist bis % aufzubewahren und kann nicht gelöscht werden',
      to_char(OLD.aufbewahren_bis, 'DD.MM.YYYY');
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER belege_nicht_loeschen BEFORE DELETE ON belege
  FOR EACH ROW EXECUTE FUNCTION belege_loeschschutz();


-- SAP-Import (ab Sprint 3) ----------------------------------------------------

-- Gespeicherte Spaltenzuordnung, z. B. {"inventarnummer": "Anlage", "bezeichnung": "Text"}
CREATE TABLE import_zuordnungen (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  zuordnung    jsonb NOT NULL,
  geaendert_am timestamptz NOT NULL DEFAULT now()
);

-- Jeder Import: zuerst Vorschau, dann übernehmen oder abbrechen
CREATE TABLE importe (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dateiname      text NOT NULL,
  status         text NOT NULL DEFAULT 'vorschau' CHECK (status IN ('vorschau', 'uebernommen', 'abgebrochen')),
  zuordnung      jsonb NOT NULL,
  ergebnis       jsonb,                         -- Anzahl neu, geändert, fehlerhaft
  benutzer_id    integer REFERENCES benutzer (id),
  angelegt_am    timestamptz NOT NULL DEFAULT now(),
  uebernommen_am timestamptz
);


-- Inventur (ab Sprint 4) ------------------------------------------------------

CREATE TABLE inventuren (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             text NOT NULL,               -- z. B. „Inventur 2027“
  begonnen_von     integer REFERENCES benutzer (id),
  begonnen_am      timestamptz NOT NULL DEFAULT now(),
  abgeschlossen_am timestamptz
);

-- Ist-Stand: was bei der Inventur gefunden wurde (getrennt vom Soll-Stand in geraete)
CREATE TABLE inventur_erfassungen (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventur_id    integer NOT NULL REFERENCES inventuren (id) ON DELETE CASCADE,
  raum_id        integer REFERENCES raeume (id) ON DELETE SET NULL,      -- wo es gefunden wurde
  inventarnummer text NOT NULL,                 -- so wie eingegeben, auch wenn unbekannt
  geraet_id      integer REFERENCES geraete (id) ON DELETE SET NULL,     -- leer = nicht im System
  benutzer_id    integer REFERENCES benutzer (id),
  zeitpunkt      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventur_id, inventarnummer)
);


-- Änderungsprotokoll (Pflichtenheft Kap. 4) -----------------------------------

CREATE TABLE protokoll (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zeitpunkt   timestamptz NOT NULL DEFAULT now(),
  benutzer_id integer REFERENCES benutzer (id),
  bereich     text NOT NULL,                    -- 'geraet', 'raum' oder 'benutzer'
  eintrag_id  text NOT NULL,                    -- welches Gerät, welcher Raum, …
  aktion      text NOT NULL,                    -- z. B. 'angelegt', 'geaendert', 'geloescht'
  aenderungen jsonb                             -- {"feld": {"vorher": …, "nachher": …}}
);
CREATE INDEX protokoll_eintrag ON protokoll (bereich, eintrag_id, zeitpunkt DESC);

-- Protokolleinträge können weder geändert noch gelöscht werden
CREATE FUNCTION protokoll_schuetzen() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Das Änderungsprotokoll kann nicht verändert werden';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER protokoll_nicht_aendern BEFORE UPDATE OR DELETE ON protokoll
  FOR EACH ROW EXECUTE FUNCTION protokoll_schuetzen();
