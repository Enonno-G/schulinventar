import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diff } from '../src/lib/audit.js';

test('nur geänderte Felder landen im Protokoll', () => {
  const before = { id: 1, description: 'PC', room_id: 3, notes: null, updated_at: '2026-10-01' };
  const after = { id: 1, description: 'PC', room_id: 4, notes: 'Bildschirm defekt', updated_at: '2026-10-14' };
  assert.deepEqual(diff(before, after), {
    room_id: { old: 3, new: 4 },
    notes: { old: null, new: 'Bildschirm defekt' },
  });
});

test('Passwort-Hash wird nie protokolliert', () => {
  assert.deepEqual(diff(null, { name: 'Test', password_hash: 'scrypt$…' }), { name: { old: null, new: 'Test' } });
});

test('leere Werte gelten als gleich', () => {
  assert.deepEqual(diff({ notes: null }, { notes: undefined }), {});
});
