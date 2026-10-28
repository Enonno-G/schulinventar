// Tests für kleine Hilfsfunktionen. Brauchen keine Datenbank.
// Ausführen mit: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { csvErstellen, csvLesen, textAusDatei } from '../src/csv.js';
import { passwortHashen, passwortPruefen } from '../src/passwort.js';
import { unterschiede } from '../src/protokoll.js';
import { datumLesen, inventarnummernAusText, istDatum, nummer, text } from '../src/pruefen.js';
import { fehlendePflichtfelder, listeLesen, zeilenPruefen, zuordnungVorschlagen } from '../src/sap-liste.js';

test('Passwort wird nur als Hash gespeichert und lässt sich prüfen', async () => {
  const hash = await passwortHashen('geheimes-passwort');
  assert.ok(!hash.includes('geheimes-passwort'));
  assert.equal(await passwortPruefen('geheimes-passwort', hash), true);
  assert.equal(await passwortPruefen('falsches-passwort', hash), false);
});

test('gleiches Passwort ergibt jedes Mal einen anderen Hash', async () => {
  assert.notEqual(await passwortHashen('gleich-gleich'), await passwortHashen('gleich-gleich'));
});

test('Änderungsprotokoll enthält nur geänderte Felder und nie den Passwort-Hash', () => {
  const vorher = { raumnummer: 'E.01', anmerkungen: null, passwort_hash: 'alt', geaendert_am: '1' };
  const nachher = { raumnummer: 'E.02', anmerkungen: null, passwort_hash: 'neu', geaendert_am: '2' };
  assert.deepEqual(unterschiede(vorher, nachher), { raumnummer: { vorher: 'E.01', nachher: 'E.02' } });
});

test('Formulareingaben werden aufbereitet', () => {
  assert.equal(text('  E.01  '), 'E.01');
  assert.equal(text('   '), null);
  assert.equal(nummer('5'), 5);
  assert.equal(nummer('abc'), null);
  assert.equal(nummer('-3'), null);
});

test('nur gültige Daten werden akzeptiert', () => {
  assert.equal(istDatum('2026-10-14'), true);
  assert.equal(istDatum('2026-02-31'), false);
  assert.equal(istDatum('2026-13-01'), false);
  assert.equal(istDatum('14.10.2026'), false);
  assert.equal(istDatum(undefined), false);
});

test('mehrere Inventarnummern aus einem Textfeld, z. B. vom Strichcode-Scanner', () => {
  assert.deepEqual(inventarnummernAusText('1001\r\n1002, 1003;1004\n\n 1001 '), ['1001', '1002', '1003', '1004']);
  assert.deepEqual(inventarnummernAusText('   '), []);
  assert.deepEqual(inventarnummernAusText(undefined), []);
});

test('CSV-Datei: Strichpunkt, deutsches Datum, Sonderzeichen und Schutz gegen Formeln', () => {
  const spalten = [
    { titel: 'Nummer', feld: 'nummer' },
    { titel: 'Text', feld: 'text' },
    { titel: 'Garantie bis', feld: 'garantie_bis', datum: true },
  ];
  const csv = csvErstellen(spalten, [
    { nummer: '1001', text: 'Beamer; "neu"', garantie_bis: '2029-09-01' },
    { nummer: '1002', text: '=HYPERLINK("http://x")', garantie_bis: null },
  ]);
  assert.ok(csv.startsWith('\uFEFF'), 'Kennzeichen für Excel am Anfang');
  const zeilen = csv.slice(1).split('\r\n');
  assert.equal(zeilen[0], 'Nummer;Text;Garantie bis');
  assert.equal(zeilen[1], '1001;"Beamer; ""neu""";01.09.2029');
  assert.equal(zeilen[2], `1002;"'=HYPERLINK(""http://x"")";`);
});

test('CSV lesen: Trennzeichen erkennen, Anführungszeichen, Zeilenumbruch im Feld', () => {
  assert.deepEqual(csvLesen('Nr;Text\r\n1;"Beamer; ""neu"""\r\n2;"zwei\nZeilen"\r\n'), [
    ['Nr', 'Text'],
    ['1', 'Beamer; "neu"'],
    ['2', 'zwei\nZeilen'],
  ]);
  assert.deepEqual(csvLesen('Nr,Text\n1,PC'), [
    ['Nr', 'Text'],
    ['1', 'PC'],
  ]);
  assert.deepEqual(csvLesen('Nr\tText\n1\tPC'), [
    ['Nr', 'Text'],
    ['1', 'PC'],
  ]);
});

test('CSV aus alten Windows-Programmen: Umlaute kommen richtig an', () => {
  const ansi = Buffer.from([0x52, 0x61, 0x75, 0x6d, 0x3b, 0xdc, 0x62, 0x75, 0x6e, 0x67]); // „Raum;Übung“ in Windows-1252
  assert.equal(textAusDatei(ansi), 'Raum;Übung');
  assert.equal(textAusDatei(Buffer.from('\uFEFFRaum;Übung', 'utf8')), 'Raum;Übung');
});

test('Datum aus der SAP-Liste', () => {
  assert.equal(datumLesen('15.03.2021'), '2021-03-15');
  assert.equal(datumLesen('5.3.2021'), '2021-03-05');
  assert.equal(datumLesen('2021-03-15'), '2021-03-15');
  assert.equal(datumLesen('20210315'), '2021-03-15');
  assert.equal(datumLesen(''), null);
  assert.equal(datumLesen('31.02.2021'), false);
  assert.equal(datumLesen('irgendwann'), false);
});

test('Excel-Liste lesen: Titelzeile überspringen, Zahlen und Datum als Text', async () => {
  const datei = { originalname: 'Anlagen.xlsx', buffer: fs.readFileSync('test/beispiel-sap-liste.xlsx') };
  datei.size = datei.buffer.length;
  const liste = await listeLesen(datei);
  assert.deepEqual(liste.spalten, ['Anlage', 'Anlagenbezeichnung', 'Raum', 'Aktiviert am', 'Seriennummer']);
  assert.equal(liste.zeilen.length, 3);
  assert.deepEqual(liste.zeilen[0], { nr: 3, werte: ['30000001', 'Notebook', 'E.01', '2021-03-15', 'SN-1'] });

  const zuordnung = zuordnungVorschlagen(liste.spalten);
  assert.deepEqual(zuordnung, {
    inventarnummer: 'Anlage',
    bezeichnung: 'Anlagenbezeichnung',
    raumnummer: 'Raum',
    seriennummer: 'Seriennummer',
    anschaffungsdatum: 'Aktiviert am',
  });
  assert.deepEqual(fehlendePflichtfelder(zuordnung), []);
  assert.deepEqual(fehlendePflichtfelder({ inventarnummer: 'Anlage' }), ['Bezeichnung', 'Raumnummer']);

  const { gueltig, fehlerhaft } = zeilenPruefen(liste.spalten, liste.zeilen, zuordnung);
  assert.equal(gueltig.length, 2);
  assert.equal(gueltig[1].geraet.anschaffungsdatum, '2021-03-15');
  assert.equal(gueltig[1].sapDaten.Anlagenbezeichnung, 'Beamer Übungsfirma');
  assert.deepEqual(fehlerhaft, [
    {
      nr: 5,
      inventarnummer: '30000003',
      fehler: ['Bezeichnung fehlt', 'Anschaffungsdatum „31.02.2021“ ist kein gültiges Datum'],
    },
  ]);
});

test('SAP-Liste: doppelte Inventarnummer und falsche Dateien werden gemeldet', async () => {
  const spalten = ['Anlage', 'Text', 'Raum'];
  const zeilen = [
    { nr: 2, werte: ['1001', 'PC', 'E.01'] },
    { nr: 3, werte: ['1001', 'PC', 'E.02'] },
  ];
  const { fehlerhaft } = zeilenPruefen(spalten, zeilen, zuordnungVorschlagen(spalten));
  assert.deepEqual(fehlerhaft[0].fehler, ['Inventarnummer kommt mehrfach vor (zuerst in Zeile 2)']);

  const exe = { originalname: 'liste.xlsx', buffer: Buffer.from('MZ Programm'), size: 11 };
  assert.match((await listeLesen(exe)).fehler, /keine echte Excel-Datei/);
  const alt = { originalname: 'liste.xls', buffer: Buffer.from('x'), size: 1 };
  assert.match((await listeLesen(alt)).fehler, /\.xls geht nicht/);
});
