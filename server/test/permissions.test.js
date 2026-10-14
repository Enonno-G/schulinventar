import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEVICE_FIELDS_BY_ROLE, PERMISSIONS, hasPermission, permissionsFor } from '../src/lib/permissions.js';

test('Lesezugriff hat keine Berechtigung zum Ändern (Abnahme-Testfall T7)', () => {
  assert.deepEqual(permissionsFor('readonly'), []);
  assert.deepEqual(DEVICE_FIELDS_BY_ROLE.readonly, []);
});

test('Administrator hat alle Berechtigungen', () => {
  assert.deepEqual(permissionsFor('admin'), Object.keys(PERMISSIONS));
});

test('Facility-Management darf Räume pflegen und inventieren, aber keine Benutzer verwalten', () => {
  assert.equal(hasPermission('facility', 'rooms:write'), true);
  assert.equal(hasPermission('facility', 'inventory:run'), true);
  assert.equal(hasPermission('facility', 'users:manage'), false);
  assert.deepEqual(DEVICE_FIELDS_BY_ROLE.facility, ['room_id', 'notes']);
});

test('unbekannte Rolle oder Berechtigung ergibt kein Recht', () => {
  assert.equal(hasPermission('gast', 'rooms:write'), false);
  assert.equal(hasPermission('admin', 'gibt:es-nicht'), false);
});
