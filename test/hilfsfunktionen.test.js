// Tests für kleine Hilfsfunktionen. Brauchen keine Datenbank.
// Ausführen mit: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvErstellen } from '../src/csv.js';
import { passwortHashen, passwortPruefen } from '../src/passwort.js';
import { unterschiede } from '../src/protokoll.js';
import { inventarnummernAusText, istDatum, nummer, text } from '../src/pruefen.js';

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
  assert.ok(csv.startsWith('﻿'), 'Kennzeichen für Excel am Anfang');
  const zeilen = csv.slice(1).split('\r\n');
  assert.equal(zeilen[0], 'Nummer;Text;Garantie bis');
  assert.equal(zeilen[1], '1001;"Beamer; ""neu""";01.09.2029');
  assert.equal(zeilen[2], `1002;"'=HYPERLINK(""http://x"")";`);
});
