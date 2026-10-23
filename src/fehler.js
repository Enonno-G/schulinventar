// Fehlerseiten

// „Nicht gefunden“, z. B. wenn jemand /geraete/99999 aufruft
export function nichtGefunden(res, was = 'Seite') {
  res.status(404).render('fehler', {
    titel: `${was} nicht gefunden`,
    text: 'Diese Adresse gibt es nicht oder der Eintrag wurde gelöscht.',
  });
}

// Fängt alle unerwarteten Fehler ab: Details ins Terminal, eine freundliche Seite für den Benutzer.
// (Express erkennt diese Funktion an den vier Parametern als Fehlerbehandlung.)
export function fehlerBehandeln(fehler, req, res, next) {
  if (res.headersSent) return next(fehler);

  // Meldung, die die Datenbank selbst schickt, z. B. „Das Änderungsprotokoll kann nicht verändert werden“
  if (fehler.code === 'P0001') {
    return res.status(409).render('fehler', { titel: 'Nicht möglich', text: fehler.message });
  }

  console.error(fehler);
  res.status(500).render('fehler', {
    titel: 'Ein Fehler ist aufgetreten',
    text: 'Bitte später erneut versuchen. Die genaue Meldung steht im Terminal des Servers.',
  });
}
