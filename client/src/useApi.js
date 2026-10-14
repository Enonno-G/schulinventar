import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Lädt Daten vom Backend und lädt neu, sobald sich Pfad oder Parameter ändern.
// Mit path = null wird nichts geladen. reload() lädt die Daten erneut, z. B. nach dem Speichern.
export function useApi(path, query) {
  const key = JSON.stringify([path, query ?? null]);
  const [state, setState] = useState({ data: null, error: null, loading: path !== null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const [currentPath, currentQuery] = JSON.parse(key);
    if (currentPath === null) return undefined;
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    api(currentPath, { query: currentQuery ?? undefined }).then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      },
      (error) => {
        if (!cancelled) setState((previous) => ({ ...previous, error, loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
