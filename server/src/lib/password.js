import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Passwörter werden nie im Klartext gespeichert, sondern nur als Hash (Pflichtenheft Kap. 5).
// scrypt ist in Node.js eingebaut und absichtlich rechenaufwendig, damit Durchprobieren lange dauert.
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const COST = 16384;

// Ergebnis: "scrypt$<Aufwand>$<Salt>$<Hash>"
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, { N: COST, r: 8, p: 1 });
  return `scrypt$${COST}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, cost, salt, hash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(cost),
    r: 8,
    p: 1,
  });
  return timingSafeEqual(expected, actual);
}
