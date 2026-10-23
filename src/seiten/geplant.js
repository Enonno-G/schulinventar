// Seiten, die laut Zeitplan im Pflichtenheft (Kap. 6.1) erst später gebaut werden.
// Sie zeigen vorerst nur, was dort kommen wird.
//
// Was jeweils gebaut werden soll:
//
// SAP-Import (Sprint 3) – Pflichtenheft Kap. 4 „Import aus SAP“, Abnahme-Testfälle T1 und T2
//   Excel/CSV hochladen, Spalten zuordnen (Tabelle import_zuordnungen), jede Zeile prüfen (Pflichtfelder,
//   gültige Daten, doppelte Inventarnummern), Vorschau mit Anzahl neu/geändert/fehlerhaft (Tabelle importe),
//   nach Bestätigung übernehmen: Abgleich über die Inventarnummer, Soll-Stand in geraete.sap_*,
//   bereits ergänzte Daten bleiben erhalten, Raumwechsel mit Anlass 'import'.
//
// Inventur (Sprint 4) – Pflichtenheft Kap. 4 „Inventur mit Strichcode“ und „Soll-Ist-Vergleich“, Testfall T5
//   Inventur starten (inventuren), Raum wählen, Inventarnummern eingeben oder mit Handscanner einlesen
//   (inventur_erfassungen), danach Liste: fehlt / anderer Raum / nicht in SAP. Abweichungen übernehmen.
//
// Export für SAP (Sprint 4) – Pflichtenheft Kap. 4 „Export im korrekten Format für SAP“, Testfall T6
//   Geänderte Geräte mit Inventarnummer, Raumnummer und Inventurdatum im Format, das SAP erwartet.
//   Kommt als zusätzlicher Abschnitt auf die Seite /export (src/seiten/export.js).
//
// Schon fertig (Sprint 2): Belege in src/seiten/belege.js, CSV-Export in src/seiten/geraete.js und raeume.js.
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

export default router;
