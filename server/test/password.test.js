import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

test('Passwort wird nur als Hash gespeichert und lässt sich prüfen', async () => {
  const hash = await hashPassword('geheimes-passwort');
  assert.ok(!hash.includes('geheimes-passwort'));
  assert.equal(await verifyPassword('geheimes-passwort', hash), true);
  assert.equal(await verifyPassword('falsches-passwort', hash), false);
});

test('gleiches Passwort ergibt durch das Salt jedes Mal einen anderen Hash', async () => {
  assert.notEqual(await hashPassword('gleiches-passwort'), await hashPassword('gleiches-passwort'));
});

test('unbrauchbarer gespeicherter Wert wird abgelehnt', async () => {
  assert.equal(await verifyPassword('egal', 'kein-hash'), false);
});
