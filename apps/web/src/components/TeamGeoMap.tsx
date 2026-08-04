import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type TeamGeoItem = {
  workerId: string;
  workerName: string;
  site: {
    address: string;
    latitude: number;
    longitude: number;
    leftAt?: string | null;
    lastPingAt?: string | null;
  };
  workerPoint?: {
    latitude: number;
    longitude: number;
  } | null;
};

type TeamGeoMapProps = {
  items: TeamGeoItem[];
};

function buildMarkerIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
        <div style="width: 18px; height: 18px; border-radius: 999px; background: ${color}; border: 3px solid rgba(255,255,255,0.95); box-shadow: 0 0 0 7px ${color}33; position: relative;">
          <span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.96); font-size: 10px; font-weight: 700; line-height: 1;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12]
  });
}

function MapBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }

    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

export default function TeamGeoMap({ items }: TeamGeoMapProps) {
  const points = useMemo<Array<[number, number]>>(() => {
    const nextPoints: Array<[number, number]> = [];
    for (const item of items) {
      nextPoints.push([item.site.latitude, item.site.longitude]);
      if (item.workerPoint) {
        nextPoints.push([item.workerPoint.latitude, item.workerPoint.longitude]);
      }
    }
    return nextPoints;
  }, [items]);

  const siteIcon = useMemo(() => buildMarkerIcon('#22d3ee', 'О'), []);
  const workerIcon = useMemo(() => buildMarkerIcon('#fb7185', 'W'), []);

  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
        Нет активных геоточек мастеров.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10">
      <MapContainer center={points[0]} zoom={14} className="h-[420px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds points={points} />
        {items.map((item) => (
          <Marker key={`${item.workerId}-site`} position={[item.site.latitude, item.site.longitude]} icon={siteIcon}>
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold">{item.workerName}</p>
                <p>Объект: {item.site.address}</p>
                <p>{item.site.leftAt ? `Закончил: ${new Date(item.site.leftAt).toLocaleString('ru-RU')}` : 'В работе'}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        {items.map((item) => item.workerPoint ? (
          <Marker key={`${item.workerId}-worker`} position={[item.workerPoint.latitude, item.workerPoint.longitude]} icon={workerIcon}>
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold">{item.workerName}</p>
                <p>Последняя геопозиция мастера</p>
                <p>{item.site.lastPingAt ? `Пинг: ${new Date(item.site.lastPingAt).toLocaleString('ru-RU')}` : 'Без пинга'}</p>
              </div>
            </Popup>
          </Marker>
        ) : null)}
      </MapContainer>
    </div>
  );
}
