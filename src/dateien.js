// Hochgeladene Dateien (Rechnungen, Lieferscheine, Garantiedokumente) prüfen und speichern.
// Pflichtenheft Kap. 5: nur PDF, JPG und PNG bis zu einer festgelegten Größe, Dateien bleiben unverändert.
//
// Ein Formular mit Datei schickt die Daten anders als ein normales Formular („multipart“). Das Auspacken
// übernimmt das Paket multer. Danach steht die Datei in req.file und die anderen Felder in req.body.
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { einstellungen } from './einstellungen.js';

// Erlaubte Dateiarten. Geprüft wird die Dateiendung UND der Anfang des Inhalts, denn eine umbenannte
// .exe-Datei heißt vielleicht „rechnung.pdf“, beginnt aber nicht mit %PDF.
const DATEIARTEN = [
  { dateityp: 'application/pdf', endungen: ['.pdf'], beginn: [0x25, 0x50, 0x44, 0x46] }, // „%PDF“
  { dateityp: 'image/jpeg', endungen: ['.jpg', '.jpeg'], beginn: [0xff, 0xd8, 0xff] },
  { dateityp: 'image/png', endungen: ['.png'], beginn: [0x89, 0x50, 0x4e, 0x47] }, // „‰PNG“
];

const upload = multer({
  storage: multer.memoryStorage(), // Datei zuerst nur im Arbeitsspeicher halten, gespeichert wird nach der Prüfung
  limits: { fileSize: einstellungen.uploadHoechstMB * 1024 * 1024, files: 1 },
  defParamCharset: 'utf8', // Umlaute im Dateinamen, z. B. „Rechnung März.pdf“
});

// Verwendung in einer Route: router.post('/belege/neu', dateiEmpfangen('datei'), …)
// Ist die Datei zu groß, steht danach in req.dateiFehler eine Meldung für das Formular.
export function dateiEmpfangen(feldname) {
  const auspacken = upload.single(feldname);
  return (req, res, next) => {
    auspacken(req, res, (fehler) => {
      if (fehler instanceof multer.MulterError) {
        req.dateiFehler =
          fehler.code === 'LIMIT_FILE_SIZE'
            ? `Die Datei ist zu groß. Erlaubt sind höchstens ${einstellungen.uploadHoechstMB} MB.`
            : 'Bitte genau eine Datei auswählen.';
        req.file = undefined;
        return next();
      }
      next(fehler);
    });
  };
}

// Prüft die Datei. Ergebnis: der Dateityp (z. B. 'application/pdf') oder eine verständliche Fehlermeldung.
export function dateiPruefen(datei) {
  if (!datei || datei.size === 0) return { fehler: 'Bitte eine Datei auswählen.' };

  const endung = path.extname(datei.originalname).toLowerCase();
  const art = DATEIARTEN.find((moeglich) => moeglich.endungen.includes(endung));
  if (!art) return { fehler: 'Nur PDF-, JPG- und PNG-Dateien sind erlaubt.' };

  const inhaltPasst = art.beginn.every((byte, stelle) => datei.buffer[stelle] === byte);
  if (!inhaltPasst) {
    return { fehler: `Die Datei endet auf ${endung}, ist aber keine echte ${endung.slice(1).toUpperCase()}-Datei.` };
  }
  return { dateityp: art.dateityp };
}

// Speichert die Datei unverändert im Upload-Ordner unter einem zufälligen Namen
// (so kann ein Dateiname wie „../../start.js“ nichts anrichten).
// Die Prüfsumme (SHA-256) ist wie ein Fingerabdruck: Ändert sich auch nur ein Byte, ändert sich die Prüfsumme.
export async function dateiSpeichern(datei) {
  const endung = path.extname(datei.originalname).toLowerCase();
  const gespeichertAls = randomUUID() + endung;
  await fs.mkdir(einstellungen.uploadOrdner, { recursive: true });
  await fs.writeFile(path.join(einstellungen.uploadOrdner, gespeichertAls), datei.buffer, { flag: 'wx' });
  return {
    gespeichertAls,
    pruefsumme: createHash('sha256').update(datei.buffer).digest('hex'),
  };
}

// Falls nach dem Speichern der Datei etwas schiefgeht, die Datei wieder entfernen
export async function dateiEntfernen(gespeichertAls) {
  await fs.rm(path.join(einstellungen.uploadOrdner, gespeichertAls), { force: true });
}
