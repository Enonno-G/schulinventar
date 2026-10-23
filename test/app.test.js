// Tests der ganzen App gegen eine echte Datenbank: Seiten aufrufen, Formulare abschicken, Ergebnis prüfen.
// Laufen nur, wenn TEST_DATABASE_URL in .env gesetzt ist (eigene Testdatenbank, siehe README).
// Nie auf die Datenbank mit echten Daten zeigen lassen!
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

const TEST_DATENBANK = process.env.TEST_DATABASE_URL;

describe('Schulinventar', { skip: !TEST_DATENBANK && 'TEST_DATABASE_URL ist nicht gesetzt' }, () => {
  const ROLLEN = ['admin', 'rechnungswesen', 'facility', 'lesen'];
  const passwort = randomBytes(12).toString('base64url');
  const kennung = randomBytes(3).toString('hex'); // eindeutige Namen, falls die Testdatenbank schon Daten hat
  const cookies = {}; // Anmelde-Cookie je Rolle
  // Hochgeladene Belege landen während der Tests in einem eigenen Ordner, der danach gelöscht wird
  const uploadOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'schulinventar-test-'));
  let server, adresse, db, pool, app;

  // Ruft eine Seite auf, wahlweise als angemeldete Rolle und mit Formulardaten.
  // Ein Formular mit Datei wird als FormData übergeben (siehe belegFormular).
  async function aufrufen(rolle, methode, pfad, formular) {
    const kopfzeilen = {};
    if (rolle) kopfzeilen.cookie = cookies[rolle];
    let inhalt;
    if (formular instanceof FormData) {
      inhalt = formular; // fetch setzt die passende Kopfzeile „multipart/form-data“ selbst
    } else if (formular) {
      kopfzeilen['content-type'] = 'application/x-www-form-urlencoded';
      inhalt = new URLSearchParams(formular);
    }
    const antwort = await fetch(adresse + pfad, {
      method: methode,
      headers: kopfzeilen,
      body: inhalt,
      redirect: 'manual', // Weiterleitungen nicht automatisch folgen, damit wir sie prüfen können
    });
    return {
      status: antwort.status,
      weiterleitung: antwort.headers.get('location'),
      html: await antwort.text(),
      antwort,
    };
  }

  // Formular „Beleg hochladen“ mit einer Datei aus den angegebenen Bytes
  function belegFormular(felder, dateiname, bytes) {
    const formular = new FormData();
    for (const [feld, wert] of Object.entries(felder)) formular.append(feld, wert);
    formular.append('datei', new Blob([bytes]), dateiname);
    return formular;
  }
  const PDF = Buffer.from('%PDF-1.4\n% Testrechnung\n%%EOF\n');
  const EXE = Buffer.from('MZ\x90\x00 Programm');

  before(async () => {
    process.env.DATABASE_URL = TEST_DATENBANK;
    process.env.UPLOAD_DIR = uploadOrdner;
    process.env.UPLOAD_MAX_MB = '1';
    const datenbank = await import('../src/datenbank.js');
    const { passwortHashen } = await import('../src/passwort.js');
    const { appErstellen } = await import('../src/app.js');
    db = datenbank.db;
    pool = datenbank.pool;

    await datenbank.datenbankAufbauen();
    const hash = await passwortHashen(passwort);
    for (const rolle of ROLLEN) {
      await db.ausfuehren('INSERT INTO benutzer (name, email, rolle, passwort_hash) VALUES ($1, $2, $3, $4)', [
        `Test ${rolle}`,
        `${rolle}-${kennung}@test.local`,
        rolle,
        hash,
      ]);
    }

    app = appErstellen();
    await new Promise((fertig) => {
      server = app.listen(0, '127.0.0.1', fertig);
    });
    adresse = `http://127.0.0.1:${server.address().port}`;

    for (const rolle of ROLLEN) {
      const { status, antwort } = await aufrufen(null, 'POST', '/anmelden', {
        email: `${rolle}-${kennung}@test.local`,
        passwort,
      });
      assert.equal(status, 302, `Anmeldung als ${rolle}`);
      cookies[rolle] = antwort.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
    }
  });

  after(async () => {
    await new Promise((fertig) => (server ? server.close(fertig) : fertig()));
    app?.locals.sitzungsSpeicher.close();
    await pool?.end();
    fs.rmSync(uploadOrdner, { recursive: true, force: true });
  });

  let raumA, raumB, geraetId;

  test('ohne Anmeldung geht es zur Anmeldeseite', async () => {
    const { status, weiterleitung } = await aufrufen(null, 'GET', '/geraete');
    assert.equal(status, 302);
    assert.equal(weiterleitung, '/anmelden?weiter=%2Fgeraete');
  });

  test('falsches Passwort wird mit verständlicher Meldung abgelehnt', async () => {
    const { status, html } = await aufrufen(null, 'POST', '/anmelden', {
      email: `admin-${kennung}@test.local`,
      passwort: 'falsches-passwort',
    });
    assert.equal(status, 401);
    assert.match(html, /E-Mail-Adresse oder Passwort ist falsch/);
  });

  test('Räume anlegen, doppelte Raumnummer wird abgelehnt', async () => {
    const a = await aufrufen('facility', 'POST', '/raeume/neu', { nummer: `A-${kennung}`, bezeichnung: 'EDV-Saal' });
    const b = await aufrufen('admin', 'POST', '/raeume/neu', { nummer: `B-${kennung}`, bezeichnung: '' });
    assert.equal(a.weiterleitung, '/raeume');
    assert.equal(b.weiterleitung, '/raeume');
    raumA = (await db.eine('SELECT id FROM raeume WHERE nummer = $1', [`A-${kennung}`])).id;
    raumB = (await db.eine('SELECT id, bezeichnung FROM raeume WHERE nummer = $1', [`B-${kennung}`])).id;

    const doppelt = await aufrufen('admin', 'POST', '/raeume/neu', { nummer: `A-${kennung}` });
    assert.equal(doppelt.status, 400);
    assert.match(doppelt.html, /Diese Raumnummer gibt es schon/);
  });

  test('Eingaben werden mit HTML-Zeichen sicher angezeigt (Schutz gegen eingeschleuste Skripte)', async () => {
    await aufrufen('admin', 'POST', `/raeume/${raumB}/bearbeiten`, {
      nummer: `B-${kennung}`,
      bezeichnung: '<script>alert(1)</script>',
    });
    const { html } = await aufrufen('lesen', 'GET', '/raeume');
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  test('Pflichtfelder beim Gerät werden geprüft', async () => {
    const { status, html } = await aufrufen('rechnungswesen', 'POST', '/geraete/neu', {
      inventarnummer: '',
      bezeichnung: '',
      raum_id: '',
    });
    assert.equal(status, 400);
    assert.match(html, /Bitte die Inventarnummer eingeben/);
    assert.match(html, /Bitte eine Bezeichnung eingeben/);
    assert.match(html, /Bitte einen Raum auswählen/);
  });

  test('T4: Gerät anlegen und über Inventarnummer oder Seriennummer finden', async () => {
    const angelegt = await aufrufen('rechnungswesen', 'POST', '/geraete/neu', {
      inventarnummer: `INV-${kennung}`,
      bezeichnung: 'Beamer Deckenmontage',
      typ: 'Beamer',
      seriennummer: `SN-${kennung}`,
      raum_id: String(raumA),
      kaufdatum: '2026-09-01',
      garantie_bis: '2029-09-01',
      lieferant: `Lieferant ${kennung}`,
    });
    assert.equal(angelegt.status, 302);
    geraetId = Number(angelegt.weiterleitung.split('/').pop());
    const lieferant = await db.eine(
      'SELECT l.name FROM geraete g JOIN lieferanten l ON l.id = g.lieferant_id WHERE g.id = $1',
      [geraetId],
    );
    assert.equal(lieferant.name, `Lieferant ${kennung}`, 'neuer Lieferant wird automatisch angelegt');

    const gefunden = await aufrufen('lesen', 'GET', `/geraete?suche=INV-${kennung}`);
    assert.match(gefunden.html, /1 Gerät gefunden/);
    assert.ok(gefunden.html.includes(`A-${kennung} – EDV-Saal`));

    const perSeriennummer = await aufrufen('lesen', 'GET', `/geraete?suche=sn-${kennung}`);
    assert.match(perSeriennummer.html, /1 Gerät gefunden/);

    const doppelt = await aufrufen('rechnungswesen', 'POST', '/geraete/neu', {
      inventarnummer: `INV-${kennung}`,
      bezeichnung: 'Noch ein Beamer',
      raum_id: String(raumA),
    });
    assert.match(doppelt.html, /Diese Inventarnummer gibt es schon/);
  });

  test('Garantie bis darf nicht vor dem Kaufdatum liegen, ungültige Daten werden abgelehnt', async () => {
    const { status, html } = await aufrufen('rechnungswesen', 'POST', '/geraete/neu', {
      inventarnummer: `X-${kennung}`,
      bezeichnung: 'Test',
      raum_id: String(raumA),
      kaufdatum: '2026-09-01',
      garantie_bis: '2025-01-01',
      anschaffungsdatum: '2026-02-31',
    });
    assert.equal(status, 400);
    assert.match(html, /Darf nicht vor dem Kaufdatum liegen/);
    assert.match(html, /Ungültiges Datum/);
  });

  test('T7: Lesezugriff kann nichts ändern oder löschen', async () => {
    assert.equal((await aufrufen('lesen', 'GET', '/raeume/neu')).status, 403);
    assert.equal((await aufrufen('lesen', 'POST', '/raeume/neu', { nummer: `X-${kennung}` })).status, 403);
    assert.equal((await aufrufen('lesen', 'POST', `/raeume/${raumB}/loeschen`)).status, 403);
    assert.equal((await aufrufen('lesen', 'GET', `/geraete/${geraetId}/bearbeiten`)).status, 403);
    assert.equal(
      (await aufrufen('lesen', 'POST', `/geraete/${geraetId}/bearbeiten`, { anmerkungen: 'x' })).status,
      403,
    );
    assert.equal((await aufrufen('lesen', 'GET', '/benutzer')).status, 403);
    assert.ok(await db.eine('SELECT id FROM raeume WHERE id = $1', [raumB]), 'Raum muss noch da sein');
  });

  test('Facility-Management ändert Raum und Anmerkung, Raumwechsel wird mit Datum gespeichert', async () => {
    const { weiterleitung } = await aufrufen('facility', 'POST', `/geraete/${geraetId}/bearbeiten`, {
      raum_id: String(raumB),
      anmerkungen: 'Lampe flackert',
      bezeichnung: 'Darf Facility nicht ändern', // wird vom Server ignoriert
    });
    assert.equal(weiterleitung, `/geraete/${geraetId}`);

    const geraet = await db.eine('SELECT raum_id, bezeichnung, anmerkungen FROM geraete WHERE id = $1', [geraetId]);
    assert.equal(geraet.raum_id, raumB);
    assert.equal(geraet.bezeichnung, 'Beamer Deckenmontage');
    assert.equal(geraet.anmerkungen, 'Lampe flackert');

    const wechsel = await db.alle(
      'SELECT von_raumnummer, nach_raumnummer, zeitpunkt FROM raumwechsel WHERE geraet_id = $1',
      [geraetId],
    );
    assert.equal(wechsel.length, 1);
    assert.equal(wechsel[0].von_raumnummer, `A-${kennung}`);
    assert.equal(wechsel[0].nach_raumnummer, `B-${kennung}`);

    const detail = await aufrufen('lesen', 'GET', `/geraete/${geraetId}`);
    assert.match(detail.html, /Test facility/);
    assert.match(detail.html, /Lampe flackert/);
  });

  let zweitesGeraetId, belegId;

  test('T3: Rechnung hochladen und mehreren Geräten zuordnen', async () => {
    const zweites = await aufrufen('rechnungswesen', 'POST', '/geraete/neu', {
      inventarnummer: `INV2-${kennung}`,
      bezeichnung: 'Beamer Deckenmontage',
      raum_id: String(raumB),
    });
    zweitesGeraetId = Number(zweites.weiterleitung.split('/').pop());

    const formular = belegFormular(
      { art: 'rechnung', belegdatum: '2026-09-01', inventarnummern: `INV-${kennung}\nINV2-${kennung}` },
      `Rechnung März ${kennung}.pdf`,
      PDF,
    );
    const hochgeladen = await aufrufen('rechnungswesen', 'POST', '/belege/neu', formular);
    assert.equal(hochgeladen.status, 302);
    assert.match(hochgeladen.weiterleitung, /^\/belege\/\d+$/);
    belegId = Number(hochgeladen.weiterleitung.split('/').pop());

    // Bei beiden Geräten ist die Rechnung zu sehen, mit Umlaut im Dateinamen
    for (const id of [geraetId, zweitesGeraetId]) {
      const detail = await aufrufen('lesen', 'GET', `/geraete/${id}`);
      assert.ok(detail.html.includes(`Rechnung März ${kennung}.pdf`), `Rechnung bei Gerät ${id}`);
      assert.ok(detail.html.includes(`/belege/${belegId}/datei`));
    }

    // Die Datei kommt unverändert zurück
    const datei = await aufrufen('lesen', 'GET', `/belege/${belegId}/datei`);
    assert.equal(datei.status, 200);
    assert.equal(datei.antwort.headers.get('content-type'), 'application/pdf');
    assert.equal(datei.html, PDF.toString());

    const beleg = await db.eine('SELECT aufbewahren_bis, pruefsumme FROM belege WHERE id = $1', [belegId]);
    assert.equal(beleg.aufbewahren_bis, '2033-12-31', '7 Jahre ab Ende des Belegjahres');
    assert.equal(beleg.pruefsumme.length, 64);
  });

  test('T8: unzulässige Dateien werden mit verständlicher Meldung abgelehnt', async () => {
    const vorher = await db.eine('SELECT count(*) AS anzahl FROM belege');
    const felder = { art: 'rechnung', inventarnummern: `INV-${kennung}` };

    for (const dateiname of ['programm.exe', 'daten.json', 'angriff.script']) {
      const { status, html } = await aufrufen(
        'rechnungswesen',
        'POST',
        '/belege/neu',
        belegFormular(felder, dateiname, EXE),
      );
      assert.equal(status, 400, dateiname);
      assert.match(html, /Nur PDF-, JPG- und PNG-Dateien sind erlaubt/);
    }

    // Umbenannte .exe-Datei: Endung passt, Inhalt nicht
    const getarnt = await aufrufen('rechnungswesen', 'POST', '/belege/neu', belegFormular(felder, 'rechnung.pdf', EXE));
    assert.equal(getarnt.status, 400);
    assert.match(getarnt.html, /ist aber keine echte PDF-Datei/);

    // Zu groß (in den Tests ist die Grenze 1 MB)
    const gross = Buffer.concat([PDF, Buffer.alloc(1024 * 1024)]);
    const zuGross = await aufrufen('rechnungswesen', 'POST', '/belege/neu', belegFormular(felder, 'gross.pdf', gross));
    assert.equal(zuGross.status, 400);
    assert.match(zuGross.html, /Die Datei ist zu groß/);

    const nachher = await db.eine('SELECT count(*) AS anzahl FROM belege');
    assert.equal(nachher.anzahl, vorher.anzahl, 'nichts gespeichert');
  });

  test('unbekannte Inventarnummer beim Beleg wird gemeldet', async () => {
    const formular = belegFormular({ art: 'lieferschein', inventarnummern: `GIBTSNICHT-${kennung}` }, 'ls.pdf', PDF);
    const { status, html } = await aufrufen('rechnungswesen', 'POST', '/belege/neu', formular);
    assert.equal(status, 400);
    assert.match(html, new RegExp(`Diese Inventarnummern gibt es nicht: GIBTSNICHT-${kennung}`));
  });

  test('Zuordnung entfernen: Beleg bleibt gespeichert und kann nicht gelöscht werden', async () => {
    const { weiterleitung } = await aufrufen('rechnungswesen', 'POST', `/belege/${belegId}/entfernen`, {
      geraet_id: String(zweitesGeraetId),
    });
    assert.equal(weiterleitung, `/belege/${belegId}`);
    const detail = await aufrufen('lesen', 'GET', `/geraete/${zweitesGeraetId}`);
    assert.ok(!detail.html.includes(`/belege/${belegId}/datei`));
    assert.match(detail.html, /Beleg-Zuordnung entfernt/, 'steht im Änderungsprotokoll des Geräts');

    await assert.rejects(db.ausfuehren('DELETE FROM belege WHERE id = $1', [belegId]), /aufzubewahren/);
  });

  test('Lesezugriff und Facility-Management dürfen keine Belege hochladen', async () => {
    for (const rolle of ['lesen', 'facility']) {
      assert.equal((await aufrufen(rolle, 'GET', '/belege/neu')).status, 403);
      const formular = belegFormular({ art: 'rechnung', inventarnummern: `INV-${kennung}` }, 'r.pdf', PDF);
      assert.equal((await aufrufen(rolle, 'POST', '/belege/neu', formular)).status, 403);
    }
    // Ansehen dürfen alle
    assert.equal((await aufrufen('lesen', 'GET', `/belege/${belegId}`)).status, 200);
  });

  test('Geräteliste als CSV-Datei für Excel, mit denselben Filtern', async () => {
    const { status, html, antwort } = await aufrufen('lesen', 'GET', `/geraete.csv?suche=INV-${kennung}`);
    assert.equal(status, 200);
    assert.match(antwort.headers.get('content-type'), /^text\/csv/);
    assert.match(antwort.headers.get('content-disposition'), /^attachment; filename="?geraete-[\d-]+\.csv"?$/);
    const zeilen = html.replace('﻿', '').trim().split('\r\n');
    assert.match(zeilen[0], /^Inventarnummer;Bezeichnung;Gerätetyp;/);
    assert.equal(zeilen.length, 2, 'Kopfzeile und genau ein Gerät');
    assert.match(zeilen[1], new RegExp(`^INV-${kennung};Beamer Deckenmontage;Beamer;`));
    assert.match(zeilen[1], /01\.09\.2029/, 'Datum auf Deutsch');

    const raeume = await aufrufen('lesen', 'GET', '/raeume.csv');
    assert.ok(raeume.html.includes(`B-${kennung};`));
  });

  test('Raum mit Geräten kann nicht gelöscht werden, leerer Raum schon', async () => {
    // raumA ist leer: Das erste Gerät wurde nach raumB gebracht, das zweite steht von Anfang an dort
    const blockiert = await aufrufen('admin', 'POST', `/raeume/${raumB}/loeschen`);
    assert.equal(blockiert.weiterleitung, '/raeume');
    assert.ok(await db.eine('SELECT id FROM raeume WHERE id = $1', [raumB]), 'Raum mit Gerät bleibt');

    await aufrufen('admin', 'POST', `/raeume/${raumA}/loeschen`);
    assert.equal(await db.eine('SELECT id FROM raeume WHERE id = $1', [raumA]), undefined, 'leerer Raum ist weg');
  });

  test('Änderungsprotokoll lässt sich nicht verändern', async () => {
    await assert.rejects(db.ausfuehren('DELETE FROM protokoll'), /kann nicht verändert werden/);
  });

  test('Administrator kann sich nicht selbst deaktivieren', async () => {
    const admin = await db.eine('SELECT id FROM benutzer WHERE email = $1', [`admin-${kennung}@test.local`]);
    const { status } = await aufrufen('admin', 'POST', `/benutzer/${admin.id}/bearbeiten`, {
      name: 'Test admin',
      email: `admin-${kennung}@test.local`,
      rolle: 'admin',
      // ohne aktiv=ja → würde deaktivieren
    });
    assert.equal(status, 400);
  });

  test('deaktiviertes Konto ist sofort abgemeldet', async () => {
    const konto = await db.eine('SELECT id FROM benutzer WHERE email = $1', [`lesen-${kennung}@test.local`]);
    await aufrufen('admin', 'POST', `/benutzer/${konto.id}/bearbeiten`, {
      name: 'Test lesen',
      email: `lesen-${kennung}@test.local`,
      rolle: 'lesen',
    });
    const { status, weiterleitung } = await aufrufen('lesen', 'GET', '/geraete');
    assert.equal(status, 302);
    assert.match(weiterleitung, /^\/anmelden/);
  });

  test('Abmelden beendet die Sitzung', async () => {
    await aufrufen('facility', 'POST', '/abmelden');
    const { weiterleitung } = await aufrufen('facility', 'GET', '/geraete');
    assert.match(weiterleitung, /^\/anmelden/);
  });

  test('geplante Bereiche zeigen, wann sie kommen', async () => {
    const { status, html } = await aufrufen('admin', 'GET', '/import');
    assert.equal(status, 200);
    assert.match(html, /geplant für Sprint 3/);
  });
});
