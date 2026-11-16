// Inventur – Pflichtenheft Kap. 4 „Inventur mit Strichcode (Ist-Erfassung)“, Abnahme-Testfall T5
//
// Ablauf: Inventur starten, Raum für Raum die Inventarnummern eingeben (oder mit Handscanner bzw. Kamera
// einlesen), am Ende abschließen. Was erfasst wird, ist der Ist-Stand (Tabelle inventur_erfassungen).
// Den Vergleich mit dem Soll-Stand zeigt src/seiten/soll-ist.js.
//
// „Soll-Raum“ eines Geräts = der Raum laut SAP. Bei Geräten, die (noch) nicht aus SAP kommen, der aktuelle Raum.
// In SQL: coalesce(g.sap_raumnummer, r.nummer) – coalesce nimmt den ersten Wert, der nicht leer ist.
//
//   GET  /inventur                                      laufende Inventur mit allen Räumen, sonst „Inventur starten“
//   POST /inventur/neu                                  Inventur starten
//   GET  /inventur/:id/raum/:raumId                     in einem Raum erfassen
//   POST /inventur/:id/raum/:raumId                     eine Inventarnummer erfassen
//   POST /inventur/:id/erfassung/:erfassungId/entfernen versehentliche Erfassung entfernen
//   POST /inventur/:id/abschliessen                     Inventur abschließen
import { Router } from 'express';
import { nurMitRecht } from '../anmeldung.js';
import { db } from '../datenbank.js';
import { nichtGefunden } from '../fehler.js';
import { protokollieren } from '../protokoll.js';
import { nummer, text } from '../pruefen.js';

const router = Router();
router.use('/inventur', nurMitRecht('inventur')); // gilt für alle Adressen unter /inventur

// Die Inventur, aber nur wenn sie noch läuft (abgeschlossene kann man nicht mehr ändern)
function laufendeInventur(inventurId) {
  return db.eine('SELECT * FROM inventuren WHERE id = $1 AND abgeschlossen_am IS NULL', [inventurId]);
}

router.get('/inventur', async (req, res) => {
  const laufend = await db.eine('SELECT * FROM inventuren WHERE abgeschlossen_am IS NULL ORDER BY begonnen_am DESC');
  if (!laufend) {
    const fruehere = await db.alle(
      `SELECT i.*, b.name AS begonnen_von_name,
              (SELECT count(*) FROM inventur_erfassungen e WHERE e.inventur_id = i.id) AS erfasst
       FROM inventuren i LEFT JOIN benutzer b ON b.id = i.begonnen_von
       ORDER BY i.begonnen_am DESC`,
    );
    return res.render('inventur/start', { fruehere, vorschlag: `Inventur ${new Date().getFullYear()}` });
  }

  // Je Raum: wie viele Geräte laut Soll dort sein sollten und wie viele dort schon erfasst wurden
  const raeume = await db.alle(
    `SELECT r.id, r.nummer, r.bezeichnung,
            (SELECT count(*) FROM geraete g JOIN raeume gr ON gr.id = g.raum_id
             WHERE coalesce(g.sap_raumnummer, gr.nummer) = r.nummer) AS soll,
            (SELECT count(*) FROM inventur_erfassungen e WHERE e.inventur_id = $1 AND e.raum_id = r.id) AS erfasst
     FROM raeume r
     ORDER BY r.nummer`,
    [laufend.id],
  );
  res.render('inventur/uebersicht', { inventur: laufend, raeume });
});

router.post('/inventur/neu', async (req, res) => {
  const laufend = await db.eine('SELECT id FROM inventuren WHERE abgeschlossen_am IS NULL');
  if (laufend) {
    req.session.warnung = 'Es läuft schon eine Inventur. Bitte zuerst diese abschließen.';
    return res.redirect('/inventur');
  }
  const name = text(req.body.name)?.slice(0, 100) ?? `Inventur ${new Date().getFullYear()}`;
  await db.ausfuehren('INSERT INTO inventuren (name, begonnen_von) VALUES ($1, $2)', [name, req.benutzer.id]);
  req.session.meldung = `${name} wurde gestartet. Wählen Sie jetzt einen Raum.`;
  res.redirect('/inventur');
});

// Raum wechseln über die Auswahlliste: /inventur/3/raum?raum=7 -> /inventur/3/raum/7
router.get('/inventur/:id/raum', (req, res) => {
  const raumId = nummer(req.query.raum);
  if (!raumId) return res.redirect('/inventur');
  res.redirect(`/inventur/${nummer(req.params.id)}/raum/${raumId}`);
});

router.get('/inventur/:id/raum/:raumId', async (req, res) => {
  const inventur = await laufendeInventur(nummer(req.params.id));
  if (!inventur) return res.redirect('/inventur');
  const raum = await db.eine('SELECT * FROM raeume WHERE id = $1', [nummer(req.params.raumId)]);
  if (!raum) return nichtGefunden(res, 'Raum');

  // Was in diesem Raum schon erfasst wurde, das Neueste zuerst
  const erfasst = await db.alle(
    `SELECT e.id, e.inventarnummer, e.zeitpunkt, g.id AS geraet_id, g.bezeichnung, g.herkunft,
            coalesce(g.sap_raumnummer, gr.nummer) AS soll_raum
     FROM inventur_erfassungen e
     LEFT JOIN geraete g ON g.id = e.geraet_id
     LEFT JOIN raeume gr ON gr.id = g.raum_id
     WHERE e.inventur_id = $1 AND e.raum_id = $2
     ORDER BY e.zeitpunkt DESC`,
    [inventur.id, raum.id],
  );
  // Was laut Soll in diesem Raum sein sollte, aber noch nirgends erfasst wurde
  const nochOffen = await db.alle(
    `SELECT g.id, g.inventarnummer, g.bezeichnung
     FROM geraete g JOIN raeume gr ON gr.id = g.raum_id
     WHERE coalesce(g.sap_raumnummer, gr.nummer) = $2
       AND NOT EXISTS (SELECT 1 FROM inventur_erfassungen e WHERE e.inventur_id = $1 AND e.geraet_id = g.id)
     ORDER BY g.inventarnummer`,
    [inventur.id, raum.nummer],
  );
  const raeume = await db.alle('SELECT id, nummer, bezeichnung FROM raeume ORDER BY nummer');
  res.render('inventur/raum', { inventur, raum, raeume, erfasst, nochOffen });
});

router.post('/inventur/:id/raum/:raumId', async (req, res) => {
  const inventur = await laufendeInventur(nummer(req.params.id));
  if (!inventur) return res.redirect('/inventur');
  const raum = await db.eine('SELECT * FROM raeume WHERE id = $1', [nummer(req.params.raumId)]);
  if (!raum) return nichtGefunden(res, 'Raum');
  const zurueck = `/inventur/${inventur.id}/raum/${raum.id}`;

  const inventarnummer = text(req.body.inventarnummer);
  if (!inventarnummer) return res.redirect(zurueck);
  if (inventarnummer.length > 50) {
    req.session.warnung = 'Das ist keine Inventarnummer (zu lang).';
    return res.redirect(zurueck);
  }

  const geraet = await db.eine(
    `SELECT g.id, g.bezeichnung, coalesce(g.sap_raumnummer, r.nummer) AS soll_raum
     FROM geraete g JOIN raeume r ON r.id = g.raum_id
     WHERE g.inventarnummer = $1`,
    [inventarnummer],
  );
  const frueher = await db.eine(
    `SELECT e.raum_id, r.nummer AS raumnummer
     FROM inventur_erfassungen e LEFT JOIN raeume r ON r.id = e.raum_id
     WHERE e.inventur_id = $1 AND e.inventarnummer = $2`,
    [inventur.id, inventarnummer],
  );
  if (frueher && frueher.raum_id === raum.id) {
    req.session.meldung = `${inventarnummer} ist in diesem Raum schon erfasst.`;
    return res.redirect(zurueck);
  }

  // Speichern. Wurde die Nummer bei dieser Inventur schon in einem anderen Raum erfasst, gilt jetzt dieser Raum.
  await db.ausfuehren(
    `INSERT INTO inventur_erfassungen (inventur_id, raum_id, inventarnummer, geraet_id, benutzer_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (inventur_id, inventarnummer)
     DO UPDATE SET raum_id = EXCLUDED.raum_id, geraet_id = EXCLUDED.geraet_id, benutzer_id = EXCLUDED.benutzer_id,
                   zeitpunkt = now()`,
    [inventur.id, raum.id, inventarnummer, geraet?.id ?? null, req.benutzer.id],
  );

  // Rückmeldung: grün, wenn alles passt, rot bei einer Abweichung
  const vorherWoanders = frueher ? ` Vorher war es in Raum ${frueher.raumnummer} erfasst.` : '';
  if (!geraet) {
    req.session.warnung = `${inventarnummer} ist nicht im System. Erfasst – erscheint im Soll-Ist-Vergleich.${vorherWoanders}`;
  } else if (geraet.soll_raum !== raum.nummer) {
    req.session.warnung = `${inventarnummer} (${geraet.bezeichnung}) gehört laut SAP in Raum ${geraet.soll_raum}. Hier erfasst.${vorherWoanders}`;
  } else {
    req.session.meldung = `✓ ${inventarnummer} ${geraet.bezeichnung}${vorherWoanders}`;
  }
  res.redirect(zurueck);
});

router.post('/inventur/:id/erfassung/:erfassungId/entfernen', async (req, res) => {
  const inventur = await laufendeInventur(nummer(req.params.id));
  if (!inventur) return res.redirect('/inventur');
  const erfassung = await db.eine(
    'DELETE FROM inventur_erfassungen WHERE id = $1 AND inventur_id = $2 RETURNING raum_id, inventarnummer',
    [nummer(req.params.erfassungId), inventur.id],
  );
  if (!erfassung) return nichtGefunden(res, 'Erfassung');
  req.session.meldung = `${erfassung.inventarnummer} wurde aus der Inventur entfernt.`;
  res.redirect(`/inventur/${inventur.id}/raum/${erfassung.raum_id}`);
});

// Abschließen: Bei allen gefundenen Geräten wird das Inventurdatum gespeichert. Geräte, die in einem anderen
// Raum gefunden wurden, kommen in diesen Raum (Raumwechsel mit Anlass „Inventur“). Das ist die Grundlage für
// den Export an SAP.
router.post('/inventur/:id/abschliessen', async (req, res) => {
  const inventur = await laufendeInventur(nummer(req.params.id));
  if (!inventur) return res.redirect('/inventur');

  const anzahl = await db.transaktion(async (t) => {
    // AT TIME ZONE: das Datum in Österreich, auch wenn der Server in einer anderen Zeitzone läuft
    const gefunden = await t.alle(
      `SELECT e.geraet_id, e.raum_id, r.nummer AS raumnummer, (e.zeitpunkt AT TIME ZONE 'Europe/Vienna')::date AS datum,
              g.raum_id AS bisheriger_raum_id, gr.nummer AS bisherige_raumnummer, g.letzte_inventur
       FROM inventur_erfassungen e
       JOIN geraete g ON g.id = e.geraet_id
       JOIN raeume r ON r.id = e.raum_id
       JOIN raeume gr ON gr.id = g.raum_id
       WHERE e.inventur_id = $1`,
      [inventur.id],
    );
    for (const eintrag of gefunden) {
      await t.ausfuehren('UPDATE geraete SET letzte_inventur = $1, raum_id = $2 WHERE id = $3', [
        eintrag.datum,
        eintrag.raum_id,
        eintrag.geraet_id,
      ]);
      if (eintrag.raum_id !== eintrag.bisheriger_raum_id) {
        await t.ausfuehren(
          `INSERT INTO raumwechsel (geraet_id, von_raum_id, von_raumnummer, nach_raum_id, nach_raumnummer, anlass, benutzer_id)
           VALUES ($1, $2, $3, $4, $5, 'inventur', $6)`,
          [
            eintrag.geraet_id,
            eintrag.bisheriger_raum_id,
            eintrag.bisherige_raumnummer,
            eintrag.raum_id,
            eintrag.raumnummer,
            req.benutzer.id,
          ],
        );
      }
      await protokollieren(t, {
        benutzerId: req.benutzer.id,
        bereich: 'geraet',
        eintragId: eintrag.geraet_id,
        aktion: 'inventur',
        vorher: { letzte_inventur: eintrag.letzte_inventur, raumnummer: eintrag.bisherige_raumnummer },
        nachher: { letzte_inventur: eintrag.datum, raumnummer: eintrag.raumnummer },
      });
    }
    await t.ausfuehren('UPDATE inventuren SET abgeschlossen_am = now() WHERE id = $1', [inventur.id]);
    return gefunden.length;
  });

  req.session.meldung = `${inventur.name} wurde abgeschlossen. Bei ${anzahl} Geräten ist jetzt das Inventurdatum eingetragen.`;
  res.redirect(`/soll-ist?inventur=${inventur.id}`);
});

export default router;
