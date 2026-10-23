// Tests für kleine Hilfsfunktionen. Brauchen keine Datenbank.
// Ausführen mit: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passwortHashen, passwortPruefen } from '../src/passwort.js';
import { unterschiede } from '../src/protokoll.js';
import { istDatum, nummer, text } from '../src/pruefen.js';

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
