// Inventur und Soll-Ist-Vergleich – Pflichtenheft Kap. 4 „Inventur mit Strichcode (Ist-Erfassung)“
// und „Soll-Ist-Vergleich“. Jira-Epic „Inventur & Soll-Ist-Vergleich“, Sprint 4. Abnahme-Testfall T5.
//
// Geplante Endpunkte:
//   GET  /api/inventories                  Inventurdurchgänge
//   POST /api/inventories                  Inventur starten (inventory:run)
//   POST /api/inventories/:id/scans        { room_id, inventory_number } erfassen (Tabelle inventory_scans).
//                                          Rückmeldung: erfasst, schon erfasst, nicht im System, laut Soll in
//                                          anderem Raum. Muss in unter fünf Sekunden antworten.
//   GET  /api/inventories/:id/comparison   Soll-Ist-Vergleich: fehlt, anderer Raum, nicht in SAP
//   POST /api/inventories/:id/apply        Abweichungen übernehmen (Raumwechsel mit reason 'inventory',
//                                          devices.last_inventory_date setzen)
import { Router } from 'express';
import { notImplemented } from '../../lib/http-error.js';

const router = Router();
router.use(notImplemented('Die Inventur', 4));

export default router;
