// Räume – Pflichtenheft Kap. 4 „Raumverwaltung“
// Räume mit Raumnummer, Bezeichnung und Stockwerk. Löschen nur, wenn kein Gerät mehr drin ist.
//
//   GET  /raeume                  Liste aller Räume
//   GET  /raeume.csv              dieselbe Liste als CSV-Datei für Excel
//   GET  /raeume/neu              Formular „Neuer Raum“        POST /raeume/neu              speichern
//   GET  /raeume/:id              ein Raum mit allen Geräten
//   GET  /raeume/:id/bearbeiten   Formular „Raum bearbeiten“   POST /raeume/:id/bearbeiten   speichern
//   POST /raeume/:id/loeschen     Raum löschen
import { Router } from 'express';
import { nurMitRecht } from '../anmeldung.js';
import { csvSenden } from '../csv.js';
import { db } from '../datenbank.js';
import { nichtGefunden } from '../fehler.js';
import { protokollieren } from '../protokoll.js';
import { hatFehler, nummer, text } from '../pruefen.js';

const router = Router();

// Liest die Felder aus dem Formular und prüft sie.
// Ergebnis: der Raum und die Fehlermeldungen je Feld (leer, wenn alles passt).
async function raumAusFormular(formular, raumId = 0) {
  const raum = {
    nummer: text(formular.nummer),
    bezeichnung: text(formular.bezeichnung),
    stockwerk: text(formular.stockwerk),
  };

  const fehler = {};
  if (!raum.nummer) {
    fehler.nummer = 'Bitte eine Raumnummer eingeben';
  } else if (raum.nummer.length > 30) {
    fehler.nummer = 'Die Raumnummer darf höchstens 30 Zeichen haben';
  } else {
    const gleicheNummer = await db.eine('SELECT id FROM raeume WHERE nummer = $1 AND id <> $2', [raum.nummer, raumId]);
    if (gleicheNummer) fehler.nummer = 'Diese Raumnummer gibt es schon';
  }
  return { raum, fehler };
}

// Alle Räume mit der Anzahl ihrer Geräte
function raeumeLaden() {
  return db.alle(`
    SELECT r.id, r.nummer, r.bezeichnung, r.stockwerk, count(g.id) AS anzahl_geraete
    FROM raeume r LEFT JOIN geraete g ON g.raum_id = r.id
    GROUP BY r.id
    ORDER BY r.nummer`);
}

router.get('/raeume', async (req, res) => {
  res.render('raeume/liste', { raeume: await raeumeLaden() });
});

router.get('/raeume.csv', async (req, res) => {
  const spalten = [
    { titel: 'Raumnummer', feld: 'nummer' },
    { titel: 'Bezeichnung', feld: 'bezeichnung' },
    { titel: 'Stockwerk', feld: 'stockwerk' },
    { titel: 'Anzahl Geräte', feld: 'anzahl_geraete' },
  ];
  const heute = new Date().toISOString().slice(0, 10);
  csvSenden(res, `raeume-${heute}.csv`, spalten, await raeumeLaden());
});

router.get('/raeume/neu', nurMitRecht('raeume_bearbeiten'), (req, res) => {
  res.render('raeume/formular', { raum: {}, fehler: {} });
});

router.post('/raeume/neu', nurMitRecht('raeume_bearbeiten'), async (req, res) => {
  const { raum, fehler } = await raumAusFormular(req.body);
  if (hatFehler(fehler)) return res.status(400).render('raeume/formular', { raum, fehler });

  // Raum speichern und ins Änderungsprotokoll schreiben: beides oder nichts
  await db.transaktion(async (t) => {
    const neuerRaum = await t.eine(
      'INSERT INTO raeume (nummer, bezeichnung, stockwerk) VALUES ($1, $2, $3) RETURNING *',
      [raum.nummer, raum.bezeichnung, raum.stockwerk],
    );
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'raum',
      eintragId: neuerRaum.id,
      aktion: 'angelegt',
      nachher: neuerRaum,
    });
  });
  req.session.meldung = `Raum ${raum.nummer} wurde angelegt.`;
  res.redirect('/raeume');
});

router.get('/raeume/:id', async (req, res) => {
  const raum = await db.eine('SELECT * FROM raeume WHERE id = $1', [nummer(req.params.id)]);
  if (!raum) return nichtGefunden(res, 'Raum');

  const geraete = await db.alle(
    `SELECT id, inventarnummer, bezeichnung, typ, seriennummer, garantie_bis
     FROM geraete WHERE raum_id = $1 ORDER BY inventarnummer`,
    [raum.id],
  );
  res.render('raeume/detail', { raum, geraete });
});

router.get('/raeume/:id/bearbeiten', nurMitRecht('raeume_bearbeiten'), async (req, res) => {
  const raum = await db.eine('SELECT * FROM raeume WHERE id = $1', [nummer(req.params.id)]);
  if (!raum) return nichtGefunden(res, 'Raum');
  res.render('raeume/formular', { raum, fehler: {} });
});

router.post('/raeume/:id/bearbeiten', nurMitRecht('raeume_bearbeiten'), async (req, res) => {
  const vorher = await db.eine('SELECT * FROM raeume WHERE id = $1', [nummer(req.params.id)]);
  if (!vorher) return nichtGefunden(res, 'Raum');

  const { raum, fehler } = await raumAusFormular(req.body, vorher.id);
  if (hatFehler(fehler)) return res.status(400).render('raeume/formular', { raum: { ...raum, id: vorher.id }, fehler });

  await db.transaktion(async (t) => {
    const nachher = await t.eine(
      'UPDATE raeume SET nummer = $1, bezeichnung = $2, stockwerk = $3 WHERE id = $4 RETURNING *',
      [raum.nummer, raum.bezeichnung, raum.stockwerk, vorher.id],
    );
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'raum',
      eintragId: vorher.id,
      aktion: 'geaendert',
      vorher,
      nachher,
    });
  });
  req.session.meldung = `Raum ${raum.nummer} wurde gespeichert.`;
  res.redirect('/raeume');
});

router.post('/raeume/:id/loeschen', nurMitRecht('raeume_bearbeiten'), async (req, res) => {
  const raum = await db.eine('SELECT * FROM raeume WHERE id = $1', [nummer(req.params.id)]);
  if (!raum) return nichtGefunden(res, 'Raum');

  const zaehlung = await db.eine('SELECT count(*) AS anzahl FROM geraete WHERE raum_id = $1', [raum.id]);
  if (zaehlung.anzahl > 0) {
    req.session.warnung = `Raum ${raum.nummer} kann nicht gelöscht werden, weil ihm noch ${zaehlung.anzahl} Gerät(e) zugeordnet sind.`;
    return res.redirect('/raeume');
  }

  await db.transaktion(async (t) => {
    await t.ausfuehren('DELETE FROM raeume WHERE id = $1', [raum.id]);
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'raum',
      eintragId: raum.id,
      aktion: 'geloescht',
      vorher: raum,
    });
  });
  req.session.meldung = `Raum ${raum.nummer} wurde gelöscht.`;
  res.redirect('/raeume');
});

export default router;
