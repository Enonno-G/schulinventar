// Anmelden, Abmelden und Passwort ändern – Pflichtenheft Kap. 4 „Benutzerverwaltung und Anmeldung“
//
//   GET  /anmelden    Anmeldeseite          POST /anmelden    Anmeldung prüfen
//   POST /abmelden    abmelden
//   GET  /passwort    eigenes Passwort      POST /passwort    neues Passwort speichern
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { nurAngemeldet } from '../anmeldung.js';
import { db } from '../datenbank.js';
import { passwortHashen, passwortPruefen } from '../passwort.js';
import { protokollieren } from '../protokoll.js';
import { hatFehler } from '../pruefen.js';

const router = Router();

// Schutz gegen das Durchprobieren von Passwörtern: höchstens 10 Fehlversuche in 15 Minuten
const zuVieleVersuche = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).render('anmelden', {
      email: req.body.email ?? '',
      weiter: '/',
      hinweis: '',
      fehler: 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.',
    });
  },
});

// Nach der Anmeldung zurück zur Seite, die man aufrufen wollte – aber nur innerhalb dieser App
function sicheresZiel(ziel) {
  if (typeof ziel !== 'string') return '/';
  if (!ziel.startsWith('/') || ziel.startsWith('//') || ziel.startsWith('/\\')) return '/';
  return ziel;
}

router.get('/anmelden', (req, res) => {
  if (req.benutzer) return res.redirect('/');
  res.render('anmelden', {
    email: '',
    fehler: '',
    weiter: sicheresZiel(req.query.weiter),
    hinweis: req.query.abgelaufen ? 'Sie wurden nach längerer Inaktivität automatisch abgemeldet.' : '',
  });
});

// Vergleichswert: Auch bei einer unbekannten E-Mail-Adresse dauert die Prüfung gleich lang,
// so kann niemand an der Antwortzeit erkennen, welche Adressen es gibt.
const vergleichsHash = passwortHashen('kein-echtes-passwort');

router.post('/anmelden', zuVieleVersuche, async (req, res) => {
  const email = String(req.body.email ?? '').trim();
  const passwort = String(req.body.passwort ?? '');
  const weiter = sicheresZiel(req.body.weiter);

  const benutzer = await db.eine('SELECT id, passwort_hash FROM benutzer WHERE lower(email) = lower($1) AND aktiv', [
    email,
  ]);
  const gespeicherterHash = benutzer ? benutzer.passwort_hash : await vergleichsHash;
  const passwortRichtig = await passwortPruefen(passwort, gespeicherterHash);

  if (!benutzer || !passwortRichtig) {
    return res.status(401).render('anmelden', {
      email,
      weiter,
      hinweis: '',
      fehler: 'E-Mail-Adresse oder Passwort ist falsch.',
    });
  }

  // Neue Sitzung beginnen (Schutz gegen das Übernehmen fremder Sitzungen) und Benutzer merken
  await new Promise((fertig, abbrechen) => {
    req.session.regenerate((fehler) => (fehler ? abbrechen(fehler) : fertig()));
  });
  req.session.benutzerId = benutzer.id;
  await db.ausfuehren('UPDATE benutzer SET letzte_anmeldung = now() WHERE id = $1', [benutzer.id]);
  res.redirect(weiter);
});

router.post('/abmelden', (req, res, next) => {
  req.session.destroy((fehler) => {
    if (fehler) return next(fehler);
    res.clearCookie('sid');
    res.redirect('/anmelden');
  });
});

router.get('/passwort', nurAngemeldet, (req, res) => {
  res.render('passwort', { fehler: {}, geaendert: false });
});

router.post('/passwort', nurAngemeldet, async (req, res) => {
  const aktuell = String(req.body.aktuell ?? '');
  const neu = String(req.body.neu ?? '');
  const wiederholung = String(req.body.wiederholung ?? '');

  const fehler = {};
  const gespeichert = await db.eine('SELECT passwort_hash FROM benutzer WHERE id = $1', [req.benutzer.id]);
  if (!(await passwortPruefen(aktuell, gespeichert.passwort_hash))) fehler.aktuell = 'Das aktuelle Passwort ist falsch';
  if (neu.length < 10) fehler.neu = 'Das neue Passwort muss mindestens 10 Zeichen lang sein';
  if (neu !== wiederholung) fehler.wiederholung = 'Die beiden Passwörter stimmen nicht überein';
  if (hatFehler(fehler)) return res.status(400).render('passwort', { fehler, geaendert: false });

  await db.ausfuehren('UPDATE benutzer SET passwort_hash = $1 WHERE id = $2', [
    await passwortHashen(neu),
    req.benutzer.id,
  ]);
  await protokollieren(db, {
    benutzerId: req.benutzer.id,
    bereich: 'benutzer',
    eintragId: req.benutzer.id,
    aktion: 'passwort_geaendert',
  });
  res.render('passwort', { fehler: {}, geaendert: true });
});

export default router;
