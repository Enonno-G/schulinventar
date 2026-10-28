// SAP-Liste lesen und Zeile für Zeile prüfen – Pflichtenheft Kap. 4 „Import aus SAP“ und
// „Verarbeitung dieser Daten“ (Pflichtfelder, gültige Daten, doppelte Inventarnummern).
//
// Diese Datei braucht keine Datenbank, nur die hochgeladene Datei. Den Vergleich mit der Datenbank und das
// Speichern erledigt src/seiten/import.js.
//
// Weil das genaue Format der SAP-Liste noch nicht bekannt ist, wählt man beim Import aus, welche Spalte der
// Datei welche Information enthält (Spaltenzuordnung). Gemerkt wird die Zuordnung über die Spaltenüberschrift.
import path from 'node:path';
import { readSheet } from 'read-excel-file/node';
import { csvLesen, textAusDatei } from './csv.js';
import { datumLesen, text } from './pruefen.js';

// Diese Felder können aus der SAP-Liste kommen. * = Pflichtfeld.
// „vorschlaege“: Spaltenüberschriften (klein geschrieben), bei denen die Spalte automatisch vorausgewählt wird.
export const IMPORT_FELDER = [
  {
    feld: 'inventarnummer',
    titel: 'Inventarnummer',
    pflicht: true,
    laenge: 50,
    vorschlaege: [
      'inventarnummer',
      'inventar-nr',
      'inventar-nr.',
      'inv.-nr.',
      'inv-nr',
      'invnr',
      'anlage',
      'anlagennummer',
    ],
  },
  {
    feld: 'bezeichnung',
    titel: 'Bezeichnung',
    pflicht: true,
    laenge: 200,
    vorschlaege: ['bezeichnung', 'anlagenbezeichnung', 'anlagentext', 'text', 'beschreibung'],
  },
  {
    feld: 'raumnummer',
    titel: 'Raumnummer',
    pflicht: true,
    laenge: 30,
    vorschlaege: ['raum', 'raumnummer', 'raum-nr', 'raum-nr.', 'raumnr', 'standort'],
  },
  { feld: 'typ', titel: 'Gerätetyp', laenge: 100, vorschlaege: ['typ', 'gerätetyp', 'geraetetyp', 'art', 'kategorie'] },
  {
    feld: 'seriennummer',
    titel: 'Seriennummer',
    laenge: 100,
    vorschlaege: ['seriennummer', 'serien-nr', 'serien-nr.', 'serial'],
  },
  {
    feld: 'anschaffungsdatum',
    titel: 'Anschaffungsdatum',
    datum: true,
    vorschlaege: ['anschaffungsdatum', 'aktivierungsdatum', 'aktiviert am', 'zugangsdatum', 'erstzugang'],
  },
  { feld: 'inbetriebnahme', titel: 'Inbetriebnahme', datum: true, vorschlaege: ['inbetriebnahme'] },
];

// Ein Zellwert als Text. Excel liefert auch Zahlen und Datumswerte, die werden hier umgewandelt.
function zelleAlsText(wert) {
  if (wert === null || wert === undefined) return '';
  if (wert instanceof Date) return wert.toISOString().slice(0, 10); // Excel-Datum -> 'JJJJ-MM-TT'
  return String(wert).trim();
}

// Liest die hochgeladene Datei (CSV oder Excel).
// Ergebnis: { spalten: ['Anlage', 'Text', …], zeilen: [{ nr: 2, werte: ['20000001', 'PC', …] }, …] } oder { fehler }
// „nr“ ist die Zeilennummer wie in Excel, damit man fehlerhafte Zeilen in der Datei wiederfindet.
export async function listeLesen(datei) {
  if (!datei || datei.size === 0) return { fehler: 'Bitte eine Datei auswählen.' };

  const endung = path.extname(datei.originalname).toLowerCase();
  let tabelle;
  if (endung === '.xlsx') {
    // Eine Excel-Datei ist eigentlich ein ZIP-Archiv und beginnt deshalb immer mit „PK“
    if (datei.buffer[0] !== 0x50 || datei.buffer[1] !== 0x4b) {
      return { fehler: 'Die Datei endet auf .xlsx, ist aber keine echte Excel-Datei.' };
    }
    try {
      tabelle = await readSheet(datei.buffer); // erstes Tabellenblatt
    } catch {
      return { fehler: 'Die Excel-Datei konnte nicht gelesen werden. Bitte in Excel als .xlsx oder .csv speichern.' };
    }
  } else if (endung === '.csv' || endung === '.txt') {
    if (datei.buffer.includes(0)) return { fehler: 'Die Datei ist keine Textdatei.' }; // z. B. ein umbenanntes Programm
    tabelle = csvLesen(textAusDatei(datei.buffer));
  } else if (endung === '.xls') {
    return { fehler: 'Das alte Excel-Format .xls geht nicht. Bitte die Liste in Excel als .xlsx oder .csv speichern.' };
  } else {
    return { fehler: 'Bitte eine CSV-Datei (.csv) oder eine Excel-Datei (.xlsx) hochladen.' };
  }

  const alleZeilen = tabelle.map((werte, index) => ({ nr: index + 1, werte: werte.map(zelleAlsText) }));

  // Die Kopfzeile ist die erste Zeile mit mindestens zwei ausgefüllten Zellen.
  // (Darüber steht in Listen manchmal ein Titel wie „Anlagenliste Stand 01.10.2026“.)
  const kopf = alleZeilen.find((zeile) => zeile.werte.filter((wert) => wert !== '').length >= 2);
  if (!kopf) return { fehler: 'In der Datei wurde keine Tabelle mit Spaltenüberschriften gefunden.' };

  // Spaltenüberschriften: leere bekommen einen Namen, doppelte eine Nummer, damit jede eindeutig ist
  const spalten = [];
  kopf.werte.forEach((titel, index) => {
    let name = titel || `Spalte ${index + 1}`;
    if (spalten.includes(name)) name = `${name} (${index + 1})`;
    spalten.push(name);
  });

  const zeilen = alleZeilen.filter((zeile) => zeile.nr > kopf.nr && zeile.werte.some((wert) => wert !== ''));
  if (zeilen.length === 0) return { fehler: 'Die Datei enthält unter den Spaltenüberschriften keine Daten.' };
  return { spalten, zeilen };
}

// Schlägt vor, welche Spalte der Datei zu welchem Feld gehört: zuerst die zuletzt gespeicherte Zuordnung
// (falls es diese Spalte in der Datei gibt), sonst nach der Spaltenüberschrift.
// Ergebnis z. B. { inventarnummer: 'Anlage', bezeichnung: 'Text', raumnummer: 'Raum' }
export function zuordnungVorschlagen(spalten, gespeichert = {}) {
  const zuordnung = {};
  for (const { feld, vorschlaege } of IMPORT_FELDER) {
    if (gespeichert[feld] && spalten.includes(gespeichert[feld])) {
      zuordnung[feld] = gespeichert[feld];
    } else {
      const passend = spalten.find((spalte) => vorschlaege.includes(spalte.toLowerCase()));
      if (passend) zuordnung[feld] = passend;
    }
  }
  return zuordnung;
}

// Welche Pflichtfelder haben noch keine Spalte? Ergebnis z. B. ['Raumnummer']
export function fehlendePflichtfelder(zuordnung) {
  return IMPORT_FELDER.filter((feld) => feld.pflicht && !zuordnung[feld.feld]).map((feld) => feld.titel);
}

// Prüft jede Zeile. Fehlerhafte Zeilen werden nicht übersprungen, sondern mit Grund aufgelistet.
// Ergebnis: { gueltig: [{ nr, geraet, sapDaten }], fehlerhaft: [{ nr, inventarnummer, fehler: ['…'] }] }
//   geraet:   die Werte für unsere Felder, z. B. { inventarnummer: '20000001', bezeichnung: 'PC', … }
//   sapDaten: alle Werte der Zeile mit Spaltenüberschrift (wird in geraete.sap_daten gespeichert)
export function zeilenPruefen(spalten, zeilen, zuordnung) {
  const gueltig = [];
  const fehlerhaft = [];
  const ersteZeileJeNummer = new Map(); // um doppelte Inventarnummern zu finden

  for (const zeile of zeilen) {
    const geraet = {};
    const fehler = [];

    for (const { feld, titel, pflicht, datum, laenge } of IMPORT_FELDER) {
      const spalte = spalten.indexOf(zuordnung[feld]);
      let wert = spalte === -1 ? null : text(zeile.werte[spalte]);

      if (pflicht && !wert) {
        fehler.push(`${titel} fehlt`);
      } else if (wert && datum) {
        const gelesen = datumLesen(wert);
        if (gelesen === false) fehler.push(`${titel} „${wert}“ ist kein gültiges Datum`);
        wert = gelesen || null;
      } else if (wert && wert.length > laenge) {
        fehler.push(`${titel} ist länger als ${laenge} Zeichen`);
      }
      geraet[feld] = wert ?? null;
    }

    if (geraet.inventarnummer) {
      const ersteZeile = ersteZeileJeNummer.get(geraet.inventarnummer);
      if (ersteZeile) fehler.push(`Inventarnummer kommt mehrfach vor (zuerst in Zeile ${ersteZeile})`);
      else ersteZeileJeNummer.set(geraet.inventarnummer, zeile.nr);
    }

    if (fehler.length > 0) {
      fehlerhaft.push({ nr: zeile.nr, inventarnummer: geraet.inventarnummer, fehler });
    } else {
      const sapDaten = {};
      spalten.forEach((spalte, index) => (sapDaten[spalte] = zeile.werte[index] ?? ''));
      gueltig.push({ nr: zeile.nr, geraet, sapDaten });
    }
  }
  return { gueltig, fehlerhaft };
}
