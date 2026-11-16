// SAP-Import – Pflichtenheft Kap. 4 „Import aus SAP (CSV- oder Excel-Liste)“, Abnahme-Testfälle T1 und T2
//
// Ablauf in drei Schritten:
//   1. Datei hochladen. Sie wird gelesen und in der Tabelle importe aufgehoben (Status „vorschau“).
//   2. Spalten zuordnen und Vorschau ansehen: wie viele Geräte neu, geändert, unverändert und fehlerhaft sind.
//   3. Übernehmen (oder abbrechen). Erst jetzt ändert sich etwas an den Geräten.
//
//   GET  /import                     Datei hochladen, Liste der letzten Importe
//   POST /import                     Datei lesen und Import anlegen
//   GET  /import/:id                 Spaltenzuordnung und Vorschau (bzw. Ergebnis)
//   POST /import/:id/zuordnung       Spaltenzuordnung ändern
//   POST /import/:id/uebernehmen     in die Datenbank übernehmen
//   POST /import/:id/abbrechen       verwerfen
//
// Abgleich über die Inventarnummer: Wird dieselbe Liste zweimal importiert, entsteht kein Gerät doppelt.
import { Router } from 'express';
import { nurMitRecht } from '../anmeldung.js';
import { dateiEmpfangen } from '../dateien.js';
import { db } from '../datenbank.js';
import { nichtGefunden } from '../fehler.js';
import { protokollieren } from '../protokoll.js';
import { nummer } from '../pruefen.js';
import { fehlendePflichtfelder, IMPORT_FELDER, listeLesen, zeilenPruefen, zuordnungVorschlagen } from '../sap-liste.js';

const router = Router();
router.use('/import', nurMitRecht('sap_import_export')); // gilt für alle Adressen unter /import

// Regeln für ein Gerät, das es schon gibt (SAP ist das führende System, Pflichtenheft Kap. 5):
//  - Bezeichnung und Anschaffungsdatum kommen aus SAP und werden übernommen.
//  - Gerätetyp, Seriennummer und Inbetriebnahme werden nur eingetragen, wenn sie bei uns noch leer sind.
//    So bleiben Daten erhalten, die bei uns schon ergänzt wurden.
//  - Der Raum laut SAP (Soll-Stand) wird immer übernommen. Den aktuellen Raum ändert der Import nur, wenn das
//    Gerät bei uns noch im bisherigen SAP-Raum steht. Wurde es bei uns umgestellt, gilt unsere Angabe.
// Ergebnis: nur die Felder, die sich ändern, z. B. { bezeichnung: { vorher: 'PC', nachher: 'PC Arbeitsplatz' } }
function aenderungenBestimmen(vorher, sap) {
  const aenderungen = {};
  function aendern(feld, neuerWert) {
    if (neuerWert !== null && neuerWert !== vorher[feld])
      aenderungen[feld] = { vorher: vorher[feld], nachher: neuerWert };
  }
  aendern('bezeichnung', sap.bezeichnung);
  aendern('anschaffungsdatum', sap.anschaffungsdatum);
  for (const feld of ['typ', 'seriennummer', 'inbetriebnahme']) {
    if (!vorher[feld]) aendern(feld, sap[feld]);
  }
  aendern('sap_raumnummer', sap.raumnummer);
  if (vorher.sap_raumnummer && vorher.raumnummer === vorher.sap_raumnummer) aendern('raumnummer', sap.raumnummer);
  if (vorher.herkunft !== 'sap') aendern('herkunft', 'sap');
  return aenderungen;
}

// Vergleicht die gültigen Zeilen mit der Datenbank.
// `d` ist db oder – beim Übernehmen – die Transaktion t, damit dabei alles auf demselben Stand ist.
// Ergebnis: { neu: [...], geaendert: [...], unveraendert: Anzahl, neueRaeume: ['E.11', …] }
async function abgleichen(d, gueltig) {
  const vorhandene = await d.alle(
    `SELECT g.id, g.inventarnummer, g.bezeichnung, g.typ, g.seriennummer, g.anschaffungsdatum, g.inbetriebnahme,
            g.herkunft, g.sap_raumnummer, g.raum_id, r.nummer AS raumnummer
     FROM geraete g JOIN raeume r ON r.id = g.raum_id
     WHERE g.inventarnummer = ANY($1)`,
    [gueltig.map((zeile) => zeile.geraet.inventarnummer)],
  );
  const vorhandenJeNummer = new Map(vorhandene.map((geraet) => [geraet.inventarnummer, geraet]));
  const raeume = await d.alle('SELECT nummer FROM raeume');
  const raumnummern = raeume.map((raum) => raum.nummer);

  const ergebnis = { neu: [], geaendert: [], unveraendert: 0, neueRaeume: [] };
  for (const zeile of gueltig) {
    const sap = zeile.geraet;
    // Räume, die es noch nicht gibt, legt der Import an (in SAP ist die Raumnummer Pflicht)
    if (!raumnummern.includes(sap.raumnummer) && !ergebnis.neueRaeume.includes(sap.raumnummer)) {
      ergebnis.neueRaeume.push(sap.raumnummer);
    }
    const vorher = vorhandenJeNummer.get(sap.inventarnummer);
    if (!vorher) {
      ergebnis.neu.push(zeile);
      continue;
    }
    const aenderungen = aenderungenBestimmen(vorher, sap);
    if (Object.keys(aenderungen).length === 0) ergebnis.unveraendert++;
    else ergebnis.geaendert.push({ ...zeile, vorher, aenderungen });
  }
  ergebnis.neueRaeume.sort();
  return ergebnis;
}

// Speichert alles in einer Transaktion: entweder der ganze Import oder gar nichts.
async function uebernehmen(t, importDaten, benutzerId) {
  const { gueltig, fehlerhaft } = zeilenPruefen(importDaten.spalten, importDaten.zeilen, importDaten.zuordnung);
  const abgleich = await abgleichen(t, gueltig);

  // 1. Fehlende Räume anlegen
  for (const raumnummer of abgleich.neueRaeume) {
    const raum = await t.eine('INSERT INTO raeume (nummer) VALUES ($1) RETURNING *', [raumnummer]);
    await protokollieren(t, { benutzerId, bereich: 'raum', eintragId: raum.id, aktion: 'import', nachher: raum });
  }
  const raeume = await t.alle('SELECT id, nummer FROM raeume');
  const raumIdJeNummer = new Map(raeume.map((raum) => [raum.nummer, raum.id]));

  // 2. Neue Geräte anlegen
  for (const { geraet } of abgleich.neu) {
    const neu = await t.eine(
      `INSERT INTO geraete (inventarnummer, bezeichnung, typ, seriennummer, raum_id, anschaffungsdatum,
                            inbetriebnahme, herkunft, sap_raumnummer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sap', $8)
       RETURNING id`,
      [
        geraet.inventarnummer,
        geraet.bezeichnung,
        geraet.typ,
        geraet.seriennummer,
        raumIdJeNummer.get(geraet.raumnummer),
        geraet.anschaffungsdatum,
        geraet.inbetriebnahme,
        geraet.raumnummer,
      ],
    );
    await protokollieren(t, { benutzerId, bereich: 'geraet', eintragId: neu.id, aktion: 'import', nachher: geraet });
  }

  // 3. Geänderte Geräte aktualisieren
  for (const { vorher, aenderungen } of abgleich.geaendert) {
    const nachher = { ...vorher };
    for (const [feld, aenderung] of Object.entries(aenderungen)) nachher[feld] = aenderung.nachher;

    await t.ausfuehren(
      `UPDATE geraete SET bezeichnung = $1, typ = $2, seriennummer = $3, anschaffungsdatum = $4, inbetriebnahme = $5,
              raum_id = $6, herkunft = $7, sap_raumnummer = $8
       WHERE id = $9`,
      [
        nachher.bezeichnung,
        nachher.typ,
        nachher.seriennummer,
        nachher.anschaffungsdatum,
        nachher.inbetriebnahme,
        raumIdJeNummer.get(nachher.raumnummer),
        nachher.herkunft,
        nachher.sap_raumnummer,
        vorher.id,
      ],
    );
    if (aenderungen.raumnummer) {
      await t.ausfuehren(
        `INSERT INTO raumwechsel (geraet_id, von_raum_id, von_raumnummer, nach_raum_id, nach_raumnummer, anlass, benutzer_id)
         VALUES ($1, $2, $3, $4, $5, 'import', $6)`,
        [
          vorher.id,
          vorher.raum_id,
          vorher.raumnummer,
          raumIdJeNummer.get(nachher.raumnummer),
          nachher.raumnummer,
          benutzerId,
        ],
      );
    }
    // Ins Protokoll nur die geänderten Felder
    const alt = {};
    const neu = {};
    for (const [feld, aenderung] of Object.entries(aenderungen)) {
      alt[feld] = aenderung.vorher;
      neu[feld] = aenderung.nachher;
    }
    await protokollieren(t, {
      benutzerId,
      bereich: 'geraet',
      eintragId: vorher.id,
      aktion: 'import',
      vorher: alt,
      nachher: neu,
    });
  }

  // 4. Bei allen Geräten der Liste die SAP-Zeile und den Zeitpunkt des Imports speichern
  for (const { geraet, sapDaten } of gueltig) {
    await t.ausfuehren('UPDATE geraete SET sap_daten = $1, sap_importiert_am = now() WHERE inventarnummer = $2', [
      sapDaten,
      geraet.inventarnummer,
    ]);
  }

  // 5. Die Spaltenzuordnung für den nächsten Import merken
  await t.ausfuehren(
    `INSERT INTO import_zuordnungen (name, zuordnung) VALUES ('Standard', $1)
     ON CONFLICT (name) DO UPDATE SET zuordnung = EXCLUDED.zuordnung, geaendert_am = now()`,
    [importDaten.zuordnung],
  );

  return {
    neu: abgleich.neu.length,
    geaendert: abgleich.geaendert.length,
    unveraendert: abgleich.unveraendert,
    fehlerhaft: fehlerhaft.length,
    neue_raeume: abgleich.neueRaeume,
  };
}

function importLaden(importId) {
  return db.eine(
    `SELECT i.*, b.name AS benutzer FROM importe i LEFT JOIN benutzer b ON b.id = i.benutzer_id WHERE i.id = $1`,
    [importId],
  );
}

async function startseiteZeigen(res, fehler = null) {
  const importe = await db.alle(
    `SELECT i.id, i.dateiname, i.status, i.ergebnis, i.angelegt_am, b.name AS benutzer
     FROM importe i LEFT JOIN benutzer b ON b.id = i.benutzer_id
     ORDER BY i.angelegt_am DESC LIMIT 20`,
  );
  res.status(fehler ? 400 : 200).render('import/start', { importe, fehler });
}

router.get('/import', async (req, res) => {
  await startseiteZeigen(res);
});

router.post('/import', dateiEmpfangen('datei'), async (req, res) => {
  if (req.dateiFehler) return startseiteZeigen(res, req.dateiFehler);
  const liste = await listeLesen(req.file);
  if (liste.fehler) return startseiteZeigen(res, liste.fehler);

  const gespeichert = await db.eine("SELECT zuordnung FROM import_zuordnungen WHERE name = 'Standard'");
  const zuordnung = zuordnungVorschlagen(liste.spalten, gespeichert?.zuordnung);
  const neuerImport = await db.eine(
    `INSERT INTO importe (dateiname, zuordnung, spalten, zeilen, benutzer_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      req.file.originalname.slice(0, 200),
      zuordnung,
      JSON.stringify(liste.spalten),
      JSON.stringify(liste.zeilen),
      req.benutzer.id,
    ],
  );
  res.redirect(`/import/${neuerImport.id}`);
});

router.get('/import/:id', async (req, res) => {
  const importDaten = await importLaden(nummer(req.params.id));
  if (!importDaten) return nichtGefunden(res, 'Import');
  if (importDaten.status !== 'vorschau') return res.render('import/ergebnis', { importDaten });

  const fehlend = fehlendePflichtfelder(importDaten.zuordnung);
  let pruefung = null;
  let abgleich = null;
  if (fehlend.length === 0) {
    pruefung = zeilenPruefen(importDaten.spalten, importDaten.zeilen, importDaten.zuordnung);
    abgleich = await abgleichen(db, pruefung.gueltig);
  }
  res.render('import/vorschau', { importDaten, fehlend, pruefung, abgleich, IMPORT_FELDER });
});

router.post('/import/:id/zuordnung', async (req, res) => {
  const importDaten = await importLaden(nummer(req.params.id));
  if (!importDaten || importDaten.status !== 'vorschau') return nichtGefunden(res, 'Import');

  // Nur Spalten übernehmen, die es in der Datei wirklich gibt
  const zuordnung = {};
  for (const { feld } of IMPORT_FELDER) {
    if (importDaten.spalten.includes(req.body[feld])) zuordnung[feld] = req.body[feld];
  }
  await db.ausfuehren('UPDATE importe SET zuordnung = $1 WHERE id = $2', [zuordnung, importDaten.id]);
  res.redirect(`/import/${importDaten.id}`);
});

router.post('/import/:id/uebernehmen', async (req, res) => {
  const importDaten = await importLaden(nummer(req.params.id));
  if (!importDaten || importDaten.status !== 'vorschau') return nichtGefunden(res, 'Import');
  if (fehlendePflichtfelder(importDaten.zuordnung).length > 0) return res.redirect(`/import/${importDaten.id}`);

  const ergebnis = await db.transaktion(async (t) => {
    const zusammenfassung = await uebernehmen(t, importDaten, req.benutzer.id);
    await t.ausfuehren(
      "UPDATE importe SET status = 'uebernommen', ergebnis = $1, uebernommen_am = now() WHERE id = $2",
      [zusammenfassung, importDaten.id],
    );
    return zusammenfassung;
  });
  req.session.meldung = `Import übernommen: ${ergebnis.neu} neu, ${ergebnis.geaendert} geändert, ${ergebnis.unveraendert} unverändert.`;
  res.redirect(`/import/${importDaten.id}`);
});

router.post('/import/:id/abbrechen', async (req, res) => {
  const importDaten = await importLaden(nummer(req.params.id));
  if (!importDaten || importDaten.status !== 'vorschau') return nichtGefunden(res, 'Import');
  // Die gelesenen Zeilen werden nicht mehr gebraucht
  await db.ausfuehren("UPDATE importe SET status = 'abgebrochen', zeilen = NULL WHERE id = $1", [importDaten.id]);
  req.session.meldung = 'Der Import wurde abgebrochen. Es wurde nichts geändert.';
  res.redirect('/import');
});

export default router;
