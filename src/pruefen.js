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

// Ein Datum aus einer SAP-Liste in das Format JJJJ-MM-TT bringen. Erlaubt sind z. B.
// '15.03.2021', '5.3.2021', '2021-03-15' und '20210315' (so speichert SAP intern ein Datum).
// Ergebnis: das Datum, null (Feld leer) oder false (kein gültiges Datum)
export function datumLesen(wert) {
  const eingabe = text(wert);
  if (!eingabe) return null;
  let iso = eingabe;
  const deutsch = eingabe.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const sap = eingabe.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (deutsch) iso = `${deutsch[3]}-${deutsch[2].padStart(2, '0')}-${deutsch[1].padStart(2, '0')}`;
  if (sap) iso = `${sap[1]}-${sap[2]}-${sap[3]}`;
  if (!istDatum(iso)) return false;
  return iso;
}

// Mehrere Inventarnummern aus einem Textfeld, getrennt durch Zeilenumbruch, Komma oder Strichpunkt.
// Ein Strichcode-Handscanner „tippt“ die Nummer und drückt danach Enter, so steht jede Nummer in einer eigenen Zeile.
//   '1001\n1002, 1003\n1001' -> ['1001', '1002', '1003'] (doppelte nur einmal)
export function inventarnummernAusText(wert) {
  const nummern = String(wert ?? '')
    .split(/[\r\n,;]+/)
    .map((teil) => teil.trim())
    .filter((teil) => teil !== '');
  return [...new Set(nummern)];
}

// Hat das Formular Fehler? (fehler ist z. B. { nummer: 'Bitte eine Raumnummer eingeben' })
export function hatFehler(fehler) {
  return Object.keys(fehler).length > 0;
}
