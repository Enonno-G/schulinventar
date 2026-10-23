// Seiten, die laut Jira-Plan erst später gebaut werden. Sie zeigen vorerst nur, was dort kommen wird.
//
// Was jeweils gebaut werden soll:
//
// SAP-Import (Sprint 3) – Pflichtenheft Kap. 4 „Import aus SAP“, Abnahme-Testfälle T1 und T2
//   Excel/CSV hochladen, Spalten zuordnen (Tabelle import_zuordnungen), jede Zeile prüfen (Pflichtfelder,
//   gültige Daten, doppelte Inventarnummern), Vorschau mit Anzahl neu/geändert/fehlerhaft (Tabelle importe),
//   nach Bestätigung übernehmen: Abgleich über die Inventarnummer, Soll-Stand in geraete.sap_*,
//   bereits ergänzte Daten bleiben erhalten, Raumwechsel mit Anlass 'import'.
//
// Belege (Sprint 4) – Pflichtenheft Kap. 4 „Formular für zusätzliche Eingaben“, Testfälle T3 und T8
//   PDF/JPG/PNG hochladen (Dateityp am Inhalt prüfen), unverändert speichern, Prüfsumme in belege.pruefsumme,
//   einem oder mehreren Geräten zuordnen (Tabelle geraet_belege), in der Detailansicht anzeigen.
//
// Inventur (Sprint 4) – Pflichtenheft Kap. 4 „Inventur mit Strichcode“ und „Soll-Ist-Vergleich“, Testfall T5
//   Inventur starten (inventuren), Raum wählen, Inventarnummern eingeben oder mit Handscanner einlesen
//   (inventur_erfassungen), danach Liste: fehlt / anderer Raum / nicht in SAP. Abweichungen übernehmen.
//
// Export (Sprint 4) – Pflichtenheft Kap. 4 „Export in CSV/Excel“ und „Export für SAP“, Testfall T6
//   Jede Liste als CSV/Excel herunterladen. Für SAP: geänderte Geräte mit Inventarnummer, Raumnummer und
//   Inventurdatum im Format, das SAP erwartet.
import { Router } from 'express';
import { nurMitRecht } from '../anmeldung.js';

const router = Router();

router.get('/import', nurMitRecht('sap_import_export'), (req, res) => {
  res.render('geplant', {
    titel: 'SAP-Import',
    sprint: 3,
    text: 'Excel- oder CSV-Liste aus SAP hochladen, Spalten zuordnen, Vorschau prüfen und übernehmen. Ein zweiter Import derselben Liste erzeugt keine doppelten Einträge.',
    pflichtenheft: 'Kap. 4 Import aus SAP',
  });
});

router.get('/inventur', nurMitRecht('inventur'), (req, res) => {
  res.render('geplant', {
    titel: 'Inventur',
    sprint: 4,
    text: 'Raum auswählen, dann für jedes Gerät die Inventarnummer eingeben oder mit einem Handscanner einlesen. Das Feld ist danach sofort wieder leer für das nächste Gerät.',
    pflichtenheft: 'Kap. 4 Inventur mit Strichcode (Ist-Erfassung)',
  });
});

router.get('/soll-ist', (req, res) => {
  res.render('geplant', {
    titel: 'Soll-Ist-Vergleich',
    sprint: 4,
    text: 'Zeigt nach der Inventur, welche Geräte fehlen, welche in einem anderen Raum gefunden wurden und welche nicht in SAP stehen.',
    pflichtenheft: 'Kap. 4 Soll-Ist-Vergleich',
  });
});

router.get('/export', (req, res) => {
  res.render('geplant', {
    titel: 'Export',
    sprint: 4,
    text: 'Listen als CSV- oder Excel-Datei herunterladen und Änderungen im Format für den SAP-Import ausgeben.',
    pflichtenheft: 'Kap. 4 Export in CSV-/Excel-Datei, Export im korrekten Format für SAP',
  });
});

export default router;
