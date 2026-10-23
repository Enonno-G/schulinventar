// Listen als CSV-Datei zum Herunterladen – Pflichtenheft Kap. 4 „Export in CSV-Datei bzw. Excel-Datei“.
//
// CSV ist eine Textdatei, in der jede Zeile eine Tabellenzeile ist und die Spalten durch ein Zeichen getrennt
// sind. Damit Excel die Datei mit einem Doppelklick richtig öffnet (österreichische Einstellungen), gilt:
//   - Strichpunkt ; als Trennzeichen (das Komma braucht Excel für Dezimalzahlen)
//   - ein unsichtbares Zeichen ganz am Anfang (BOM), damit Excel Umlaute richtig erkennt
//   - Datum als TT.MM.JJJJ
import { datum } from './format.js';

// Ein Wert für eine Zelle. Enthält er ; " oder einen Zeilenumbruch, kommt er in Anführungszeichen.
function zelle(wert) {
  if (wert === null || wert === undefined) return '';
  let text = String(wert);
  // Schutz gegen „Formel-Einschleusung“: Ein Wert wie =HYPERLINK(…) würde Excel sonst als Formel ausführen
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[;"\r\n]/.test(text)) text = '"' + text.replaceAll('"', '""') + '"';
  return text;
}

// spalten: [{ titel: 'Inventarnummer', feld: 'inventarnummer' }, { titel: 'Garantie bis', feld: 'garantie_bis', datum: true }]
// zeilen:  die Zeilen aus der Datenbank
export function csvErstellen(spalten, zeilen) {
  const kopfzeile = spalten.map((spalte) => zelle(spalte.titel)).join(';');
  const datenzeilen = zeilen.map((zeile) =>
    spalten
      .map((spalte) => {
        const wert = zeile[spalte.feld];
        if (spalte.datum) return wert ? datum(wert) : '';
        return zelle(wert);
      })
      .join(';'),
  );
  return '﻿' + [kopfzeile, ...datenzeilen].join('\r\n') + '\r\n';
}

// Schickt die CSV-Datei an den Browser, der sie dann herunterlädt
export function csvSenden(res, dateiname, spalten, zeilen) {
  res.attachment(dateiname); // „Datei herunterladen“ statt im Browser anzeigen
  res.type('text/csv; charset=utf-8');
  res.send(csvErstellen(spalten, zeilen));
}
