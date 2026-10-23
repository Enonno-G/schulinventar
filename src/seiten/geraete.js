// Geräte – Pflichtenheft Kap. 4 „Export in Web-App“ (Liste, Suche, Filter, Detailansicht),
// „Raumverwaltung“ (Raumwechsel mit Datum) und „Verarbeitung dieser Daten“ (Eingaben prüfen)
//
//   GET  /geraete                   Liste mit Suche und Filtern
//   GET  /geraete.csv               dieselbe Liste als CSV-Datei für Excel (Pflichtenheft Kap. 4 „Export in CSV“)
//   GET  /geraete/neu               Formular „Neues Gerät“       POST /geraete/neu               speichern
//   GET  /geraete/:id               alles zu einem Gerät
//   GET  /geraete/:id/bearbeiten    Formular „Gerät bearbeiten“  POST /geraete/:id/bearbeiten    speichern
import { Router } from 'express';
import { GERAETEFELDER_JE_ROLLE, nurMitRecht } from '../anmeldung.js';
import { csvSenden } from '../csv.js';
import { db } from '../datenbank.js';
import { nichtGefunden } from '../fehler.js';
import { protokollieren } from '../protokoll.js';
import { hatFehler, istDatum, nummer, text } from '../pruefen.js';

const router = Router();

const GERAETE_PRO_SEITE = 25;

// Alle Felder des Formulars und wie lang sie höchstens sein dürfen
const FELDER = [
  'inventarnummer',
  'bezeichnung',
  'typ',
  'seriennummer',
  'raum_id',
  'anschaffungsdatum',
  'kaufdatum',
  'inbetriebnahme',
  'garantie_bis',
  'lieferant',
  'anmerkungen',
];
const DATUMSFELDER = ['anschaffungsdatum', 'kaufdatum', 'inbetriebnahme', 'garantie_bis'];
const HOECHSTLAENGE = {
  inventarnummer: 50,
  bezeichnung: 200,
  typ: 100,
  seriennummer: 100,
  lieferant: 200,
  anmerkungen: 2000,
};

// Spalten der CSV-Datei
const CSV_SPALTEN = [
  { titel: 'Inventarnummer', feld: 'inventarnummer' },
  { titel: 'Bezeichnung', feld: 'bezeichnung' },
  { titel: 'Gerätetyp', feld: 'typ' },
  { titel: 'Seriennummer', feld: 'seriennummer' },
  { titel: 'Raum', feld: 'raumnummer' },
  { titel: 'Raumbezeichnung', feld: 'raumbezeichnung' },
  { titel: 'Anschaffungsdatum', feld: 'anschaffungsdatum', datum: true },
  { titel: 'Kaufdatum', feld: 'kaufdatum', datum: true },
  { titel: 'Inbetriebnahme', feld: 'inbetriebnahme', datum: true },
  { titel: 'Garantie bis', feld: 'garantie_bis', datum: true },
  { titel: 'Lieferant', feld: 'lieferant' },
  { titel: 'Anmerkungen', feld: 'anmerkungen' },
  { titel: 'Raum laut SAP', feld: 'sap_raumnummer' },
  { titel: 'Letzte Inventur', feld: 'letzte_inventur', datum: true },
];

// Den Lieferanten über den Namen finden oder neu anlegen. Ergebnis: seine id (oder null, wenn kein Name).
async function lieferantId(t, name) {
  if (!name) return null;
  const vorhanden = await t.eine('SELECT id FROM lieferanten WHERE lower(name) = lower($1)', [name]);
  if (vorhanden) return vorhanden.id;
  const neu = await t.eine('INSERT INTO lieferanten (name) VALUES ($1) RETURNING id', [name]);
  return neu.id;
}

// Liest die Felder aus dem Formular und prüft sie.
// Ergebnis: das Gerät und die Fehlermeldungen je Feld (leer, wenn alles passt).
async function geraetAusFormular(formular, geraetId = 0) {
  const geraet = {};
  for (const feld of FELDER) geraet[feld] = text(formular[feld]);
  geraet.raum_id = nummer(geraet.raum_id);

  const fehler = {};
  if (!geraet.inventarnummer) fehler.inventarnummer = 'Bitte die Inventarnummer eingeben';
  if (!geraet.bezeichnung) fehler.bezeichnung = 'Bitte eine Bezeichnung eingeben';
  if (!geraet.raum_id) fehler.raum_id = 'Bitte einen Raum auswählen';

  for (const [feld, laenge] of Object.entries(HOECHSTLAENGE)) {
    if (geraet[feld] && geraet[feld].length > laenge) fehler[feld] = `Höchstens ${laenge} Zeichen`;
  }
  for (const feld of DATUMSFELDER) {
    if (geraet[feld] && !istDatum(geraet[feld])) fehler[feld] = 'Ungültiges Datum';
  }
  // Daten im Format JJJJ-MM-TT kann man wie Text vergleichen
  if (geraet.kaufdatum && geraet.garantie_bis && geraet.garantie_bis < geraet.kaufdatum) {
    fehler.garantie_bis = 'Darf nicht vor dem Kaufdatum liegen';
  }
  if (geraet.kaufdatum && geraet.inbetriebnahme && geraet.inbetriebnahme < geraet.kaufdatum) {
    fehler.inbetriebnahme = 'Darf nicht vor dem Kaufdatum liegen';
  }

  if (geraet.inventarnummer && !fehler.inventarnummer) {
    const gleicheNummer = await db.eine('SELECT id FROM geraete WHERE inventarnummer = $1 AND id <> $2', [
      geraet.inventarnummer,
      geraetId,
    ]);
    if (gleicheNummer) fehler.inventarnummer = 'Diese Inventarnummer gibt es schon';
  }
  if (geraet.raum_id) {
    const raum = await db.eine('SELECT nummer FROM raeume WHERE id = $1', [geraet.raum_id]);
    if (raum) geraet.raumnummer = raum.nummer;
    else fehler.raum_id = 'Diesen Raum gibt es nicht';
  }
  return { geraet, fehler };
}

// Ein Gerät mit Raum und Lieferant laden
function geraetLaden(geraetId) {
  return db.eine(
    `SELECT g.*, r.nummer AS raumnummer, r.bezeichnung AS raumbezeichnung, l.name AS lieferant
     FROM geraete g
     JOIN raeume r ON r.id = g.raum_id
     LEFT JOIN lieferanten l ON l.id = g.lieferant_id
     WHERE g.id = $1`,
    [geraetId],
  );
}

// Welche Felder darf dieser Benutzer bei diesem Gerät ändern?
function aenderbareFelder(benutzer, geraet) {
  let felder = GERAETEFELDER_JE_ROLLE[benutzer.rolle];
  // Die Inventarnummer von Geräten aus SAP bleibt immer gleich
  if (geraet && geraet.herkunft === 'sap') felder = felder.filter((feld) => feld !== 'inventarnummer');
  return felder;
}

// Was ins Änderungsprotokoll kommt: die Formularfelder, statt der Raum-ID die Raumnummer
function fuersProtokoll(geraet) {
  const daten = { raumnummer: geraet.raumnummer };
  for (const feld of FELDER) {
    if (feld !== 'raum_id') daten[feld] = geraet[feld];
  }
  return daten;
}

// Für die Auswahllisten im Formular und in den Filtern
async function auswahllisten() {
  const raeume = await db.alle('SELECT id, nummer, bezeichnung FROM raeume ORDER BY nummer');
  const typen = await db.alle('SELECT DISTINCT typ FROM geraete WHERE typ IS NOT NULL ORDER BY typ');
  const lieferanten = await db.alle('SELECT name FROM lieferanten ORDER BY name');
  return { raeume, typen: typen.map((zeile) => zeile.typ), lieferanten: lieferanten.map((zeile) => zeile.name) };
}

// Die Filter stehen in der Adresse, z. B. /geraete?suche=beamer&raum=3&seite=2
function filterLesen(adresse) {
  return {
    suche: text(adresse.suche),
    raum: nummer(adresse.raum),
    typ: text(adresse.typ),
    garantieBis: istDatum(adresse.garantie_bis) ? adresse.garantie_bis : null,
    seite: nummer(adresse.seite) ?? 1,
  };
}

// Dieselben Filter als Adresse, z. B. für „Weiter“ oder den CSV-Export: 'suche=beamer&raum=3'
function filterAlsAdresse(filter) {
  const parameter = new URLSearchParams();
  if (filter.suche) parameter.set('suche', filter.suche);
  if (filter.raum) parameter.set('raum', filter.raum);
  if (filter.typ) parameter.set('typ', filter.typ);
  if (filter.garantieBis) parameter.set('garantie_bis', filter.garantieBis);
  return parameter.toString();
}

// Baut aus den Filtern den WHERE-Teil der Abfrage und die Werte für die Platzhalter
function filterBedingungen(filter) {
  // Bedingungen für die Abfrage sammeln. Jeder Wert bekommt einen Platzhalter $1, $2, …
  const bedingungen = [];
  const werte = [];
  if (filter.suche) {
    werte.push('%' + filter.suche + '%');
    const platzhalter = '$' + werte.length;
    bedingungen.push(
      `(g.inventarnummer ILIKE ${platzhalter} OR g.seriennummer ILIKE ${platzhalter} OR g.bezeichnung ILIKE ${platzhalter})`,
    );
  }
  if (filter.raum) {
    werte.push(filter.raum);
    bedingungen.push('g.raum_id = $' + werte.length);
  }
  if (filter.typ) {
    werte.push(filter.typ);
    bedingungen.push('g.typ = $' + werte.length);
  }
  if (filter.garantieBis) {
    werte.push(filter.garantieBis);
    bedingungen.push('g.garantie_bis <= $' + werte.length);
  }
  let where = '';
  if (bedingungen.length > 0) where = 'WHERE ' + bedingungen.join(' AND ');
  return { where, werte };
}

router.get('/geraete', async (req, res) => {
  const filter = filterLesen(req.query);
  const { where, werte } = filterBedingungen(filter);

  // Wie viele Geräte passen insgesamt? Daraus ergibt sich die Anzahl der Seiten.
  const zaehlung = await db.eine(`SELECT count(*) AS anzahl FROM geraete g ${where}`, werte);
  const seitenAnzahl = Math.max(1, Math.ceil(zaehlung.anzahl / GERAETE_PRO_SEITE));
  const seite = Math.min(filter.seite, seitenAnzahl);

  // Nur die Geräte der aktuellen Seite laden (LIMIT und OFFSET sind von uns berechnete Zahlen)
  const geraete = await db.alle(
    `SELECT g.id, g.inventarnummer, g.bezeichnung, g.typ, g.garantie_bis, r.nummer AS raumnummer, r.bezeichnung AS raumbezeichnung
     FROM geraete g JOIN raeume r ON r.id = g.raum_id
     ${where}
     ORDER BY g.inventarnummer
     LIMIT ${GERAETE_PRO_SEITE} OFFSET ${(seite - 1) * GERAETE_PRO_SEITE}`,
    werte,
  );

  // Adresse für „Zurück“ und „Weiter“: dieselben Filter, andere Seite
  function seitenAdresse(neueSeite) {
    const parameter = new URLSearchParams(filterAlsAdresse(filter));
    parameter.set('seite', neueSeite);
    return '/geraete?' + parameter.toString();
  }

  res.render('geraete/liste', {
    geraete,
    filter,
    anzahl: zaehlung.anzahl,
    seite,
    seitenAnzahl,
    seitenAdresse,
    csvAdresse: '/geraete.csv?' + filterAlsAdresse(filter),
    ...(await auswahllisten()),
  });
});

// Dieselbe Liste als CSV-Datei: dieselben Filter, aber alle passenden Geräte auf einmal (keine Seiten)
router.get('/geraete.csv', async (req, res) => {
  const { where, werte } = filterBedingungen(filterLesen(req.query));
  const geraete = await db.alle(
    `SELECT g.*, r.nummer AS raumnummer, r.bezeichnung AS raumbezeichnung, l.name AS lieferant
     FROM geraete g
     JOIN raeume r ON r.id = g.raum_id
     LEFT JOIN lieferanten l ON l.id = g.lieferant_id
     ${where}
     ORDER BY g.inventarnummer`,
    werte,
  );
  const heute = new Date().toISOString().slice(0, 10);
  csvSenden(res, `geraete-${heute}.csv`, CSV_SPALTEN, geraete);
});

router.get('/geraete/neu', nurMitRecht('geraete_anlegen'), async (req, res) => {
  res.render('geraete/formular', {
    geraet: {},
    fehler: {},
    aenderbar: aenderbareFelder(req.benutzer, null),
    ...(await auswahllisten()),
  });
});

router.post('/geraete/neu', nurMitRecht('geraete_anlegen'), async (req, res) => {
  const { geraet, fehler } = await geraetAusFormular(req.body);
  if (hatFehler(fehler)) {
    return res.status(400).render('geraete/formular', {
      geraet,
      fehler,
      aenderbar: aenderbareFelder(req.benutzer, null),
      ...(await auswahllisten()),
    });
  }

  // Gerät speichern und ins Änderungsprotokoll schreiben: beides oder nichts
  const neuesGeraet = await db.transaktion(async (t) => {
    const gespeichert = await t.eine(
      `INSERT INTO geraete (inventarnummer, bezeichnung, typ, seriennummer, raum_id, anschaffungsdatum,
                            kaufdatum, inbetriebnahme, garantie_bis, lieferant_id, anmerkungen, herkunft)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manuell')
       RETURNING id`,
      [
        geraet.inventarnummer,
        geraet.bezeichnung,
        geraet.typ,
        geraet.seriennummer,
        geraet.raum_id,
        geraet.anschaffungsdatum,
        geraet.kaufdatum,
        geraet.inbetriebnahme,
        geraet.garantie_bis,
        await lieferantId(t, geraet.lieferant),
        geraet.anmerkungen,
      ],
    );
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'geraet',
      eintragId: gespeichert.id,
      aktion: 'angelegt',
      nachher: fuersProtokoll(geraet),
    });
    return gespeichert;
  });
  req.session.meldung = `Gerät ${geraet.inventarnummer} wurde angelegt.`;
  res.redirect(`/geraete/${neuesGeraet.id}`);
});

router.get('/geraete/:id', async (req, res) => {
  const geraet = await geraetLaden(nummer(req.params.id));
  if (!geraet) return nichtGefunden(res, 'Gerät');

  const belege = await db.alle(
    `SELECT b.id, b.art, b.dateiname, b.belegdatum, b.dateityp, b.groesse_bytes
     FROM geraet_belege gb JOIN belege b ON b.id = gb.beleg_id
     WHERE gb.geraet_id = $1 ORDER BY b.belegdatum DESC NULLS LAST, b.hochgeladen_am DESC`,
    [geraet.id],
  );
  const raumwechsel = await db.alle(
    `SELECT w.zeitpunkt, w.von_raumnummer, w.nach_raumnummer, w.anlass, b.name AS benutzer
     FROM raumwechsel w LEFT JOIN benutzer b ON b.id = w.benutzer_id
     WHERE w.geraet_id = $1 ORDER BY w.zeitpunkt DESC`,
    [geraet.id],
  );
  const protokoll = await db.alle(
    `SELECT p.zeitpunkt, p.aktion, p.aenderungen, b.name AS benutzer
     FROM protokoll p LEFT JOIN benutzer b ON b.id = p.benutzer_id
     WHERE p.bereich = 'geraet' AND p.eintrag_id = $1 ORDER BY p.zeitpunkt DESC LIMIT 100`,
    [String(geraet.id)],
  );
  res.render('geraete/detail', { geraet, belege, raumwechsel, protokoll });
});

router.get('/geraete/:id/bearbeiten', nurMitRecht('geraete_bearbeiten'), async (req, res) => {
  const geraet = await geraetLaden(nummer(req.params.id));
  if (!geraet) return nichtGefunden(res, 'Gerät');
  res.render('geraete/formular', {
    geraet,
    fehler: {},
    aenderbar: aenderbareFelder(req.benutzer, geraet),
    ...(await auswahllisten()),
  });
});

router.post('/geraete/:id/bearbeiten', nurMitRecht('geraete_bearbeiten'), async (req, res) => {
  const vorher = await geraetLaden(nummer(req.params.id));
  if (!vorher) return nichtGefunden(res, 'Gerät');

  // Nur die Felder aus dem Formular übernehmen, die dieser Benutzer ändern darf.
  // Alle anderen bleiben so, wie sie vorher waren.
  const aenderbar = aenderbareFelder(req.benutzer, vorher);
  const formular = { ...vorher };
  for (const feld of aenderbar) formular[feld] = req.body[feld];

  const { geraet, fehler } = await geraetAusFormular(formular, vorher.id);
  if (hatFehler(fehler)) {
    return res.status(400).render('geraete/formular', {
      geraet: { ...geraet, id: vorher.id, herkunft: vorher.herkunft },
      fehler,
      aenderbar,
      ...(await auswahllisten()),
    });
  }

  await db.transaktion(async (t) => {
    await t.ausfuehren(
      `UPDATE geraete SET inventarnummer = $1, bezeichnung = $2, typ = $3, seriennummer = $4, raum_id = $5,
              anschaffungsdatum = $6, kaufdatum = $7, inbetriebnahme = $8, garantie_bis = $9, lieferant_id = $10,
              anmerkungen = $11
       WHERE id = $12`,
      [
        geraet.inventarnummer,
        geraet.bezeichnung,
        geraet.typ,
        geraet.seriennummer,
        geraet.raum_id,
        geraet.anschaffungsdatum,
        geraet.kaufdatum,
        geraet.inbetriebnahme,
        geraet.garantie_bis,
        await lieferantId(t, geraet.lieferant),
        geraet.anmerkungen,
        vorher.id,
      ],
    );

    // Raumwechsel mit Datum speichern (Pflichtenheft Kap. 4 Raumverwaltung)
    if (geraet.raum_id !== vorher.raum_id) {
      await t.ausfuehren(
        `INSERT INTO raumwechsel (geraet_id, von_raum_id, von_raumnummer, nach_raum_id, nach_raumnummer, anlass, benutzer_id)
         VALUES ($1, $2, $3, $4, $5, 'manuell', $6)`,
        [vorher.id, vorher.raum_id, vorher.raumnummer, geraet.raum_id, geraet.raumnummer, req.benutzer.id],
      );
    }

    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'geraet',
      eintragId: vorher.id,
      aktion: 'geaendert',
      vorher: fuersProtokoll(vorher),
      nachher: fuersProtokoll(geraet),
    });
  });
  req.session.meldung = 'Die Änderungen wurden gespeichert.';
  res.redirect(`/geraete/${vorher.id}`);
});

export default router;
