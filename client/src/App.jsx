import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import RequirePermission from './components/RequirePermission.jsx';
import DeviceDetailPage from './pages/DeviceDetailPage.jsx';
import DeviceFormPage from './pages/DeviceFormPage.jsx';
import DevicesPage from './pages/DevicesPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PasswordPage from './pages/PasswordPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import RoomDetailPage from './pages/RoomDetailPage.jsx';
import RoomsPage from './pages/RoomsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

export default function App() {
  const { user } = useAuth();

  if (user === undefined) return <p className="loading">Wird geladen …</p>;
  // Ohne Anmeldung immer die Anmeldeseite. Die Adresse bleibt erhalten, danach geht es dort weiter.
  if (user === null) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/geraete" replace />} />
        <Route path="geraete" element={<DevicesPage />} />
        <Route
          path="geraete/neu"
          element={
            <RequirePermission permission="devices:create">
              <DeviceFormPage />
            </RequirePermission>
          }
        />
        <Route path="geraete/:id" element={<DeviceDetailPage />} />
        <Route
          path="geraete/:id/bearbeiten"
          element={
            <RequirePermission permission="devices:edit">
              <DeviceFormPage />
            </RequirePermission>
          }
        />
        <Route path="raeume" element={<RoomsPage />} />
        <Route path="raeume/:id" element={<RoomDetailPage />} />
        <Route
          path="inventur"
          element={
            <RequirePermission permission="inventory:run">
              <PlaceholderPage title="Inventur" sprint={4} reference="Kap. 4 Inventur mit Strichcode (Ist-Erfassung)">
                Raum auswählen, dann für jedes Gerät die Inventarnummer eingeben oder mit einem Handscanner einlesen.
                Das Feld ist danach sofort wieder leer für das nächste Gerät.
              </PlaceholderPage>
            </RequirePermission>
          }
        />
        <Route
          path="soll-ist"
          element={
            <PlaceholderPage title="Soll-Ist-Vergleich" sprint={4} reference="Kap. 4 Soll-Ist-Vergleich">
              Zeigt nach der Inventur, welche Geräte fehlen, welche in einem anderen Raum gefunden wurden und welche
              nicht in SAP stehen.
            </PlaceholderPage>
          }
        />
        <Route
          path="import"
          element={
            <RequirePermission permission="import:run">
              <PlaceholderPage title="SAP-Import" sprint={3} reference="Kap. 4 Import aus SAP">
                Excel- oder CSV-Liste aus SAP hochladen, Spalten zuordnen, Vorschau prüfen und übernehmen. Ein zweiter
                Import derselben Liste erzeugt keine doppelten Einträge.
              </PlaceholderPage>
            </RequirePermission>
          }
        />
        <Route
          path="export"
          element={
            <PlaceholderPage title="Export" sprint={4} reference="Kap. 4 Export in CSV-/Excel-Datei, Export für SAP">
              Listen als CSV- oder Excel-Datei herunterladen und Änderungen im Format für den SAP-Import ausgeben.
            </PlaceholderPage>
          }
        />
        <Route
          path="benutzer"
          element={
            <RequirePermission permission="users:manage">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route path="passwort" element={<PasswordPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
