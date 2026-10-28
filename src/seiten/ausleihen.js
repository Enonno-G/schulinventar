// Ausleihe von Geräten – Pflichtenheft Kap. 4, KANN-Anforderung „Ausleihe von Geräten“
// Geräte wie Laptops können an Lehrpersonen ausgeliehen werden. Gespeichert wird nur, wer welches Gerät bis
// wann hat (Pflichtenheft Kap. 5 Datenschutz).
//
//   GET  /ausleihen                 ausgeliehene Geräte (überfällige zuerst) und die letzten Rückgaben
//   POST /geraete/:id/ausleihen     Gerät ausleihen (Formular in der Detailansicht des Geräts)
//   POST /ausleihen/:id/zurueck     Gerät ist zurück
import { Router } from 'express';
import { nurMitRecht } from '../anmeldung.js';
import { db } from '../datenbank.js';
import { nichtGefunden } from '../fehler.js';
import { protokollieren } from '../protokoll.js';
import { istDatum, nummer, text } from '../pruefen.js';

const router = Router();

router.get('/ausleihen', async (req, res) => {
  // current_date = heute. „bis < heute“ heißt: überfällig
  const ausgeliehen = await db.alle(
    `SELECT a.id, a.ausgeliehen_an, a.bis, a.ausgeliehen_am, a.bis < current_date AS ueberfaellig,
            g.id AS geraet_id, g.inventarnummer, g.bezeichnung
     FROM ausleihen a JOIN geraete g ON g.id = a.geraet_id
     WHERE a.zurueck_am IS NULL
     ORDER BY a.bis, g.inventarnummer`,
  );
  const zurueck = await db.alle(
    `SELECT a.ausgeliehen_an, a.ausgeliehen_am, a.zurueck_am, g.id AS geraet_id, g.inventarnummer, g.bezeichnung
     FROM ausleihen a JOIN geraete g ON g.id = a.geraet_id
     WHERE a.zurueck_am IS NOT NULL
     ORDER BY a.zurueck_am DESC LIMIT 50`,
  );
  res.render('ausleihen', { ausgeliehen, zurueck });
});

router.post('/geraete/:id/ausleihen', nurMitRecht('ausleihe'), async (req, res) => {
  const geraet = await db.eine('SELECT id, inventarnummer FROM geraete WHERE id = $1', [nummer(req.params.id)]);
  if (!geraet) return nichtGefunden(res, 'Gerät');

  const ausleihe = { ausgeliehen_an: text(req.body.ausgeliehen_an), bis: text(req.body.bis) };
  const heute = new Date().toISOString().slice(0, 10);
  let fehler = null;
  if (!ausleihe.ausgeliehen_an || ausleihe.ausgeliehen_an.length > 100)
    fehler = 'Bitte eintragen, wer das Gerät bekommt.';
  else if (!istDatum(ausleihe.bis)) fehler = 'Bitte das Rückgabedatum auswählen.';
  else if (ausleihe.bis < heute) fehler = 'Das Rückgabedatum darf nicht in der Vergangenheit liegen.';
  else if (await db.eine('SELECT id FROM ausleihen WHERE geraet_id = $1 AND zurueck_am IS NULL', [geraet.id])) {
    fehler = 'Das Gerät ist schon ausgeliehen.';
  }
  if (fehler) {
    req.session.warnung = fehler;
    return res.redirect(`/geraete/${geraet.id}`);
  }

  await db.transaktion(async (t) => {
    await t.ausfuehren('INSERT INTO ausleihen (geraet_id, ausgeliehen_an, bis, benutzer_id) VALUES ($1, $2, $3, $4)', [
      geraet.id,
      ausleihe.ausgeliehen_an,
      ausleihe.bis,
      req.benutzer.id,
    ]);
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'geraet',
      eintragId: geraet.id,
      aktion: 'ausgeliehen',
      nachher: ausleihe,
    });
  });
  req.session.meldung = `Gerät ${geraet.inventarnummer} ist an ${ausleihe.ausgeliehen_an} ausgeliehen.`;
  res.redirect(`/geraete/${geraet.id}`);
});

router.post('/ausleihen/:id/zurueck', nurMitRecht('ausleihe'), async (req, res) => {
  const ausleihe = await db.eine(
    `SELECT a.id, a.geraet_id, a.ausgeliehen_an, a.bis, g.inventarnummer
     FROM ausleihen a JOIN geraete g ON g.id = a.geraet_id
     WHERE a.id = $1 AND a.zurueck_am IS NULL`,
    [nummer(req.params.id)],
  );
  if (!ausleihe) return nichtGefunden(res, 'Ausleihe');

  await db.transaktion(async (t) => {
    await t.ausfuehren('UPDATE ausleihen SET zurueck_am = now() WHERE id = $1', [ausleihe.id]);
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'geraet',
      eintragId: ausleihe.geraet_id,
      aktion: 'zurueckgegeben',
      vorher: { ausgeliehen_an: ausleihe.ausgeliehen_an, bis: ausleihe.bis },
    });
  });
  req.session.meldung = `Gerät ${ausleihe.inventarnummer} ist zurückgegeben.`;
  // Zurück zur Seite, von der man kam (Geräteseite oder Ausleih-Liste)
  res.redirect(req.body.zurueck === 'liste' ? '/ausleihen' : `/geraete/${ausleihe.geraet_id}`);
});

export default router;
