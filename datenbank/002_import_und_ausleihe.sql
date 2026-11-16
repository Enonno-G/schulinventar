-- Ergänzungen für den SAP-Import (Sprint 3) und die Ausleihe von Geräten (KANN-Anforderung).
-- Wird beim nächsten Start automatisch ausgeführt (siehe src/datenbank.js).


-- SAP-Import ------------------------------------------------------------------

-- Die gelesene Datei wird bis zur Übernahme hier aufgehoben, damit man zwischen Hochladen,
-- Spaltenzuordnung, Vorschau und Übernahme nicht jedes Mal neu hochladen muss.
ALTER TABLE importe ADD COLUMN spalten jsonb;   -- Spaltenüberschriften der Datei, z. B. ["Anlage", "Text", "Raum"]
ALTER TABLE importe ADD COLUMN zeilen jsonb;    -- alle Zeilen: [{"nr": 2, "werte": ["20000001", "PC", "E.01"]}, …]


-- Ausleihe von Geräten (Pflichtenheft Kap. 4, KANN-Anforderung) -------------------
-- Gespeichert wird nur, wer ein Gerät bis wann hat (Pflichtenheft Kap. 5 Datenschutz).

CREATE TABLE ausleihen (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geraet_id      integer NOT NULL REFERENCES geraete (id) ON DELETE CASCADE,
  ausgeliehen_an text NOT NULL,                  -- Name der Lehrperson
  bis            date NOT NULL,
  ausgeliehen_am timestamptz NOT NULL DEFAULT now(),
  zurueck_am     timestamptz,                    -- leer = noch ausgeliehen
  benutzer_id    integer REFERENCES benutzer (id) -- wer die Ausleihe eingetragen hat
);
CREATE INDEX ausleihen_geraet ON ausleihen (geraet_id, ausgeliehen_am DESC);
-- Ein Gerät kann nicht zweimal gleichzeitig ausgeliehen sein
CREATE UNIQUE INDEX ausleihen_nur_eine_offene ON ausleihen (geraet_id) WHERE zurueck_am IS NULL;


-- Inventur ---------------------------------------------------------------------

-- Schneller nachsehen, was in einem Raum schon erfasst wurde
CREATE INDEX inventur_erfassungen_raum ON inventur_erfassungen (inventur_id, raum_id);
