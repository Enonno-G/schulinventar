// Soll-Ist-Vergleich – Pflichtenheft Kap. 4 „Soll-Ist-Vergleich“, Abnahme-Testfall T5
//
// Vergleicht, was bei einer Inventur erfasst wurde (Ist), mit dem Soll-Stand aus SAP und zeigt drei Listen:
//   - Fehlt:        laut Soll in einem Raum, der inventiert wurde, aber nirgends gefunden
//   - Anderer Raum: gefunden, aber in einem anderen Raum als laut SAP
//   - Nicht in SAP: Inventarnummer ist nicht im System, oder das Gerät wurde nur bei uns angelegt
// Ein Raum gilt als inventiert, sobald dort mindestens ein Gerät erfasst wurde. Räume ohne jede Erfassung werden
// extra aufgelistet, damit ein noch nicht besuchter Raum nicht lauter „fehlende“ Geräte liefert.
//
//   GET  /soll-ist?inventur=3       Abweichungen einer Inventur (ohne Angabe: die neueste)
//   GET  /soll-ist.csv?inventur=3   dieselbe Liste als CSV-Datei, z. B. für die Korrektur in SAP
import { Router } from 'express';
import { csvSenden } from '../csv.js';
import { db } from '../datenbank.js';
import { nummer } from '../pruefen.js';

const router = Router();

// Die gewählte Inventur oder, wenn keine angegeben ist, die neueste
async function inventurWaehlen(inventurId) {
  if (inventurId) return db.eine('SELECT * FROM inventuren WHERE id = $1', [inventurId]);
  return db.eine('SELECT * FROM inventuren ORDER BY begonnen_am DESC LIMIT 1');
}

// Räume, in denen bei dieser Inventur mindestens ein Gerät erfasst wurde (als SQL zum Einsetzen)
const INVENTIERTE_RAEUME = `
  SELECT er.nummer FROM inventur_erfassungen e JOIN raeume er ON er.id = e.raum_id WHERE e.inventur_id = $1`;

async function abweichungenBerechnen(inventurId) {
  // Alles, was erfasst wurde, mit dem Raum laut Soll (coalesce: Raum laut SAP, sonst aktueller Raum)
  const erfasst = await db.alle(
    `SELECT e.inventarnummer, e.zeitpunkt, er.nummer AS ist_raum,
            g.id AS geraet_id, g.bezeichnung, g.herkunft, coalesce(g.sap_raumnummer, gr.nummer) AS soll_raum
     FROM inventur_erfassungen e
     LEFT JOIN raeume er ON er.id = e.raum_id
     LEFT JOIN geraete g ON g.id = e.geraet_id
     LEFT JOIN raeume gr ON gr.id = g.raum_id
     WHERE e.inventur_id = $1
     ORDER BY er.nummer, e.inventarnummer`,
    [inventurId],
  );
  const andererRaum = erfasst.filter((zeile) => zeile.geraet_id && zeile.ist_raum !== zeile.soll_raum);
  const nichtInSap = erfasst.filter((zeile) => !zeile.geraet_id || zeile.herkunft !== 'sap');

  const fehlt = await db.alle(
    `SELECT g.id, g.inventarnummer, g.bezeichnung, coalesce(g.sap_raumnummer, gr.nummer) AS soll_raum
     FROM geraete g JOIN raeume gr ON gr.id = g.raum_id
     WHERE NOT EXISTS (SELECT 1 FROM inventur_erfassungen e WHERE e.inventur_id = $1 AND e.geraet_id = g.id)
       AND coalesce(g.sap_raumnummer, gr.nummer) IN (${INVENTIERTE_RAEUME})
     ORDER BY soll_raum, g.inventarnummer`,
    [inventurId],
  );

  const ohneErfassung = await db.alle(
    `SELECT DISTINCT coalesce(g.sap_raumnummer, gr.nummer) AS raumnummer
     FROM geraete g JOIN raeume gr ON gr.id = g.raum_id
     WHERE coalesce(g.sap_raumnummer, gr.nummer) NOT IN (${INVENTIERTE_RAEUME})
     ORDER BY raumnummer`,
    [inventurId],
  );

  return { fehlt, andererRaum, nichtInSap, raeumeOhneErfassung: ohneErfassung.map((zeile) => zeile.raumnummer) };
}

router.get('/soll-ist', async (req, res) => {
  const inventur = await inventurWaehlen(nummer(req.query.inventur));
  const inventuren = await db.alle('SELECT id, name, begonnen_am FROM inventuren ORDER BY begonnen_am DESC');
  if (!inventur) return res.render('soll-ist', { inventur: null, inventuren });
  res.render('soll-ist', { inventur, inventuren, ...(await abweichungenBerechnen(inventur.id)) });
});

router.get('/soll-ist.csv', async (req, res) => {
  const inventur = await inventurWaehlen(nummer(req.query.inventur));
  if (!inventur) return res.redirect('/soll-ist');
  const { fehlt, andererRaum, nichtInSap } = await abweichungenBerechnen(inventur.id);

  // Alle drei Listen in einer Datei, die erste Spalte sagt, um welche Abweichung es geht
  const zeilen = [
    ...fehlt.map((zeile) => ({ ...zeile, abweichung: 'Fehlt' })),
    ...andererRaum.map((zeile) => ({ ...zeile, abweichung: 'Anderer Raum' })),
    ...nichtInSap.map((zeile) => ({
      ...zeile,
      abweichung: zeile.geraet_id ? 'Nicht in SAP' : 'Nicht im System',
    })),
  ];
  const spalten = [
    { titel: 'Abweichung', feld: 'abweichung' },
    { titel: 'Inventarnummer', feld: 'inventarnummer' },
    { titel: 'Bezeichnung', feld: 'bezeichnung' },
    { titel: 'Raum laut SAP', feld: 'soll_raum' },
    { titel: 'Gefunden in Raum', feld: 'ist_raum' },
    { titel: 'Erfasst am', feld: 'zeitpunkt', datum: true },
  ];
  csvSenden(res, `soll-ist-${inventur.id}.csv`, spalten, zeilen);
});

export default router;
