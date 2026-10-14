import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setActivityHandler, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = wird noch geprüft, null = nicht angemeldet, Objekt = angemeldeter Benutzer
  const [user, setUser] = useState(undefined);
  const [notice, setNotice] = useState('');
  const loggedIn = useRef(false);

  useEffect(() => {
    loggedIn.current = Boolean(user);
  }, [user]);

  useEffect(() => {
    // Antwortet der Server mit 401, ist die Sitzung abgelaufen
    setUnauthorizedHandler(() => {
      if (loggedIn.current) setNotice('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
      setUser(null);
    });
    api('/auth/me').then(setUser, () => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Automatische Abmeldung nach Inaktivität (Pflichtenheft Kap. 5). Der Zeitraum läuft ab der
  // letzten Anfrage an den Server, genau wie die Sitzung am Server.
  useEffect(() => {
    if (!user) return undefined;
    let timer;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          setNotice(`Sie wurden nach ${user.session_idle_minutes} Minuten ohne Aktivität automatisch abgemeldet.`);
          setUser(null);
          api('/auth/logout', { method: 'POST' }).catch(() => {});
        },
        user.session_idle_minutes * 60 * 1000,
      );
    };
    restart();
    setActivityHandler(restart);
    return () => {
      clearTimeout(timer);
      setActivityHandler(null);
    };
  }, [user]);

  const login = useCallback(async (email, password) => {
    const me = await api('/auth/login', { method: 'POST', body: { email, password } });
    setNotice('');
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setNotice('');
    setUser(null);
  }, []);

  // Nur für die Anzeige. Geprüft wird jede Berechtigung zusätzlich am Server.
  const can = useCallback((permission) => Boolean(user?.permissions.includes(permission)), [user]);

  const value = useMemo(() => ({ user, notice, login, logout, can }), [user, notice, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
