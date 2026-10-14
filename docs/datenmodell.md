# Datenmodell

Grundlage ist das Pflichtenheft, Kapitel 4 (Speicherung in der DB). Das Schema steht in
[`server/src/db/migrations/001_grundschema.sql`](../server/src/db/migrations/001_grundschema.sql).

## Soll-Stand und Ist-Stand

- **Soll-Stand** = was laut SAP vorhanden ist. Er steht in `devices` in den Spalten `sap_room_number`,
  `sap_data` und `sap_imported_at` und wird nur vom SAP-Import geändert.
- **Aktueller Raum** = `devices.room_id`. Er ändert sich, wenn jemand ein Gerät umstellt oder eine
  Inventur übernommen wird. Jeder Wechsel landet mit Datum in `room_changes`.
- **Ist-Stand** = was bei der Inventur tatsächlich gefunden wurde: `inventory_scans`. Eine Erfassung
  kann auch eine Inventarnummer sein, die es im System nicht gibt (`device_id` ist dann leer).

Der Soll-Ist-Vergleich vergleicht `inventory_scans` mit dem Soll-Stand. Der SAP-Export gibt alle Geräte
aus, deren aktueller Raum vom Raum laut SAP abweicht oder die nicht aus SAP stammen.

## ER-Diagramm

GitHub und Visual Studio Code (mit Mermaid-Erweiterung) zeigen das Diagramm direkt an.

```mermaid
erDiagram
    rooms ||--o{ devices : "steht in"
    suppliers |o--o{ devices : "liefert"
    devices ||--o{ room_changes : "Raumwechsel"
    devices ||--o{ device_documents : ""
    documents ||--o{ device_documents : ""
    inventories ||--o{ inventory_scans : "umfasst"
    rooms |o--o{ inventory_scans : "erfasst in"
    devices |o--o{ inventory_scans : "erkannt als"
    users |o--o{ audit_log : "ändert"
    users |o--o{ import_runs : "importiert"

    users {
        int id PK
        text name
        text email UK
        user_role role "admin, accounting, facility, readonly"
        text password_hash
        boolean active
    }
    rooms {
        int id PK
        text number UK "Raumnummer"
        text name
        text floor
    }
    devices {
        int id PK
        text inventory_number UK "Strichcode"
        text description
        text device_type
        text serial_number
        int room_id FK "aktueller Raum"
        date acquisition_date
        date purchase_date
        date commissioning_date
        date warranty_until
        int supplier_id FK
        text notes
        text source "sap oder manual"
        text sap_room_number "Soll laut SAP"
        jsonb sap_data
        date last_inventory_date
    }
    suppliers {
        int id PK
        text name UK
    }
    room_changes {
        int id PK
        int device_id FK
        text from_room_number
        text to_room_number
        text reason "manual, import, inventory"
        timestamptz changed_at
    }
    documents {
        int id PK
        text kind "Rechnung, Lieferschein, Garantie"
        text original_name
        text stored_name UK
        text mime_type "PDF, JPG, PNG"
        text sha256
        date retain_until "Aufbewahrungsfrist"
    }
    device_documents {
        int device_id PK, FK
        int document_id PK, FK
    }
    inventories {
        int id PK
        text name
        timestamptz started_at
        timestamptz finished_at
    }
    inventory_scans {
        int id PK
        int inventory_id FK
        int room_id FK
        text inventory_number
        int device_id FK "leer = nicht im System"
        timestamptz scanned_at
    }
    import_runs {
        int id PK
        text file_name
        text status "preview, committed, cancelled"
        jsonb summary
    }
    import_mappings {
        int id PK
        text name UK
        jsonb mapping "SAP-Spalte zu Feld"
    }
    audit_log {
        bigint id PK
        timestamptz at
        int user_id FK
        text entity
        text entity_id
        text action
        jsonb changes
    }
```

## Regeln in der Datenbank

| Regel                                                | Umsetzung                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Inventarnummer und Raumnummer sind eindeutig         | `UNIQUE`                                                            |
| Jedes Gerät hat genau einen Raum                     | `devices.room_id NOT NULL`                                          |
| Raum mit Geräten kann nicht gelöscht werden          | Fremdschlüssel `ON DELETE RESTRICT` (zusätzlich Prüfung in der API) |
| Ein Beleg gehört zu mehreren Geräten                 | Zwischentabelle `device_documents`                                  |
| Belege in der Aufbewahrungsfrist sind nicht löschbar | Trigger `documents_protect_delete`                                  |
| Änderungsprotokoll ist nicht veränderbar             | Trigger `audit_log_no_change`                                       |
| Nur PDF, JPG und PNG                                 | `CHECK` auf `documents.mime_type` (zusätzlich Prüfung beim Upload)  |

## Schema ändern

Nie eine bestehende Migration ändern, sondern eine neue Datei anlegen, z. B.
`002_lieferanten_kontakt.sql`. Sie wird beim nächsten Start automatisch ausgeführt.
