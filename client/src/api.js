// Anfragen an das Backend. Fehler kommen als ApiError mit deutscher Meldung und Meldungen je Feld.

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let onUnauthorized = () => {};
let onActivity = () => {};

// Wird von auth.jsx gesetzt: was passiert, wenn die Sitzung abgelaufen ist
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler ?? (() => {});
}

// Wird von auth.jsx gesetzt: jede Anfrage zählt als Aktivität (automatische Abmeldung)
export function setActivityHandler(handler) {
  onActivity = handler ?? (() => {});
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  onActivity();
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server. Bitte die Netzwerkverbindung prüfen.');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') onUnauthorized();
    throw new ApiError(response.status, data?.error ?? `Fehler ${response.status}`, data?.fields ?? {});
  }
  return data;
}
