import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth.jsx';
import Pagination from '../components/Pagination.jsx';
import { formatDate, roomLabel } from '../format.js';
import { useApi } from '../useApi.js';

// Setzt oder entfernt Parameter in der Adresszeile. Leere Werte werden entfernt.
function withParams(previous, changes) {
  const next = new URLSearchParams(previous);
  for (const [key, value] of Object.entries(changes)) {
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

// Geräteliste mit Suche und Filtern (Pflichtenheft Kap. 4 Export in Web-App, Abnahme-Testfall T4).
// Die Filter stehen in der Adresszeile, damit „Zurück“ im Browser und Lesezeichen funktionieren.
export default function DevicesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = {
    search: params.get('search') ?? '',
    room_id: params.get('room_id') ?? '',
    device_type: params.get('device_type') ?? '',
    warranty_to: params.get('warranty_to') ?? '',
    page: Number(params.get('page') ?? 1),
  };
  const [searchInput, setSearchInput] = useState(filters.search);

  const devices = useApi('/devices', { ...filters, page_size: 25 });
  const rooms = useApi('/rooms');
  const types = useApi('/devices/types');

  const update = (changes) => setParams((previous) => withParams(previous, { page: '', ...changes }));

  // Suche erst nach einer kurzen Tipppause starten
  useEffect(() => {
    const timer = setTimeout(() => {
      setParams(
        (previous) =>
          (previous.get('search') ?? '') === searchInput
            ? previous
            : withParams(previous, { search: searchInput, page: '' }),
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setParams]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Geräte</h1>
        {can('devices:create') && (
          <Link className="button primary" to="/geraete/neu">
            Gerät anlegen
          </Link>
        )}
      </div>

      <div className="filters card">
        <label className="field grow">
          <span className="field-label">Suche</span>
          <input
            type="search"
            placeholder="Inventarnummer, Seriennummer oder Bezeichnung"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field-label">Raum</span>
          <select value={filters.room_id} onChange={(event) => update({ room_id: event.target.value })}>
            <option value="">Alle Räume</option>
            {rooms.data?.map((room) => (
              <option key={room.id} value={room.id}>
                {roomLabel(room.number, room.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Gerätetyp</span>
          <select value={filters.device_type} onChange={(event) => update({ device_type: event.target.value })}>
            <option value="">Alle Typen</option>
            {types.data?.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Garantie endet bis</span>
          <input
            type="date"
            value={filters.warranty_to}
            onChange={(event) => update({ warranty_to: event.target.value })}
          />
        </label>
      </div>

      {devices.error && <p className="error">{devices.error.message}</p>}
      <div className={`table-wrap ${devices.loading ? 'is-loading' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>Inventarnummer</th>
              <th>Bezeichnung</th>
              <th>Gerätetyp</th>
              <th>Raum</th>
              <th>Garantie bis</th>
            </tr>
          </thead>
          <tbody>
            {devices.data?.items.map((device) => (
              <tr key={device.id} className="clickable" onClick={() => navigate(`/geraete/${device.id}`)}>
                <td>
                  <Link to={`/geraete/${device.id}`} onClick={(event) => event.stopPropagation()}>
                    {device.inventory_number}
                  </Link>
                </td>
                <td>{device.description}</td>
                <td>{device.device_type ?? '–'}</td>
                <td>{roomLabel(device.room_number, device.room_name)}</td>
                <td>{formatDate(device.warranty_until)}</td>
              </tr>
            ))}
            {devices.data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Keine Geräte gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {devices.data && (
        <Pagination
          page={devices.data.page}
          pageSize={devices.data.page_size}
          total={devices.data.total}
          onChange={(page) => update({ page })}
        />
      )}
    </div>
  );
}
