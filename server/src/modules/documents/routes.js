// Belege – Pflichtenheft Kap. 4 „Formular für zusätzliche Eingaben“, Kap. 5 „Sicherheit“ und „Aufbewahrung“
// Jira-Epic „Zusatzdaten & Belege“, Sprint 4. Abnahme-Testfälle T3 (ein Beleg für mehrere Geräte) und
// T8 (unzulässige Datei wird abgelehnt).
//
// Geplante Endpunkte:
//   POST   /api/documents            Datei hochladen (PDF, JPG, PNG bis MAX_UPLOAD_MB) und mit einem oder
//                                    mehreren Geräten verknüpfen. Dateityp am Inhalt prüfen, nicht nur an der
//                                    Endung. Datei unverändert speichern, SHA-256 in documents.sha256
//   GET    /api/documents/:id/file   Beleg anzeigen bzw. herunterladen (alle angemeldeten Benutzer)
//   PUT    /api/documents/:id/devices  Zuordnung zu Geräten ändern
//   DELETE /api/documents/:id        nur nach Ablauf der Aufbewahrungsfrist (Trigger in der Datenbank)
import { Router } from 'express';
import { notImplemented } from '../../lib/http-error.js';

const router = Router();
router.use(notImplemented('Der Upload von Belegen', 4));

export default router;
