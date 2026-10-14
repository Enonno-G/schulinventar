-- Grundschema der Schulinventar- und Belegverwaltung
-- Pflichtenheft Kap. 4 (Speicherung in der DB): Soll-Stand (SAP) und Ist-Stand (Inventur) getrennt,
-- jede Änderung mit Datum und Benutzer, hochgeladene Dateien unverändert.
-- Übersicht als ER-Diagramm: docs/datenmodell.md

-- Setzt updated_at bei jeder Änderung automatisch
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Benutzer und Anmeldung (Pflichtenheft Kap. 3 Zielgruppen, Kap. 4 Benutzerverwaltung)
-- ---------------------------------------------------------------------------

-- admin = Administrator, accounting = Sekretariat und Rechnungswesen,
-- facility = Facility-Management, readonly = Lesezugriff
CREATE TYPE user_role AS ENUM ('admin', 'accounting', 'facility', 'readonly');

CREATE TABLE users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL,
  role          user_role NOT NULL DEFAULT 'readonly',
  password_hash text NOT NULL,               -- nie das Passwort selbst (Kap. 5 Sicherheit)
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sitzungen der angemeldeten Benutzer (Tabellenaufbau von connect-pg-simple)
CREATE TABLE session (
  sid    varchar NOT NULL PRIMARY KEY,
  sess   json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX session_expire_idx ON session (expire);

-- ---------------------------------------------------------------------------
-- Räume und Geräte (Kap. 4 Raumverwaltung, Formular für zusätzliche Eingaben)
-- ---------------------------------------------------------------------------

CREATE TABLE rooms (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number     text NOT NULL UNIQUE,            -- Raumnummer, in SAP verpflichtend
  name       text,                            -- Bezeichnung
  floor      text,                            -- Stockwerk
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE suppliers (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX suppliers_name_unique ON suppliers (lower(name));

CREATE TABLE devices (
  id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_number    text NOT NULL UNIQUE,   -- Inventarnummer = Inhalt des Strichcodes
  description         text NOT NULL,          -- Bezeichnung
  device_type         text,                   -- Gerätetyp, z. B. PC, Beamer, Drucker, Tisch
  serial_number       text,
  room_id             integer NOT NULL REFERENCES rooms (id) ON DELETE RESTRICT, -- aktueller Raum
  acquisition_date    date,                   -- Anschaffungsdatum (meist aus SAP)
  purchase_date       date,                   -- Kaufdatum
  commissioning_date  date,                   -- Datum der Inbetriebnahme
  warranty_until      date,                   -- Garantie bis
  supplier_id         integer REFERENCES suppliers (id),
  notes               text,                   -- Anmerkungen, z. B. Schäden oder Reparaturen
  source              text NOT NULL DEFAULT 'manual' CHECK (source IN ('sap', 'manual')),
  -- Soll-Stand laut letztem SAP-Import. Wird nur vom Import geändert.
  sap_room_number     text,
  sap_data            jsonb,                  -- alle Werte der Zeile aus der SAP-Liste
  sap_imported_at     timestamptz,
  last_inventory_date date,                   -- Inventurdatum der letzten Übernahme (für den SAP-Export)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devices_room_idx ON devices (room_id);
CREATE INDEX devices_type_idx ON devices (device_type);
CREATE INDEX devices_warranty_idx ON devices (warranty_until);
CREATE INDEX devices_serial_idx ON devices (serial_number);
CREATE TRIGGER devices_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Raumwechsel mit Datum. Die Raumnummern werden mitgespeichert, damit die Historie
-- auch nach dem Löschen eines Raumes lesbar bleibt.
CREATE TABLE room_changes (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id        integer NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  from_room_id     integer REFERENCES rooms (id) ON DELETE SET NULL,
  from_room_number text,
  to_room_id       integer REFERENCES rooms (id) ON DELETE SET NULL,
  to_room_number   text NOT NULL,
  reason           text NOT NULL DEFAULT 'manual' CHECK (reason IN ('manual', 'import', 'inventory')),
  changed_by       integer REFERENCES users (id),
  changed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_changes_device_idx ON room_changes (device_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- Belege (Kap. 4 Formular für zusätzliche Eingaben, Kap. 5 Aufbewahrung von Belegen)
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('invoice', 'delivery_note', 'warranty', 'other')),
  original_name text NOT NULL,                -- Dateiname beim Hochladen
  stored_name   text NOT NULL UNIQUE,         -- Dateiname im Upload-Ordner (Datei bleibt unverändert)
  mime_type     text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes    integer NOT NULL,
  sha256        text NOT NULL,                -- Prüfsumme, belegt die Unverändertheit
  document_date date,
  retain_until  date,                         -- bis dahin nicht löschbar (Aufbewahrungsfrist)
  uploaded_by   integer REFERENCES users (id),
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

-- Ein Beleg kann mehreren Geräten zugeordnet sein (z. B. 20 PCs auf einer Rechnung)
CREATE TABLE device_documents (
  device_id   integer NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  document_id integer NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  PRIMARY KEY (device_id, document_id)
);
CREATE INDEX device_documents_document_idx ON device_documents (document_id);

-- Belege innerhalb der Aufbewahrungsfrist können nicht gelöscht werden
CREATE FUNCTION protect_retained_documents() RETURNS trigger AS $$
BEGIN
  IF OLD.retain_until IS NOT NULL AND OLD.retain_until >= current_date THEN
    RAISE EXCEPTION 'Der Beleg ist bis % aufzubewahren und kann nicht gelöscht werden',
      to_char(OLD.retain_until, 'DD.MM.YYYY');
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER documents_protect_delete BEFORE DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION protect_retained_documents();

-- ---------------------------------------------------------------------------
-- SAP-Import (Kap. 4 Import aus SAP)
-- ---------------------------------------------------------------------------

-- Gespeicherte Spaltenzuordnung, z. B. {"inventory_number": "Anlage", "description": "Bezeichnung"}
CREATE TABLE import_mappings (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  mapping    jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Jeder Import: zuerst Vorschau, dann Übernahme oder Abbruch
CREATE TABLE import_runs (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name    text NOT NULL,
  status       text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview', 'committed', 'cancelled')),
  mapping      jsonb NOT NULL,
  summary      jsonb,                         -- Anzahl neu, geändert, fehlerhaft
  created_by   integer REFERENCES users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Inventur (Kap. 4 Inventur mit Strichcode, Soll-Ist-Vergleich)
-- ---------------------------------------------------------------------------

CREATE TABLE inventories (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,                  -- z. B. "Inventur 2027"
  started_by  integer REFERENCES users (id),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Ist-Stand: jede Erfassung bei der Inventur, getrennt vom Soll-Stand in devices
CREATE TABLE inventory_scans (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_id     integer NOT NULL REFERENCES inventories (id) ON DELETE CASCADE,
  room_id          integer REFERENCES rooms (id) ON DELETE SET NULL,     -- Raum, in dem erfasst wurde
  inventory_number text NOT NULL,             -- so wie eingegeben, auch wenn unbekannt
  device_id        integer REFERENCES devices (id) ON DELETE SET NULL,   -- NULL = nicht im System
  scanned_by       integer REFERENCES users (id),
  scanned_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventory_id, inventory_number)
);
CREATE INDEX inventory_scans_room_idx ON inventory_scans (inventory_id, room_id);

-- ---------------------------------------------------------------------------
-- Änderungsprotokoll (Kap. 4: jede Änderung mit Datum und Benutzer)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  user_id   integer REFERENCES users (id),
  entity    text NOT NULL,                    -- z. B. 'device', 'room', 'user'
  entity_id text NOT NULL,
  action    text NOT NULL,                    -- z. B. 'create', 'update', 'delete'
  changes   jsonb                             -- {"feld": {"old": ..., "new": ...}}
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id, at DESC);

-- Protokolleinträge können weder geändert noch gelöscht werden
CREATE FUNCTION audit_log_readonly() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Das Änderungsprotokoll kann nicht verändert werden';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_readonly();
