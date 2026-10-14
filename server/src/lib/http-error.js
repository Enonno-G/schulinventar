// Fehler mit HTTP-Statuscode und verständlicher Meldung für die Oberfläche.
// `fields` enthält Meldungen zu einzelnen Formularfeldern, z. B. { room_id: 'Raum nicht gefunden' }.
export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const notFound = (what = 'Eintrag') => new HttpError(404, `${what} nicht gefunden`);

export const invalidFields = (fields) => new HttpError(400, 'Bitte die markierten Eingaben prüfen', fields);

// Platzhalter für Funktionen, die laut Jira-Plan erst in einem späteren Sprint umgesetzt werden
export const notImplemented = (feature, sprint) => (req, res) => {
  res.status(501).json({ error: `${feature} ist noch nicht umgesetzt (geplant für Sprint ${sprint})` });
};
