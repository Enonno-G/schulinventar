import { z } from 'zod';

// Fehlermeldungen von Zod auf Deutsch
z.config(z.locales.de());

export { z };

export const idSchema = z.coerce.number().int().positive();

export const requiredText = (max = 200) => z.string().trim().min(1, 'Pflichtfeld').max(max);

// Leere Eingaben aus Formularen werden als NULL gespeichert
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

export const optionalDate = z
  .union([z.literal(''), z.iso.date('Ungültiges Datum')])
  .transform((value) => value || null)
  .nullish();

export const passwordSchema = z.string().min(10, 'Das Passwort muss mindestens 10 Zeichen lang sein').max(200);

// Für PATCH: nur die Felder übernehmen, die tatsächlich mitgeschickt wurden
export function parsePatch(schema, body) {
  const input = body ?? {};
  const parsed = schema.partial().parse(input);
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => Object.hasOwn(input, key)));
}

// Leere Werte aus der Adresszeile (z. B. ?room_id=) wie fehlende Werte behandeln
export function withoutEmpty(values) {
  return Object.fromEntries(Object.entries(values ?? {}).filter(([, value]) => value !== ''));
}
