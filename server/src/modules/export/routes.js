// Export – Pflichtenheft Kap. 4 „Export in CSV-Datei bzw. Excel-Datei“ und „Export im korrekten Format für SAP“
// Jira-Epic „Export (CSV/Excel und SAP)“, Sprint 4. Abnahme-Testfall T6.
//
// Geplante Endpunkte:
//   GET /api/export/devices?format=csv|xlsx&...      jede Geräteliste mit denselben Filtern wie GET /api/devices
//   GET /api/export/comparison/:inventoryId?format=  Liste der Abweichungen aus dem Soll-Ist-Vergleich
//   GET /api/export/sap                              geänderte und neu erfasste Geräte im Format, das SAP beim
//                                                    Import erwartet (mindestens Inventarnummer, Raumnummer,
//                                                    Inventurdatum). Geräte ohne Raumnummer vorher melden.
//                                                    Berechtigung export:sap
import { Router } from 'express';
import { notImplemented } from '../../lib/http-error.js';

const router = Router();
router.use(notImplemented('Der Export', 4));

export default router;
