// CSV-Dateien schreiben (Export) und lesen (SAP-Import) – Pflichtenheft Kap. 4.
//
// CSV ist eine Textdatei, in der jede Zeile eine Tabellenzeile ist und die Spalten durch ein Zeichen getrennt
// sind. Damit Excel die Datei mit einem Doppelklick richtig öffnet (österreichische Einstellungen), gilt:
//   - Strichpunkt ; als Trennzeichen (das Komma braucht Excel für Dezimalzahlen)
//   - ein unsichtbares Zeichen ganz am Anfang (BOM), damit Excel Umlaute richtig erkennt
//   - Datum als TT.MM.JJJJ
import { datum } from './format.js';

// Ein Wert für eine Zelle. Enthält er das Trennzeichen, " oder einen Zeilenumbruch, kommt er in Anführungszeichen.
function zelle(wert, trennzeichen, formelSchutz) {
  if (wert === null || wert === undefined) return '';
  let text = String(wert);
  // Schutz gegen „Formel-Einschleusung“: Ein Wert wie =HYPERLINK(…) würde Excel sonst als Formel ausführen
  if (formelSchutz && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (text.includes(trennzeichen) || /["\r\n]/.test(text)) text = '"' + text.replaceAll('"', '""') + '"';
  return text;
}

// spalten: [{ titel: 'Inventarnummer', feld: 'inventarnummer' }, { titel: 'Garantie bis', feld: 'garantie_bis', datum: true }]
// zeilen:  die Zeilen aus der Datenbank
// optionen (nur für den Export an SAP nötig): anderes Trennzeichen, anderes Datumsformat, ohne Formel-Schutz
export function csvErstellen(spalten, zeilen, optionen = {}) {
  const { trennzeichen = ';', datumFormatieren = datum, formelSchutz = true } = optionen;
  const kopfzeile = spalten.map((spalte) => zelle(spalte.titel, trennzeichen, formelSchutz)).join(trennzeichen);
  const datenzeilen = zeilen.map((zeile) =>
    spalten
      .map((spalte) => {
        const wert = zeile[spalte.feld];
        if (spalte.datum) return wert ? datumFormatieren(wert) : '';
        return zelle(wert, trennzeichen, formelSchutz);
      })
      .join(trennzeichen),
  );
  return '\uFEFF' + [kopfzeile, ...datenzeilen].join('\r\n') + '\r\n';
}

// Schickt die CSV-Datei an den Browser, der sie dann herunterlädt
export function csvSenden(res, dateiname, spalten, zeilen, optionen) {
  res.attachment(dateiname); // „Datei herunterladen“ statt im Browser anzeigen
  res.type('text/csv; charset=utf-8');
  res.send(csvErstellen(spalten, zeilen, optionen));
}

// Macht aus den Bytes einer Datei Text. Neuere Programme speichern UTF-8, ältere (auch manche
// SAP-Exporte) „ANSI“ (Windows-1252). Ist die Datei kein gültiges UTF-8, wird Windows-1252 genommen,
// damit Umlaute wie „ä“ richtig ankommen.
export function textAusDatei(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

// Liest CSV-Text in eine Liste von Zeilen, jede Zeile eine Liste von Texten:
//   'Nr;Text\n1;"Beamer; neu"'  ->  [['Nr', 'Text'], ['1', 'Beamer; neu']]
// Das Trennzeichen (; , oder Tabulator) wird an der ersten Zeile erkannt.
export function csvLesen(text) {
  const ersteZeile = text.split(/\r?\n/).find((zeile) => zeile.trim() !== '') ?? '';
  const kandidaten = [';', '\t', ','];
  const anzahl = (zeichen) => ersteZeile.split(zeichen).length;
  const trennzeichen = kandidaten.reduce((bestes, zeichen) => (anzahl(zeichen) > anzahl(bestes) ? zeichen : bestes));

  // Zeichen für Zeichen durchgehen. Innerhalb von "…" zählen Trennzeichen und Zeilenumbrüche nicht,
  // "" steht dort für ein einzelnes Anführungszeichen.
  const zeilen = [];
  let zeile = [];
  let wert = '';
  let inAnfuehrung = false;
  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i];
    if (inAnfuehrung) {
      if (zeichen === '"' && text[i + 1] === '"') {
        wert += '"';
        i++;
      } else if (zeichen === '"') {
        inAnfuehrung = false;
      } else {
        wert += zeichen;
      }
    } else if (zeichen === '"') {
      inAnfuehrung = true;
    } else if (zeichen === trennzeichen) {
      zeile.push(wert);
      wert = '';
    } else if (zeichen === '\n' || zeichen === '\r') {
      if (zeichen === '\r' && text[i + 1] === '\n') i++; // Windows-Zeilenende \r\n
      zeile.push(wert);
      zeilen.push(zeile);
      zeile = [];
      wert = '';
    } else {
      wert += zeichen;
    }
  }
  if (wert !== '' || zeile.length > 0) {
    zeile.push(wert);
    zeilen.push(zeile);
  }
  return zeilen;
}
