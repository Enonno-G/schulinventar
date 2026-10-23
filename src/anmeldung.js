// Rollen, Rechte und die Prüfung „ist jemand angemeldet / darf er das?“
// Pflichtenheft Kap. 3 (Zielgruppen) und Kap. 4 (Benutzerverwaltung und Anmeldung).
// Geprüft wird immer hier am Server. Dass die Seiten Knöpfe ausblenden, ist nur zusätzlich.
import { db } from './datenbank.js';

export const ROLLEN = {
  admin: 'Administrator',
  rechnungswesen: 'Sekretariat und Rechnungswesen',
  facility: 'Facility-Management',
  lesen: 'Lesezugriff',
};

// Ansehen dürfen alle angemeldeten Benutzer. Hier steht, wer etwas ÄNDERN darf.
export const RECHTE = {
  benutzer_verwalten: ['admin'],
  raeume_bearbeiten: ['admin', 'facility'],
  geraete_anlegen: ['admin', 'rechnungswesen'],
  geraete_bearbeiten: ['admin', 'rechnungswesen', 'facility'],
  belege_hochladen: ['admin', 'rechnungswesen'],
  sap_import_export: ['admin', 'rechnungswesen'],
  inventur: ['admin', 'facility'],
};

// Welche Gerätefelder eine Rolle ändern darf. Facility-Management weist Geräte Räumen zu und
// vermerkt Schäden, die Kaufdaten pflegt das Rechnungswesen.
const ALLE_GERAETEFELDER = [
  'inventarnummer',
  'bezeichnung',
  'typ',
  'seriennummer',
  'raum_id',
  'anschaffungsdatum',
  'kaufdatum',
  'inbetriebnahme',
  'garantie_bis',
  'anmerkungen',
];
export const GERAETEFELDER_JE_ROLLE = {
  admin: ALLE_GERAETEFELDER,
  rechnungswesen: ALLE_GERAETEFELDER,
  facility: ['raum_id', 'anmerkungen'],
  lesen: [],
};

export function darf(benutzer, recht) {
  if (!benutzer) return false;
  return RECHTE[recht].includes(benutzer.rolle);
}

// Läuft bei jeder Anfrage: Wer ist angemeldet? Danach steht der Benutzer in req.benutzer
// (oder null) und die Seiten-Vorlagen können `benutzer` und `darf('…')` verwenden.
export async function benutzerLaden(req, res, next) {
  req.benutzer = null;
  if (req.session.benutzerId) {
    // Bei jeder Anfrage neu aus der Datenbank: Eine geänderte Rolle oder ein deaktiviertes Konto wirkt sofort
    const benutzer = await db.eine('SELECT id, name, email, rolle FROM benutzer WHERE id = $1 AND aktiv', [
      req.session.benutzerId,
    ]);
    if (benutzer) req.benutzer = benutzer;
  }
  res.locals.benutzer = req.benutzer;
  res.locals.darf = (recht) => darf(req.benutzer, recht);
  res.locals.ROLLEN = ROLLEN;
  next();
}

// Nicht angemeldet? Dann zur Anmeldeseite und danach zurück zur gewünschten Seite.
export function nurAngemeldet(req, res, next) {
  if (req.benutzer) return next();
  res.redirect('/anmelden?weiter=' + encodeURIComponent(req.originalUrl));
}

// Verwendung in einer Route: router.get('/raeume/neu', nurMitRecht('raeume_bearbeiten'), …)
export function nurMitRecht(recht) {
  return (req, res, next) => {
    if (darf(req.benutzer, recht)) return next();
    res.status(403).render('fehler', { titel: 'Kein Zugriff', text: 'Dafür fehlt Ihnen die Berechtigung.' });
  };
}
