// Die Web-App: Hier wird festgelegt, was bei jeder Anfrage passiert und welche Adresse wohin führt.
// Gestartet wird die App in start.js.
//
// Jede Anfrage läuft von oben nach unten durch die app.use(…)-Zeilen, bis eine davon antwortet.
import path from 'node:path';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { benutzerLaden, nurAngemeldet } from './anmeldung.js';
import { db, pool } from './datenbank.js';
import { einstellungen } from './einstellungen.js';
import { fehlerBehandeln, nichtGefunden } from './fehler.js';
import { BEZEICHNUNGEN, dateigroesse, datum, datumZeit, FELDNAMEN, raumName, wertAnzeigen } from './format.js';
import anmeldenSeiten from './seiten/anmelden.js';
import ausleihenSeiten from './seiten/ausleihen.js';
import belegeSeiten from './seiten/belege.js';
import benutzerSeiten from './seiten/benutzer.js';
import exportSeiten from './seiten/export.js';
import geraeteSeiten from './seiten/geraete.js';
import importSeiten from './seiten/import.js';
import inventurSeiten from './seiten/inventur.js';
import raeumeSeiten from './seiten/raeume.js';
import sollIstSeiten from './seiten/soll-ist.js';

const PROJEKTORDNER = path.join(import.meta.dirname, '..');

export function appErstellen() {
  const app = express();

  // Seiten-Vorlagen liegen im Ordner views/ und sind HTML mit Platzhaltern (EJS)
  app.set('view engine', 'ejs');
  app.set('views', path.join(PROJEKTORDNER, 'views'));
  if (einstellungen.hinterProxy) app.set('trust proxy', 1);

  // Werte und Hilfsfunktionen, die jede Seiten-Vorlage verwenden kann
  app.use((req, res, next) => {
    res.locals.datum = datum;
    res.locals.datumZeit = datumZeit;
    res.locals.dateigroesse = dateigroesse;
    res.locals.raumName = raumName;
    res.locals.wertAnzeigen = wertAnzeigen;
    res.locals.FELDNAMEN = FELDNAMEN;
    res.locals.BEZEICHNUNGEN = BEZEICHNUNGEN;
    res.locals.aktuelleAdresse = req.path;
    res.locals.abmeldenNachMinuten = einstellungen.abmeldenNachMinuten;
    // werden weiter unten gefüllt (benutzerLaden und Meldungen)
    res.locals.benutzer = null;
    res.locals.darf = () => false;
    res.locals.meldung = null;
    res.locals.warnung = null;
    next();
  });

  // Sicherheits-Header gegen typische Angriffe aus dem Internet (Pflichtenheft Kap. 5)
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: einstellungen.nurUeberHttps ? [] : null } },
    }),
  );

  // Dateien aus public/ (Aussehen, Logo, kleines Script) direkt ausliefern
  app.use(express.static(path.join(PROJEKTORDNER, 'public')));

  // Formulare lesen: Das Feld <input name="nummer"> steht danach in req.body.nummer
  app.use(express.urlencoded({ extended: false }));

  // Sitzung: merkt sich nach der Anmeldung, wer man ist (gespeichert in der Tabelle „sitzungen“).
  // rolling = jede Anfrage verlängert die Sitzung. Nach X Minuten ohne Aktivität ist man abgemeldet.
  const SitzungsSpeicher = connectPgSimple(session);
  const sitzungsSpeicher = new SitzungsSpeicher({ pool, tableName: 'sitzungen' });
  app.locals.sitzungsSpeicher = sitzungsSpeicher;
  app.use(
    session({
      name: 'sid',
      store: sitzungsSpeicher,
      secret: einstellungen.sitzungsSchluessel,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true, // JavaScript im Browser kommt nicht an das Cookie
        sameSite: 'lax', // fremde Webseiten können keine Formulare in unserem Namen abschicken
        secure: einstellungen.nurUeberHttps,
        maxAge: einstellungen.abmeldenNachMinuten * 60 * 1000,
      },
    }),
  );

  // Einmalige Meldung nach dem Speichern, z. B. „Raum E.01 wurde angelegt.“ (grün) oder eine Warnung (rot).
  // Sie wird vor der Weiterleitung in der Sitzung abgelegt und auf der nächsten Seite einmal angezeigt.
  app.use((req, res, next) => {
    if (!req.body) req.body = {}; // Anfragen ohne Formular
    res.locals.meldung = req.session.meldung;
    res.locals.warnung = req.session.warnung;
    delete req.session.meldung;
    delete req.session.warnung;
    next();
  });
  app.use(benutzerLaden);

  // Für den Docker-Healthcheck: Läuft die App und erreicht sie die Datenbank?
  app.get('/health', async (req, res) => {
    await db.eine('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use(anmeldenSeiten); // Anmelden geht natürlich ohne Anmeldung
  app.use(nurAngemeldet); // ab hier nur noch mit Anmeldung
  app.get('/', (req, res) => res.redirect('/geraete'));
  app.use(geraeteSeiten);
  app.use(raeumeSeiten);
  app.use(belegeSeiten);
  app.use(ausleihenSeiten);
  app.use(inventurSeiten);
  app.use(sollIstSeiten);
  app.use(importSeiten);
  app.use(exportSeiten);
  app.use(benutzerSeiten);

  // Keine Adresse hat gepasst
  app.use((req, res) => nichtGefunden(res));
  app.use(fehlerBehandeln);
  return app;
}
