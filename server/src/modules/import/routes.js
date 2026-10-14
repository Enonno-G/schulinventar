// SAP-Import – Pflichtenheft Kap. 4 „Import aus SAP“ und „Verarbeitung dieser Daten“
// Jira-Epic „Import aus SAP“, Sprint 3. Abnahme-Testfälle T1 (500 Geräte) und T2 (kein Duplikat).
//
// Geplante Endpunkte:
//   GET  /api/import/mapping       gespeicherte Spaltenzuordnung laden (Tabelle import_mappings)
//   PUT  /api/import/mapping       Spaltenzuordnung speichern
//   POST /api/import/preview       CSV/XLSX hochladen und prüfen: Pflichtfelder, gültige Daten, doppelte
//                                  Inventarnummern. Ergebnis in import_runs speichern und als Vorschau
//                                  zurückgeben (Anzahl neu, geändert, fehlerhaft + Fehler je Zeile)
//   POST /api/import/:id/commit    Vorschau übernehmen: Abgleich über die Inventarnummer, Soll-Stand in
//                                  devices.sap_* speichern, bereits ergänzte Daten bleiben erhalten,
//                                  Raumwechsel in room_changes (reason 'import'), Eintrag im Änderungsprotokoll
//   POST /api/import/:id/cancel    Vorschau verwerfen
import { Router } from 'express';
import { notImplemented } from '../../lib/http-error.js';
import { requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(requirePermission('import:run'));
router.use(notImplemented('Der SAP-Import', 3));

export default router;
