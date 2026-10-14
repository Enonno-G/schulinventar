// Tests der API gegen eine echte PostgreSQL-Datenbank.
// Laufen nur, wenn TEST_DATABASE_URL gesetzt ist, z. B. auf eine eigene Datenbank im Docker-Container:
//   TEST_DATABASE_URL=postgres://schulinventar:…@localhost:5432/schulinventar_test npm test
// Nie auf die Datenbank mit echten Daten zeigen lassen.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe('API', { skip: !TEST_DATABASE_URL && 'TEST_DATABASE_URL ist nicht gesetzt' }, () => {
  const ROLES = ['admin', 'accounting', 'facility', 'readonly'];
  const password = randomBytes(12).toString('base64url');
  const suffix = randomBytes(3).toString('hex'); // eindeutige Namen, falls die Datenbank schon Daten hat
  const cookies = {};
  let server, baseUrl, pool, app;

  async function request(role, method, path, body) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (role) headers.cookie = cookies[role];
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, res };
  }

  before(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    const { migrate } = await import('../src/db/migrate.js');
    const { hashPassword } = await import('../src/lib/password.js');
    const { createApp } = await import('../src/app.js');
    ({ pool } = await import('../src/db/pool.js'));

    await migrate({ log: () => {} });
    const hash = await hashPassword(password);
    for (const role of ROLES) {
      await pool.query('INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, $3, $4)', [
        `Test ${role}`,
        `${role}-${suffix}@test.local`,
        role,
        hash,
      ]);
    }

    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    for (const role of ROLES) {
      const { status, res } = await request(null, 'POST', '/auth/login', {
        email: `${role}-${suffix}@test.local`,
        password,
      });
      assert.equal(status, 200);
      cookies[role] = res.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
    }
  });

  after(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    app?.locals.sessionStore.close();
    await pool?.end();
  });

  let roomA, roomB, deviceId;

  test('ohne Anmeldung gibt es keine Daten', async () => {
    assert.equal((await request(null, 'GET', '/devices')).status, 401);
  });

  test('falsches Passwort wird mit verständlicher Meldung abgelehnt', async () => {
    const { status, body } = await request(null, 'POST', '/auth/login', {
      email: `admin-${suffix}@test.local`,
      password: 'falsches-passwort',
    });
    assert.equal(status, 401);
    assert.equal(body.error, 'E-Mail-Adresse oder Passwort ist falsch');
  });

  test('Räume anlegen, doppelte Raumnummer ablehnen', async () => {
    const a = await request('facility', 'POST', '/rooms', {
      number: `A-${suffix}`,
      name: 'EDV-Saal',
      floor: '1. Stock',
    });
    const b = await request('admin', 'POST', '/rooms', { number: `B-${suffix}`, name: '', floor: '' });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(b.body.name, null); // leere Eingabe wird als NULL gespeichert
    roomA = a.body.id;
    roomB = b.body.id;

    const duplicate = await request('admin', 'POST', '/rooms', { number: `A-${suffix}` });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error, 'Diese Raumnummer ist bereits vorhanden');
  });

  test('Pflichtfelder werden geprüft', async () => {
    const { status, body } = await request('accounting', 'POST', '/devices', { inventory_number: '', room_id: '' });
    assert.equal(status, 400);
    assert.ok(body.fields.inventory_number);
    assert.ok(body.fields.description);
    assert.equal(body.fields.room_id, 'Bitte einen Raum auswählen');
  });

  test('T4: Gerät anlegen und über die Inventarnummer finden', async () => {
    const created = await request('accounting', 'POST', '/devices', {
      inventory_number: `INV-${suffix}`,
      description: 'Beamer Deckenmontage',
      device_type: 'Beamer',
      serial_number: `SN-${suffix}`,
      room_id: String(roomA),
      purchase_date: '2026-09-01',
      warranty_until: '2029-09-01',
    });
    assert.equal(created.status, 201);
    deviceId = created.body.id;

    const found = await request('readonly', 'GET', `/devices?search=INV-${suffix}`);
    assert.equal(found.body.total, 1);
    assert.equal(found.body.items[0].room_number, `A-${suffix}`);

    const bySerial = await request('readonly', 'GET', `/devices?search=sn-${suffix}`);
    assert.equal(bySerial.body.total, 1);

    const duplicate = await request('accounting', 'POST', '/devices', {
      inventory_number: `INV-${suffix}`,
      description: 'Noch ein Beamer',
      room_id: roomA,
    });
    assert.equal(duplicate.status, 409);
  });

  test('Garantie bis darf nicht vor dem Kaufdatum liegen', async () => {
    const { status, body } = await request('accounting', 'PATCH', `/devices/${deviceId}`, {
      warranty_until: '2025-01-01',
    });
    assert.equal(status, 400);
    assert.ok(body.fields.warranty_until);
  });

  test('T7: Lesezugriff kann nichts ändern oder löschen', async () => {
    assert.equal((await request('readonly', 'POST', '/rooms', { number: `X-${suffix}` })).status, 403);
    assert.equal((await request('readonly', 'PATCH', `/rooms/${roomB}`, { name: 'neu' })).status, 403);
    assert.equal((await request('readonly', 'DELETE', `/rooms/${roomB}`)).status, 403);
    assert.equal((await request('readonly', 'PATCH', `/devices/${deviceId}`, { notes: 'x' })).status, 403);
    assert.equal((await request('readonly', 'GET', '/users')).status, 403);
  });

  test('Raumwechsel wird mit Datum gespeichert, Facility-Management ändert nur Raum und Anmerkungen', async () => {
    const forbidden = await request('facility', 'PATCH', `/devices/${deviceId}`, { description: 'Anders' });
    assert.equal(forbidden.status, 403);

    const moved = await request('facility', 'PATCH', `/devices/${deviceId}`, {
      room_id: roomB,
      notes: 'Lampe flackert',
    });
    assert.equal(moved.status, 200);

    const { body: device } = await request('readonly', 'GET', `/devices/${deviceId}`);
    assert.equal(device.room_id, roomB);
    assert.equal(device.room_changes.length, 1);
    assert.equal(device.room_changes[0].from_room_number, `A-${suffix}`);
    assert.equal(device.room_changes[0].to_room_number, `B-${suffix}`);
    assert.ok(device.room_changes[0].changed_at);

    const update = device.history.find((entry) => entry.action === 'update');
    assert.equal(update.user_name, 'Test facility');
    assert.deepEqual(update.changes.notes, { old: null, new: 'Lampe flackert' });
  });

  test('Raum mit Geräten kann nicht gelöscht werden, leerer Raum schon', async () => {
    const blocked = await request('admin', 'DELETE', `/rooms/${roomB}`);
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.error, /noch 1 Gerät zugeordnet ist/);
    assert.equal((await request('admin', 'DELETE', `/rooms/${roomA}`)).status, 204);
  });

  test('Änderungsprotokoll lässt sich nicht verändern', async () => {
    await assert.rejects(pool.query('DELETE FROM audit_log'), /kann nicht verändert werden/);
  });

  test('Administrator kann sich nicht selbst deaktivieren', async () => {
    const { body: me } = await request('admin', 'GET', '/auth/me');
    const { status } = await request('admin', 'PATCH', `/users/${me.id}`, { active: false });
    assert.equal(status, 400);
  });

  test('deaktiviertes Konto ist sofort abgemeldet', async () => {
    const { body: users } = await request('admin', 'GET', '/users');
    const readonly = users.find((user) => user.email === `readonly-${suffix}@test.local`);
    assert.equal((await request('admin', 'PATCH', `/users/${readonly.id}`, { active: false })).status, 200);
    assert.equal((await request('readonly', 'GET', '/devices')).status, 401);
  });

  test('Abmelden beendet die Sitzung', async () => {
    assert.equal((await request('facility', 'POST', '/auth/logout')).status, 204);
    assert.equal((await request('facility', 'GET', '/auth/me')).status, 401);
  });

  test('noch nicht umgesetzte Funktionen melden sich mit 501', async () => {
    const { status, body } = await request('admin', 'POST', '/import/preview');
    assert.equal(status, 501);
    assert.match(body.error, /Sprint 3/);
  });
});
