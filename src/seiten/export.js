// Export – Pflichtenheft Kap. 4 „Export in CSV-Datei bzw. Excel-Datei“ und „Export im korrekten Format für SAP“,
// Abnahme-Testfall T6
//
//   GET  /export            Übersicht: Listen zum Herunterladen und die Änderungen für SAP
//   GET  /export/sap.csv    Datei für den Import in SAP
//
// Die CSV-Dateien der Listen entstehen dort, wo auch die Listen sind: /geraete.csv in geraete.js und
// /raeume.csv in raeume.js.
import { Router } from 'express';
import { nurMitRecht } from '../anmeldung.js';
import { csvSenden } from '../csv.js';
import { db } from '../datenbank.js';

const router = Router();

// Format der Datei für den Import in SAP. HIER ANPASSEN, sobald die echte, anonymisierte SAP-Liste vom
// Auftraggeber da ist (Pflichtenheft Kap. 4): Spaltenüberschriften, Reihenfolge, Trennzeichen und Datumsformat.
const SAP_FORMAT = {
  trennzeichen: ';',
  datumsformat: 'TT.MM.JJJJ', // möglich: 'TT.MM.JJJJ', 'JJJJ-MM-TT' oder 'JJJJMMTT'
  spalten: [
    { titel: 'Inventarnummer', feld: 'inventarnummer' },
    { titel: 'Raum', feld: 'raumnummer' },
    { titel: 'Inventurdatum', feld: 'letzte_inventur', datum: true },
  ],
};

// '2026-10-23' im eingestellten Datumsformat
function sapDatum(wert) {
  const [jahr, monat, tag] = String(wert).slice(0, 10).split('-');
  if (SAP_FORMAT.datumsformat === 'JJJJ-MM-TT') return `${jahr}-${monat}-${tag}`;
  if (SAP_FORMAT.datumsformat === 'JJJJMMTT') return `${jahr}${monat}${tag}`;
  return `${tag}.${monat}.${jahr}`;
}

// Welche Geräte an SAP gehen („geänderte oder neu erfasste Daten“):
//  - der Raum bei uns ist ein anderer als in SAP (z. B. nach der Inventur), oder das Gerät ist nicht in SAP
//    (dann ist sap_raumnummer leer – IS DISTINCT FROM vergleicht auch mit leeren Werten richtig)
//  - oder es wurde seit dem letzten SAP-Import inventiert (neues Inventurdatum)
async function aenderungenFuerSap() {
  return db.alle(
    `SELECT g.id, g.inventarnummer, g.bezeichnung, r.nummer AS raumnummer, g.sap_raumnummer, g.letzte_inventur
     FROM geraete g JOIN raeume r ON r.id = g.raum_id
     WHERE g.sap_raumnummer IS DISTINCT FROM r.nummer
        OR (g.letzte_inventur IS NOT NULL
            AND (g.sap_importiert_am IS NULL OR g.letzte_inventur >= g.sap_importiert_am::date))
     ORDER BY g.inventarnummer`,
  );
}

router.get('/export', async (req, res) => {
  const zaehlung = await db.eine(
    'SELECT (SELECT count(*) FROM geraete) AS geraete, (SELECT count(*) FROM raeume) AS raeume',
  );
  // Die Änderungen für SAP sieht nur, wer den SAP-Export machen darf
  const sapAenderungen = res.locals.darf('sap_import_export') ? await aenderungenFuerSap() : [];
  res.render('export', { zaehlung, sapAenderungen });
});

router.get('/export/sap.csv', nurMitRecht('sap_import_export'), async (req, res) => {
  const heute = new Date().toISOString().slice(0, 10);
  csvSenden(res, `sap-import-${heute}.csv`, SAP_FORMAT.spalten, await aenderungenFuerSap(), {
    trennzeichen: SAP_FORMAT.trennzeichen,
    datumFormatieren: sapDatum,
    formelSchutz: false, // die Werte müssen genau so in SAP ankommen
  });
});

export default router;
