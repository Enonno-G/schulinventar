// Benutzerverwaltung (nur Administrator) – Pflichtenheft Kap. 4 „Benutzerverwaltung und Anmeldung“
// Gespeichert werden nur Name, E-Mail-Adresse und Rolle (Pflichtenheft Kap. 5 Datenschutz).
//
//   GET  /benutzer                  Liste aller Benutzer
//   GET  /benutzer/neu              Formular „Neuer Benutzer“       POST /benutzer/neu              speichern
//   GET  /benutzer/:id/bearbeiten   Formular „Benutzer bearbeiten“  POST /benutzer/:id/bearbeiten   speichern
import { Router } from 'express';
import { nurMitRecht, ROLLEN } from '../anmeldung.js';
import { db } from '../datenbank.js';
import { nichtGefunden } from '../fehler.js';
import { passwortHashen } from '../passwort.js';
import { protokollieren } from '../protokoll.js';
import { hatFehler, nummer, text } from '../pruefen.js';

const router = Router();

// Diese Spalten werden angezeigt. Der Passwort-Hash ist absichtlich nicht dabei.
const SPALTEN = 'id, name, email, rolle, aktiv, letzte_anmeldung';

// Liest die Felder aus dem Formular und prüft sie. Bei einem neuen Benutzer ist das Passwort Pflicht.
async function benutzerAusFormular(formular, benutzerId = 0) {
  const benutzer = {
    name: text(formular.name),
    email: text(formular.email)?.toLowerCase() ?? null,
    rolle: formular.rolle,
    aktiv: formular.aktiv === 'ja', // Häkchen gesetzt?
  };
  const passwort = String(formular.passwort ?? '');

  const fehler = {};
  if (!benutzer.name) fehler.name = 'Bitte einen Namen eingeben';
  if (!benutzer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(benutzer.email)) {
    fehler.email = 'Bitte eine gültige E-Mail-Adresse eingeben';
  } else {
    const gleicheAdresse = await db.eine('SELECT id FROM benutzer WHERE lower(email) = $1 AND id <> $2', [
      benutzer.email,
      benutzerId,
    ]);
    if (gleicheAdresse) fehler.email = 'Diese E-Mail-Adresse ist schon vergeben';
  }
  if (!ROLLEN[benutzer.rolle]) fehler.rolle = 'Bitte eine Rolle auswählen';
  const passwortNoetig = benutzerId === 0;
  if ((passwortNoetig || passwort !== '') && passwort.length < 10) {
    fehler.passwort = 'Das Passwort muss mindestens 10 Zeichen lang sein';
  }
  return { benutzer, passwort, fehler };
}

router.use('/benutzer', nurMitRecht('benutzer_verwalten')); // gilt für alle Adressen unter /benutzer

router.get('/benutzer', async (req, res) => {
  const alleBenutzer = await db.alle(`SELECT ${SPALTEN} FROM benutzer ORDER BY aktiv DESC, name`);
  res.render('benutzer/liste', { alleBenutzer });
});

router.get('/benutzer/neu', (req, res) => {
  res.render('benutzer/formular', { konto: { rolle: 'lesen', aktiv: true }, fehler: {} });
});

router.post('/benutzer/neu', async (req, res) => {
  const { benutzer, passwort, fehler } = await benutzerAusFormular({ ...req.body, aktiv: 'ja' });
  if (hatFehler(fehler)) return res.status(400).render('benutzer/formular', { konto: benutzer, fehler });

  await db.transaktion(async (t) => {
    const neu = await t.eine(
      `INSERT INTO benutzer (name, email, rolle, passwort_hash) VALUES ($1, $2, $3, $4) RETURNING ${SPALTEN}`,
      [benutzer.name, benutzer.email, benutzer.rolle, await passwortHashen(passwort)],
    );
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'benutzer',
      eintragId: neu.id,
      aktion: 'angelegt',
      nachher: neu,
    });
  });
  req.session.meldung = `${benutzer.name} wurde angelegt.`;
  res.redirect('/benutzer');
});

router.get('/benutzer/:id/bearbeiten', async (req, res) => {
  const konto = await db.eine(`SELECT ${SPALTEN} FROM benutzer WHERE id = $1`, [nummer(req.params.id)]);
  if (!konto) return nichtGefunden(res, 'Benutzer');
  res.render('benutzer/formular', { konto, fehler: {} });
});

router.post('/benutzer/:id/bearbeiten', async (req, res) => {
  const vorher = await db.eine(`SELECT ${SPALTEN} FROM benutzer WHERE id = $1`, [nummer(req.params.id)]);
  if (!vorher) return nichtGefunden(res, 'Benutzer');

  const { benutzer, passwort, fehler } = await benutzerAusFormular(req.body, vorher.id);

  // Schutz vor dem Aussperren: Man kann sich nicht selbst deaktivieren oder die eigene Admin-Rolle
  // entfernen, und es muss immer mindestens ein aktiver Administrator übrig bleiben.
  const verliertAdmin = vorher.rolle === 'admin' && vorher.aktiv && (benutzer.rolle !== 'admin' || !benutzer.aktiv);
  if (verliertAdmin && vorher.id === req.benutzer.id) {
    fehler.rolle = 'Sie können sich nicht selbst deaktivieren oder Ihre Administratorrolle entfernen';
  } else if (verliertAdmin) {
    const andereAdmins = await db.eine(
      "SELECT count(*) AS anzahl FROM benutzer WHERE rolle = 'admin' AND aktiv AND id <> $1",
      [vorher.id],
    );
    if (andereAdmins.anzahl === 0) fehler.rolle = 'Es muss mindestens ein aktiver Administrator bleiben';
  }
  if (hatFehler(fehler)) {
    return res.status(400).render('benutzer/formular', { konto: { ...benutzer, id: vorher.id }, fehler });
  }

  await db.transaktion(async (t) => {
    const nachher = await t.eine(
      `UPDATE benutzer SET name = $1, email = $2, rolle = $3, aktiv = $4 WHERE id = $5 RETURNING ${SPALTEN}`,
      [benutzer.name, benutzer.email, benutzer.rolle, benutzer.aktiv, vorher.id],
    );
    // letzte_anmeldung ändert sich hier nicht, gehört aber nicht ins Protokoll
    delete vorher.letzte_anmeldung;
    delete nachher.letzte_anmeldung;
    await protokollieren(t, {
      benutzerId: req.benutzer.id,
      bereich: 'benutzer',
      eintragId: vorher.id,
      aktion: 'geaendert',
      vorher,
      nachher,
    });

    if (passwort !== '') {
      await t.ausfuehren('UPDATE benutzer SET passwort_hash = $1 WHERE id = $2', [
        await passwortHashen(passwort),
        vorher.id,
      ]);
      await protokollieren(t, {
        benutzerId: req.benutzer.id,
        bereich: 'benutzer',
        eintragId: vorher.id,
        aktion: 'passwort_zurueckgesetzt',
      });
    }
  });
  req.session.meldung = `${benutzer.name} wurde gespeichert.`;
  res.redirect('/benutzer');
});

export default router;
