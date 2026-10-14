import { Link, useParams } from 'react-router';
import { formatDate } from '../format.js';
import { useApi } from '../useApi.js';

// Raumansicht mit allen Geräten eines Raumes (Pflichtenheft Kap. 4 Export in Web-App)
export default function RoomDetailPage() {
  const { id } = useParams();
  const { data: room, error } = useApi(`/rooms/${id}`);

  if (error) return <p className="error page">{error.message}</p>;
  if (!room) return <p className="muted page">Wird geladen …</p>;

  return (
    <div className="page">
      <p className="breadcrumb">
        <Link to="/raeume">Räume</Link> / {room.number}
      </p>
      <h1>
        Raum {room.number}
        {room.name && ` – ${room.name}`}
      </h1>
      <p className="muted">
        {room.floor ?? 'Stockwerk nicht angegeben'} · {room.devices.length}{' '}
        {room.devices.length === 1 ? 'Gerät' : 'Geräte'}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Inventarnummer</th>
              <th>Bezeichnung</th>
              <th>Gerätetyp</th>
              <th>Seriennummer</th>
              <th>Garantie bis</th>
            </tr>
          </thead>
          <tbody>
            {room.devices.map((device) => (
              <tr key={device.id}>
                <td>
                  <Link to={`/geraete/${device.id}`}>{device.inventory_number}</Link>
                </td>
                <td>{device.description}</td>
                <td>{device.device_type ?? '–'}</td>
                <td>{device.serial_number ?? '–'}</td>
                <td>{formatDate(device.warranty_until)}</td>
              </tr>
            ))}
            {room.devices.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Diesem Raum sind keine Geräte zugeordnet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
