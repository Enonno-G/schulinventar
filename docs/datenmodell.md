# Datenmodell

Grundlage ist das Pflichtenheft, Kapitel 4 (Speicherung in der DB). Die Tabellen stehen in
[`datenbank/001_tabellen.sql`](../datenbank/001_tabellen.sql), die Ergänzungen für SAP-Import und Ausleihe in
[`datenbank/002_import_und_ausleihe.sql`](../datenbank/002_import_und_ausleihe.sql).

## Soll-Stand und Ist-Stand

- **Soll-Stand** = was laut SAP vorhanden ist. Er steht in `geraete` in den Spalten `sap_raumnummer`, `sap_daten`
  und `sap_importiert_am` und wird nur vom SAP-Import geändert.
- **Aktueller Raum** = `geraete.raum_id`. Er ändert sich, wenn jemand ein Gerät umstellt oder eine Inventur
  übernommen wird. Jeder Wechsel steht mit Zeitpunkt in `raumwechsel`.
- **Ist-Stand** = was bei der Inventur gefunden wurde: `inventur_erfassungen`. Das kann auch eine Inventarnummer
  sein, die es im System nicht gibt (`geraet_id` ist dann leer).

Der Soll-Ist-Vergleich vergleicht `inventur_erfassungen` mit dem Soll-Stand. Der Export an SAP gibt alle Geräte aus,
deren aktueller Raum vom Raum laut SAP abweicht oder die nicht aus SAP stammen.

## Diagramm

GitHub und Visual Studio Code (mit einer Mermaid-Erweiterung) zeigen das Diagramm direkt an.

```mermaid
erDiagram
    raeume ||--o{ geraete : "steht in"
    lieferanten |o--o{ geraete : "liefert"
    geraete ||--o{ raumwechsel : "hat"
    geraete ||--o{ geraet_belege : ""
    belege ||--o{ geraet_belege : ""
    inventuren ||--o{ inventur_erfassungen : "umfasst"
    raeume |o--o{ inventur_erfassungen : "erfasst in"
    geraete |o--o{ inventur_erfassungen : "erkannt als"
    benutzer |o--o{ protokoll : "ändert"
    benutzer |o--o{ importe : "importiert"
    geraete ||--o{ ausleihen : "wird ausgeliehen"

    ausleihen {
        int id PK
        int geraet_id FK
        text ausgeliehen_an
        date bis
        timestamptz zurueck_am "leer = noch ausgeliehen"
    }

    benutzer {
        int id PK
        text name
        text email UK
        text rolle "admin, rechnungswesen, facility, lesen"
        text passwort_hash
        boolean aktiv
    }
    raeume {
        int id PK
        text nummer UK
        text bezeichnung
        text stockwerk
    }
    geraete {
        int id PK
        text inventarnummer UK "Strichcode"
        text bezeichnung
        text typ
        text seriennummer
        int raum_id FK "aktueller Raum"
        date anschaffungsdatum
        date kaufdatum
        date inbetriebnahme
        date garantie_bis
        int lieferant_id FK
        text anmerkungen
        text herkunft "sap oder manuell"
        text sap_raumnummer "Soll laut SAP"
        jsonb sap_daten
        date letzte_inventur
    }
    lieferanten {
        int id PK
        text name UK
    }
    raumwechsel {
        int id PK
        int geraet_id FK
        text von_raumnummer
        text nach_raumnummer
        text anlass "manuell, import, inventur"
        timestamptz zeitpunkt
    }
    belege {
        int id PK
        text art "rechnung, lieferschein, garantie"
        text dateiname
        text gespeichert_als UK
        text dateityp "PDF, JPG, PNG"
        text pruefsumme
        date aufbewahren_bis
    }
    geraet_belege {
        int geraet_id PK, FK
        int beleg_id PK, FK
    }
    inventuren {
        int id PK
        text name
        timestamptz begonnen_am
        timestamptz abgeschlossen_am
    }
    inventur_erfassungen {
        int id PK
        int inventur_id FK
        int raum_id FK
        text inventarnummer
        int geraet_id FK "leer = nicht im System"
        timestamptz zeitpunkt
    }
    importe {
        int id PK
        text dateiname
        text status "vorschau, uebernommen, abgebrochen"
        jsonb spalten "Überschriften der Datei"
        jsonb zeilen "gelesene Zeilen bis zur Übernahme"
        jsonb zuordnung "Spalte zu Feld"
        jsonb ergebnis
    }
    import_zuordnungen {
        int id PK
        text name UK
        jsonb zuordnung "SAP-Spalte zu Feld"
    }
    protokoll {
        bigint id PK
        timestamptz zeitpunkt
        int benutzer_id FK
        text bereich
        text eintrag_id
        text aktion
        jsonb aenderungen
    }
```

## Regeln, die die Datenbank selbst durchsetzt

| Regel                                                | Umsetzung                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Inventarnummer und Raumnummer sind eindeutig         | `UNIQUE`                                                            |
| Jedes Gerät hat genau einen Raum                     | `geraete.raum_id NOT NULL`                                          |
| Raum mit Geräten kann nicht gelöscht werden          | `ON DELETE RESTRICT` (zusätzlich Prüfung in `src/seiten/raeume.js`) |
| Ein Beleg gehört zu mehreren Geräten                 | Zwischentabelle `geraet_belege`                                     |
| Ein Gerät ist nie zweimal gleichzeitig ausgeliehen   | Index `ausleihen_nur_eine_offene`                                   |
| Eine Inventarnummer pro Inventur nur einmal erfasst  | `UNIQUE (inventur_id, inventarnummer)`                              |
| Belege in der Aufbewahrungsfrist sind nicht löschbar | Trigger `belege_nicht_loeschen`                                     |
| Änderungsprotokoll ist nicht veränderbar             | Trigger `protokoll_nicht_aendern`                                   |
| Nur PDF, JPG und PNG                                 | `CHECK` auf `belege.dateityp`                                       |

## Datenbank ändern

Nie eine bestehende Datei in `datenbank/` ändern, sondern eine neue anlegen, z. B. `002_geraet_farbe.sql` mit
`ALTER TABLE geraete ADD COLUMN farbe text;`. Sie wird beim nächsten Start automatisch ausgeführt. Welche Dateien
schon ausgeführt wurden, steht in der Tabelle `ausgefuehrte_sql_dateien`.
