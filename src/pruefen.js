// Hilfsfunktionen, um Eingaben aus Formularen und aus der Adresse zu prüfen.

// Text aus einem Formularfeld: Leerzeichen am Rand entfernen, leeres Feld = null (kein Wert)
export function text(wert) {
  const ohneLeerzeichen = String(wert ?? '').trim();
  if (ohneLeerzeichen === '') return null;
  return ohneLeerzeichen;
}

// Eine Nummer aus der Adresse, z. B. die 5 in /raeume/5. Keine gültige Nummer -> null
export function nummer(wert) {
  const zahl = Number(wert);
  if (Number.isInteger(zahl) && zahl > 0) return zahl;
  return null;
}

// Prüft ein Datum im Format JJJJ-MM-TT (so liefert es ein Datumsfeld im Browser)
export function istDatum(wert) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(wert))) return false;
  const datum = new Date(wert + 'T00:00:00Z');
  if (Number.isNaN(datum.getTime())) return false; // z. B. Monat 13
  return datum.toISOString().slice(0, 10) === wert; // fängt z. B. den 31.02. ab
}

// Hat das Formular Fehler? (fehler ist z. B. { nummer: 'Bitte eine Raumnummer eingeben' })
export function hatFehler(fehler) {
  return Object.keys(fehler).length > 0;
}
