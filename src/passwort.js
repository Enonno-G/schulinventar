// Passwörter werden nie selbst gespeichert, sondern nur als „Hash“ (Pflichtenheft Kap. 5).
// Ein Hash ist eine Zeichenfolge, aus der man das Passwort nicht zurückrechnen kann. Bei der Anmeldung
// wird das eingegebene Passwort genauso umgerechnet und mit dem gespeicherten Hash verglichen.
// Das Verfahren scrypt ist in Node.js eingebaut und absichtlich langsam, damit Durchprobieren lange dauert.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Ergebnis z. B. "scrypt$Zufallswert$Hash". Der Zufallswert („Salt“) sorgt dafür,
// dass zwei gleiche Passwörter trotzdem verschiedene Hashes ergeben.
export async function passwortHashen(passwort) {
  const zufallswert = randomBytes(16);
  const hash = await scryptAsync(passwort, zufallswert, 64);
  return `scrypt$${zufallswert.toString('base64')}$${hash.toString('base64')}`;
}

export async function passwortPruefen(passwort, gespeichert) {
  const [verfahren, zufallswert, hash] = String(gespeichert).split('$');
  if (verfahren !== 'scrypt' || !zufallswert || !hash) return false;
  const erwartet = Buffer.from(hash, 'base64');
  const berechnet = await scryptAsync(passwort, Buffer.from(zufallswert, 'base64'), erwartet.length);
  return timingSafeEqual(erwartet, berechnet); // Vergleich, der immer gleich lange dauert
}
