// Belege: Rechnungen, Lieferscheine und Garantiedokumente – Pflichtenheft Kap. 4 „Formular für zusätzliche
// Eingaben“, Abnahme-Testfälle T3 (eine Rechnung für mehrere Geräte) und T8 (unzulässige Datei wird abgelehnt)
//
//   GET  /belege                 Liste aller Belege mit Suche
//   GET  /belege/neu             Formular „Beleg hochladen“    POST /belege/neu    speichern
//   GET  /belege/:id             ein Beleg mit allen Geräten, denen er zugeordnet ist
//   GET  /belege/:id/datei       die Datei selbst (PDF oder Bild) im Browser öffnen
//   POST /belege/:id/zuordnen    weiteren Geräten zuordnen
//   POST /belege/:id/entfernen   Zuordnung zu einem Gerät entfernen (der Beleg selbst bleibt gespeichert)
//
// Löschen kann man Belege absichtlich nicht: Sie müssen laut Pflichtenheft Kap. 5 aufbewahrt werden.
import { Router } from 'express';
import { nurMitRecht } from '../anmeldung.js';
import { dateiEmpfangen, dateiEntfernen, dateiPruefen, dateiSpeichern } from '../dateien.js';
import { db } from '../datenbank.js';
import { einstellungen } from '../einstellungen.js';
import { nichtGefunden } from '../fehler.js';
import { BEZEICHNUNGEN } from '../format.js';
import { protokollieren } from '../protokoll.js';
import { hatFehler, inventarnummernAusText, istDatum, nummer, text } from '../pruefen.js';

const router = Router();

const BELEGARTEN = ['rechnung', 'lieferschein', 'garantie', 'sonstiges'];

// Sucht die Geräte zu den eingegebenen Inventarnummern.
// Ergebnis: die gefundenen Geräte und eine Fehlermeldung, falls etwas nicht passt (sonst null).
async function geraeteZuNummern(eingabe) {
  const nummern = inventarnummernAusText(eingabe);
  if (nummern.length === 0) return { geraete: [], fehler: 'Bitte mindestens eine Inventarnummer eingeben' };

  // = ANY($1) heißt: Die Inventarnummer ist eine der Nummern aus der Liste
  const geraete = await db.alle('SELECT id, inventarnummer FROM geraete WHERE inventarnummer = ANY($1)', [nummern]);
  const gefunden = geraete.map((geraet) => geraet.inventarnummer);
  const unbekannt = nummern.filter((nummer) => !gefunden.includes(nummer));
  if (unbekannt.length > 0) {
    return { geraete, fehler: `Diese Inventarnummern gibt es nicht: ${unbekannt.join(', ')}` };
  }
  return { geraete, fehler: null };
}

// Aufbewahrungsfrist: bis Ende des Jahres, in dem der Beleg ausgestellt wurde, plus die eingestellten Jahre
// (in Österreich üblich sind 7). Die genaue Frist legt der Auftraggeber fest, siehe AUFBEWAHRUNG_JAHRE in .env.
function aufbewahrenBis(belegdatum) {
  const jahr = belegdatum ? Number(belegdatum.slice(0, 4)) : new Date().getFullYear();
  return `${jahr + einstellungen.aufbewahrungJahre}-12-31`;
}

// So steht der Beleg im Änderungsprotokoll eines Geräts, z. B. „Rechnung Rechnung-2026-117.pdf“
function belegName(beleg) {
  return `${BEZEICHNUNGEN[beleg.art]} ${beleg.dateiname}`;
}

// Ordnet den Beleg den Geräten zu und vermerkt das im Änderungsprotokoll jedes Geräts.
// Geräte, denen der Beleg schon zugeordnet ist, werden übersprungen. Ergebnis: Anzahl neu zugeordneter Geräte.
async function geraeteZuordnen(t, beleg, geraete, benutzerId) {
  let anzahl = 0;
  for (const geraet of geraete) {
    const neu = await t.eine(
      `INSERT INTO geraet_belege (geraet_id, beleg_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING geraet_id`,
      [geraet.id, beleg.id],
    );
    if (!neu) continue; // war schon zugeordnet
    anzahl++;
    await protokollieren(t, {
      benutzerId,
      bereich: 'geraet',
      eintragId: geraet.id,
      aktion: 'beleg_zugeordnet',
      nachher: { beleg: belegName(beleg) },
    });
  }
  return anzahl;
}

function belegLaden(belegId) {
  return db.eine(
    `SELECT b.*, u.name AS hochgeladen_von_name
     FROM belege b LEFT JOIN benutzer u ON u.id = b.hochgeladen_von
     WHERE b.id = $1`,
    [belegId],
  );
}

// Detailseite anzeigen. „formular“ enthält die Eingabe und Fehler, wenn „Weitere Geräte zuordnen“ nicht geklappt hat.
async function detailZeigen(res, beleg, formular = { inventarnummern: '', fehler: null }) {
  const geraete = await db.alle(
    `SELECT g.id, g.inventarnummer, g.bezeichnung, r.nummer AS raumnummer, r.bezeichnung AS raumbezeichnung
     FROM geraet_belege gb
     JOIN geraete g ON g.id = gb.geraet_id
     JOIN raeume r ON r.id = g.raum_id
     WHERE gb.beleg_id = $1
     ORDER BY g.inventarnummer`,
    [beleg.id],
  );
  res.status(formular.fehler ? 400 : 200).render('belege/detail', { beleg, geraete, formular });
}

router.get('/belege', async (req, res) => {
  const filter = { suche: text(req.query.suche), art: BELEGARTEN.includes(req.query.art) ? req.query.art : null };

  const bedingungen = [];
  const werte = [];
  if (filter.suche) {
    // Gesucht wird im Dateinamen und in den Inventarnummern der zugeordneten Geräte
    werte.push('%' + filter.suche + '%');
    bedingungen.push(`(b.dateiname ILIKE $${werte.length} OR EXISTS (
      SELECT 1 FROM geraet_belege x JOIN geraete g ON g.id = x.geraet_id
      WHERE x.beleg_id = b.id AND g.inventarnummer ILIKE $${werte.length}))`);
  }
  if (filter.art) {
    werte.push(filter.art);
    bedingungen.push('b.art = $' + werte.length);
  }
  let where = '';
  if (bedingungen.length > 0) where = 'WHERE ' + bedingungen.join(' AND ');

  const belege = await db.alle(
    `SELECT b.id, b.art, b.dateiname, b.belegdatum, b.hochgeladen_am, count(gb.geraet_id) AS anzahl_geraete
     FROM belege b LEFT JOIN geraet_belege gb ON gb.beleg_id = b.id
     ${where}
     GROUP BY b.id
     ORDER BY b.hochgeladen_am DESC
     LIMIT 100`,
    werte,
  );
  res.render('belege/liste', { belege, filter, BELEGARTEN });
});

router.get('/belege/neu', nurMitRecht('belege_hochladen'), async (req, res) => {
  // Kommt man von einem Gerät („Beleg hochladen“ in der Detailansicht), ist dessen Inventarnummer schon eingetragen
  const geraet = await db.eine('SELECT id, inventarnummer FROM geraete WHERE id = $1', [nummer(req.query.geraet)]);
  res.render('belege/formular', {
    beleg: { art: 'rechnung', inventarnummern: geraet?.inventarnummer ?? '', geraet: geraet?.id },
    fehler: {},
    BELEGARTEN,
  });
});

// dateiEmpfangen('datei') packt das Formular mit der Datei aus (siehe src/dateien.js)
router.post('/belege/neu', nurMitRecht('belege_hochladen'), dateiEmpfangen('datei'), async (req, res) => {
  const beleg = {
    art: req.body.art,
    belegdatum: text(req.body.belegdatum),
    inventarnummern: req.body.inventarnummern ?? '',
    geraet: nummer(req.body.geraet), // nur für „Abbrechen“: zurück zu diesem Gerät
  };

  const fehler = {};
  if (!BELEGARTEN.includes(beleg.art)) fehler.art = 'Bitte die Art des Belegs auswählen';
  if (beleg.belegdatum && !istDatum(beleg.belegdatum)) fehler.belegdatum = 'Ungültiges Datum';
  const zuordnung = await geraeteZuNummern(beleg.inventarnummern);
  if (zuordnung.fehler) fehler.inventarnummern = zuordnung.fehler;
  const datei = dateiPruefen(req.file);
  if (req.dateiFehler) fehler.datei = req.dateiFehler;
  else if (datei.fehler) fehler.datei = datei.fehler;

  if (hatFehler(fehler)) {
    return res.status(400).render('belege/formular', { beleg, fehler, BELEGARTEN });
  }

  // Zuerst die Datei speichern, dann die Angaben in der Datenbank.
  // Klappt die Datenbank nicht, wird die Datei wieder entfernt, damit nichts halb gespeichert bleibt.
  const { gespeichertAls, pruefsumme } = await dateiSpeichern(req.file);
  let neuerBeleg;
  try {
    neuerBeleg = await db.transaktion(async (t) => {
      const gespeichert = await t.eine(
        `INSERT INTO belege (art, dateiname, gespeichert_als, dateityp, groesse_bytes, pruefsumme,
                             belegdatum, aufbewahren_bis, hochgeladen_von)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, art, dateiname, belegdatum, aufbewahren_bis, pruefsumme`,
        [
          beleg.art,
          req.file.originalname.slice(0, 200),
          gespeichertAls,
          datei.dateityp,
          req.file.size,
          pruefsumme,
          beleg.belegdatum,
          aufbewahrenBis(beleg.belegdatum),
          req.benutzer.id,
        ],
      );
      await protokollieren(t, {
        benutzerId: req.benutzer.id,
        bereich: 'beleg',
        eintragId: gespeichert.id,
        aktion: 'angelegt',
        nachher: gespeichert,
      });
      await geraeteZuordnen(t, gespeichert, zuordnung.geraete, req.benutzer.id);
      return gespeichert;
    });
  } catch (fehler) {
    await dateiEntfernen(gespeichertAls);
    throw fehler;
  }

  const anzahl = zuordnung.geraete.length;
  req.session.meldung = `${belegName(neuerBeleg)} wurde hochgeladen und ${anzahl} ${anzahl === 1 ? 'Gerät' : 'Geräten'} zugeordnet.`;
  // Bei einem Gerät zurück zu diesem Gerät, bei mehreren zum Beleg mit der Liste aller Geräte
  if (anzahl === 1) return res.redirect(`/geraete/${zuordnung.geraete[0].id}`);
  res.redirect(`/belege/${neuerBeleg.id}`);
});

router.get('/belege/:id', async (req, res) => {
  const beleg = await belegLaden(nummer(req.params.id));
  if (!beleg) return nichtGefunden(res, 'Beleg');
  await detailZeigen(res, beleg);
});

router.get('/belege/:id/datei', async (req, res) => {
  const beleg = await db.eine('SELECT dateiname, gespeichert_als, dateityp FROM belege WHERE id = $1', [
    nummer(req.params.id),
  ]);
  if (!beleg) return nichtGefunden(res, 'Beleg');

  const optionen = {
    root: einstellungen.uploadOrdner, // nur Dateien aus dem Upload-Ordner
    headers: {
      'Content-Type': beleg.dateityp,
      // inline = im Browser anzeigen (PDF-Ansicht oder Bild) statt herunterladen.
      // Der Dateiname wird verschlüsselt mitgeschickt, damit auch Umlaute ankommen.
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(beleg.dateiname)}`,
      // Die Sicherheitsregel für unsere HTML-Seiten (siehe helmet in app.js) würde die PDF-Ansicht von Chrome
      // blockieren. Für die geprüfte Datei gilt deshalb diese Regel: Sie darf nur sich selbst anzeigen.
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; object-src 'self'; style-src 'unsafe-inline'",
    },
  };
  res.sendFile(beleg.gespeichert_als, optionen, (fehler) => {
    if (!fehler) return;
    console.error(`Datei zu Beleg fehlt: ${beleg.gespeichert_als}`, fehler.message);
    if (!res.headersSent) nichtGefunden(res, 'Datei');
  });
});

router.post('/belege/:id/zuordnen', nurMitRecht('belege_hochladen'), async (req, res) => {
  const beleg = await belegLaden(nummer(req.params.id));
  if (!beleg) return nichtGefunden(res, 'Beleg');

  const zuordnung = await geraeteZuNummern(req.body.inventarnummern);
  if (zuordnung.fehler) {
    return detailZeigen(res, beleg, { inventarnummern: req.body.inventarnummern ?? '', fehler: zuordnung.fehler });
  }

  const anzahl = await db.transaktion((t) => geraeteZuordnen(t, beleg, zuordnung.geraete, req.benutzer.id));
  if (anzahl === 0) req.session.meldung = 'Der Beleg war diesen Geräten schon zugeordnet.';
  else req.session.meldung = `Der Beleg wurde ${anzahl} weiteren ${anzahl === 1 ? 'Gerät' : 'Geräten'} zugeordnet.`;
  res.redirect(`/belege/${beleg.id}`);
});

router.post('/belege/:id/entfernen', nurMitRecht('belege_hochladen'), async (req, res) => {
  const beleg = await belegLaden(nummer(req.params.id));
  if (!beleg) return nichtGefunden(res, 'Beleg');

  const geraet = await db.eine(
    `SELECT g.id, g.inventarnummer FROM geraet_belege gb JOIN geraete g ON g.id = gb.geraet_id
     WHERE gb.beleg_id = $1 AND gb.geraet_id = $2`,
    [beleg.id, nummer(req.body.geraet_id)],
  );
  if (!geraet) return nichtGefunden(res, 'Zuordnung');

  await db.transaktion(async (t) => {
    await t.ausfuehren('DELETE FROM geraet_belege WHERE beleg_id = $1 AND geraet_id = $2', [beleg.id, geraet.id]);
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'geraet',
      eintragId: geraet.id,
      aktion: 'beleg_entfernt',
      vorher: { beleg: belegName(beleg) },
    });
  });
  req.session.meldung = `Die Zuordnung zu Gerät ${geraet.inventarnummer} wurde entfernt. Der Beleg selbst bleibt gespeichert.`;
  res.redirect(`/belege/${beleg.id}`);
});

export default router;
